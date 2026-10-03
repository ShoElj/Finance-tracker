/**
 * One browser's connection to a room. The host instance is authoritative for the lobby and
 * the match; player instances send requests and mirror what the host broadcasts.
 * Lives outside React so it survives client-side navigation between room pages.
 */
import { getCharacter, isCharacterKey, randomCharacterKey } from "@/lib/game/characters";
import { getSnackDefinition, powerUps as powerUpDefs, REACTION_COOLDOWN_MS, REACTIONS, type Reaction } from "@/lib/game/constants";
import { createGameState, createRng } from "@/lib/game/engine";
import { ClientRuntime, HostRuntime, signed, type GameRuntime, type RuntimeHooks } from "@/lib/game/runtime";
import type { CharacterKey, GameEvent, GameState, MatchResults } from "@/lib/game/types";
import { cleanName, validateDisplayName } from "@/lib/moderation";
import { createTransport, type RoomTransport } from "@/lib/realtime/channels";
import {
  makeEvent,
  type AnyRoomEvent,
  type LobbyPlayer,
  type LobbyState,
  type RoomEventPayloads,
  type RoomEventType,
} from "@/lib/realtime/room-events";
import {
  HEARTBEAT_INTERVAL_MS,
  HOST_TIMEOUT_MS,
  JOIN_RETRY_MS,
  JOIN_TIMEOUT_MS,
  PLAYER_TIMEOUT_MS,
} from "@/lib/realtime/sync";
import { clearSession, loadJson, removeKey, saveJson, saveSession, type RoomMode, type Session } from "@/lib/session";
import { playSound } from "@/lib/sound";
import { generateId, randomRoomCode } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";
import { getRegistry, type RoomRegistry } from "./registry";

const BOT_NAMES = ["Ada (Bot)", "Tunde (Bot)", "Chioma (Bot)"];

const hostLobbyKey = (code: string) => `sbb-host-lobby-${code}`;
const resultsKey = (code: string) => `sbb-results-${code}`;

export class RoomError extends Error {}

export type CreateRoomOptions = {
  hostName: string;
  maxPlayers: number;
  durationSec: number;
  bots: number;
  mode: RoomMode;
};

let active: RoomClient | null = null;
const resuming = new Map<string, Promise<RoomClient>>();

export function getActiveClient(): RoomClient | null {
  return active;
}

export class RoomClient {
  runtime: GameRuntime | null = null;
  private transport: RoomTransport;
  private registry: RoomRegistry;
  private cleanups: (() => void)[] = [];
  private lastSeen = new Map<string, number>();
  private kicked = new Set<string>();
  private hostLastSeen = Date.now();
  private lastReactionAt = 0;
  private beats = 0;
  private pendingJoin: { resolve: () => void; reject: (reason: string) => void } | null = null;
  private disposed = false;

  private constructor(
    public readonly session: Session,
    public lobby: LobbyState | null,
  ) {
    this.transport = createTransport(session.mode, session.roomCode);
    this.registry = getRegistry(session.mode);
  }

  get isHost(): boolean {
    return this.session.isHost;
  }

  get roomCode(): string {
    return this.session.roomCode;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  static async create(opts: CreateRoomOptions): Promise<RoomClient> {
    const hostName = cleanName(opts.hostName);
    const nameError = validateDisplayName(hostName);
    if (nameError) throw new RoomError(nameError);
    const registry = getRegistry(opts.mode);

    let code = "";
    try {
      for (let attempt = 0; attempt < 25 && !code; attempt++) {
        const candidate = randomRoomCode();
        if (!(await registry.isCodeTaken(candidate))) code = candidate;
      }
      if (code) await registry.createRoom({ code, hostName, maxPlayers: opts.maxPlayers, durationSec: opts.durationSec });
    } catch (e) {
      console.error("[rooms] create failed", e);
      throw new RoomError("Could not create the room. Please check your connection and try again.");
    }
    if (!code) throw new RoomError("Could not find a free room code. Please try again.");

    const hostId = generateId();
    const players: LobbyPlayer[] = [
      { id: hostId, name: hostName, characterKey: null, isHost: true, isBot: false, connected: true },
    ];
    const rng = createRng(Date.now());
    for (let i = 0; i < Math.min(opts.bots, opts.maxPlayers - 1, BOT_NAMES.length); i++) {
      players.push({
        id: `bot-${i + 1}`,
        name: BOT_NAMES[i],
        characterKey: randomCharacterKey(rng),
        isHost: false,
        isBot: true,
        connected: true,
      });
    }
    const lobby: LobbyState = {
      roomCode: code,
      hostId,
      hostName,
      status: "waiting",
      maxPlayers: opts.maxPlayers,
      durationSec: opts.durationSec,
      players,
    };
    const client = new RoomClient({ roomCode: code, playerId: hostId, name: hostName, isHost: true, mode: opts.mode }, lobby);
    await client.open();
    client.activate();
    client.broadcastLobby();
    void registry.upsertPlayer(code, players[0]);
    return client;
  }

  static async join(opts: { roomCode: string; name: string; mode: RoomMode }): Promise<RoomClient> {
    const name = cleanName(opts.name);
    const nameError = validateDisplayName(name);
    if (nameError) throw new RoomError(nameError);
    let room;
    try {
      room = await getRegistry(opts.mode).findRoom(opts.roomCode);
    } catch (e) {
      console.error("[rooms] lookup failed", e);
      throw new RoomError("Could not reach the game server. Please check your connection.");
    }
    if (!room) throw new RoomError("Room not found.");
    if (room.status === "playing") throw new RoomError("This game has already started.");

    const session: Session = { roomCode: opts.roomCode, playerId: generateId(), name, isHost: false, mode: opts.mode };
    const client = new RoomClient(session, null);
    await client.open();
    try {
      await client.requestJoin();
    } catch (e) {
      client.dispose();
      throw e;
    }
    client.activate();
    return client;
  }

  /** Reconnects after a page reload using the session saved in this tab. */
  static resume(session: Session): Promise<RoomClient> {
    if (active && active.roomCode === session.roomCode && !active.disposed) return Promise.resolve(active);
    const existing = resuming.get(session.roomCode);
    if (existing) return existing;
    const promise = RoomClient.doResume(session).finally(() => resuming.delete(session.roomCode));
    resuming.set(session.roomCode, promise);
    return promise;
  }

  private static async doResume(session: Session): Promise<RoomClient> {
    useGameStore.getState().patch({ connection: "connecting" });
    if (session.isHost) {
      const lobby = loadJson<LobbyState>(hostLobbyKey(session.roomCode));
      if (!lobby) throw new RoomError("Room not found.");
      // A running match cannot survive a host reload; everyone goes back to the lobby.
      const restarted = lobby.status === "playing";
      if (restarted) lobby.status = "waiting";
      const client = new RoomClient(session, lobby);
      await client.open();
      client.activate();
      if (restarted) {
        client.send("room_reset", {});
        void client.registry.setStatus(session.roomCode, "waiting");
      }
      client.broadcastLobby();
      return client;
    }
    const client = new RoomClient(session, null);
    await client.open();
    try {
      await client.requestJoin();
    } catch (e) {
      client.dispose();
      throw e;
    }
    client.activate();
    return client;
  }

  private async open(): Promise<void> {
    this.cleanups.push(this.transport.subscribe((e) => this.handle(e)));
    this.cleanups.push(
      this.transport.onStatus((status) => {
        if (this.disposed || active !== this) return;
        const store = useGameStore.getState();
        if (status === "reconnecting") store.patch({ connection: "reconnecting", notice: "Connection lost. Trying to reconnect." });
        if (status === "connected" && store.connection === "reconnecting") store.patch({ connection: "connected", notice: null });
      }),
    );
    try {
      await this.transport.connect();
    } catch (e) {
      this.dispose();
      throw new RoomError(e instanceof Error ? e.message : "Could not connect to the room.");
    }
    const timer = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);
    this.cleanups.push(() => clearInterval(timer));
    this.lastSeen.clear();
    for (const p of this.lobby?.players ?? []) this.lastSeen.set(p.id, Date.now());
  }

  private activate(): void {
    if (active && active !== this) active.dispose();
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the one active room for this tab
    active = this;
    saveSession(this.session);
    this.hostLastSeen = Date.now();
    useGameStore.getState().patch({
      session: this.session,
      lobby: this.lobby,
      connection: "connected",
      notice: null,
      results: this.lobby?.status === "finished" ? loadJson<MatchResults>(resultsKey(this.roomCode)) : null,
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopRuntime();
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.transport.close();
    if (active === this) active = null;
  }

  /** Leave the room (host leaving closes it for everyone). */
  leave(): void {
    if (this.isHost) {
      this.send("room_closed", {});
      void this.registry.setStatus(this.roomCode, "closed");
      removeKey(hostLobbyKey(this.roomCode));
    } else {
      this.send("player_left", {});
    }
    this.dispose();
    clearSession();
    useGameStore.getState().reset();
  }

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  private send<T extends RoomEventType>(type: T, payload: RoomEventPayloads[T], asPlayerId = this.session.playerId): void {
    if (this.disposed) return;
    this.transport.send(makeEvent(type, this.roomCode, asPlayerId, payload) as AnyRoomEvent);
  }

  private requestJoin(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sendRequest = () => this.send("join_request", { name: this.session.name });
      const retry = setInterval(sendRequest, JOIN_RETRY_MS);
      const cleanup = () => {
        clearInterval(retry);
        clearTimeout(timeout);
        this.pendingJoin = null;
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new RoomError("Room not found. Check the code, or the host may be offline."));
      }, JOIN_TIMEOUT_MS);
      this.pendingJoin = {
        resolve: () => {
          cleanup();
          resolve();
        },
        reject: (reason) => {
          cleanup();
          reject(new RoomError(reason));
        },
      };
      sendRequest();
    });
  }

  private handle(event: AnyRoomEvent): void {
    if (this.disposed || event.roomCode !== this.roomCode) return;
    if (this.isHost) {
      this.lastSeen.set(event.playerId, Date.now());
      this.handleAsHost(event);
    } else {
      const fromHost = this.lobby ? event.playerId === this.lobby.hostId : event.type === "lobby_state" || event.type === "join_rejected";
      if (fromHost) {
        this.hostLastSeen = Date.now();
        const store = useGameStore.getState();
        if (store.connection === "host_lost") store.patch({ connection: "connected", notice: null });
        this.handleFromHost(event);
      }
    }
    if (event.type === "reaction_sent") this.receiveReaction(event.playerId, event.payload.reaction);
  }

  private handleAsHost(event: AnyRoomEvent): void {
    const lobby = this.lobby;
    if (!lobby) return;
    const player = lobby.players.find((p) => p.id === event.playerId);

    switch (event.type) {
      case "join_request":
        this.hostHandleJoin(event.playerId, event.payload.name);
        break;
      case "character_selected":
        if (player && lobby.status === "waiting" && isCharacterKey(event.payload.characterKey)) {
          player.characterKey = event.payload.characterKey;
          this.broadcastLobby();
          void this.registry.upsertPlayer(this.roomCode, player);
        }
        break;
      case "player_left":
        if (!player) break;
        if (lobby.status === "waiting") {
          lobby.players = lobby.players.filter((p) => p.id !== player.id);
          void this.registry.removePlayer(this.roomCode, player.id);
        } else {
          player.connected = false;
        }
        useGameStore.getState().pushFeed(`${player.name} left the room.`);
        this.broadcastLobby();
        break;
      case "heartbeat":
        if (player && !player.connected) {
          player.connected = true;
          this.broadcastLobby();
        }
        break;
      case "player_moved":
        if (this.runtime instanceof HostRuntime) {
          this.runtime.handleRemoteMove(event.playerId, event.payload.x, event.payload.y, event.payload.facing);
        }
        break;
      case "obstacle_hit":
        if (this.runtime instanceof HostRuntime) this.runtime.handleObstacleHit(event.playerId, event.payload.obstacleId);
        break;
      default:
        break;
    }
  }

  private hostHandleJoin(playerId: string, rawName: string): void {
    const lobby = this.lobby!;
    const reject = (reason: string) => this.send("join_rejected", { targetId: playerId, reason });
    const existing = lobby.players.find((p) => p.id === playerId);
    if (existing) {
      // Reconnecting student (page reload or network blip).
      existing.connected = true;
      this.broadcastLobby();
      if (this.runtime instanceof HostRuntime) this.send("game_state", { snapshot: this.runtime.snapshot(), events: [] });
      return;
    }
    if (this.kicked.has(playerId)) return reject("You were removed from this room.");
    if (lobby.status !== "waiting") return reject("This game has already started.");
    if (lobby.players.length >= lobby.maxPlayers) return reject("This room is already full.");
    const name = cleanName(rawName);
    const nameError = validateDisplayName(name);
    if (nameError) return reject(nameError);
    if (lobby.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return reject("This name is already taken.");

    const player: LobbyPlayer = { id: playerId, name, characterKey: null, isHost: false, isBot: false, connected: true };
    lobby.players.push(player);
    useGameStore.getState().pushFeed(`${name} joined the room.`, "good");
    this.broadcastLobby();
    void this.registry.upsertPlayer(this.roomCode, player);
  }

  private handleFromHost(event: AnyRoomEvent): void {
    const store = useGameStore.getState();
    const me = this.session.playerId;
    switch (event.type) {
      case "lobby_state": {
        const lobby = event.payload.lobby;
        const inLobby = lobby.players.some((p) => p.id === me);
        if (this.pendingJoin) {
          if (inLobby) {
            this.lobby = lobby;
            this.pendingJoin.resolve();
          }
          return;
        }
        this.lobby = lobby;
        store.patch({ lobby });
        break;
      }
      case "join_rejected":
        if (event.payload.targetId === me) this.pendingJoin?.reject(event.payload.reason);
        break;
      case "player_kicked":
        if (event.payload.targetId === me) {
          this.endWith("kicked", "The host removed you from the room.");
        }
        break;
      case "room_closed":
        this.endWith("closed", "The host closed the room.");
        break;
      case "room_reset":
        this.stopRuntime();
        store.patch({ results: null, hud: null, feed: [] });
        break;
      case "game_started":
        this.startClientRuntime(event.payload.snapshot);
        store.patch({ results: null, feed: [] });
        break;
      case "game_state":
        if (!this.runtime) this.startClientRuntime(event.payload.snapshot);
        if (this.runtime instanceof ClientRuntime) this.runtime.applySnapshot(event.payload.snapshot, event.payload.events);
        break;
      case "game_ended":
        this.stopRuntime();
        saveJson(resultsKey(this.roomCode), event.payload.results);
        store.patch({ results: event.payload.results });
        break;
      default:
        break;
    }
  }

  private endWith(connection: "kicked" | "closed", notice: string): void {
    this.dispose();
    clearSession();
    useGameStore.getState().patch({ connection, notice });
  }

  private heartbeat(): void {
    if (this.disposed) return;
    this.beats += 1;
    this.send("heartbeat", {});
    const now = Date.now();
    if (this.isHost) {
      this.registry.touch(this.roomCode);
      const lobby = this.lobby;
      if (!lobby) return;
      let changed = false;
      for (const p of lobby.players) {
        if (p.isBot || p.isHost) continue;
        const connected = now - (this.lastSeen.get(p.id) ?? 0) < PLAYER_TIMEOUT_MS;
        if (connected !== p.connected) {
          p.connected = connected;
          changed = true;
        }
      }
      // Re-send the lobby regularly so a missed message never leaves a player stuck.
      if (changed || this.beats % 3 === 0) this.broadcastLobby();
    } else if (now - this.hostLastSeen > HOST_TIMEOUT_MS) {
      const store = useGameStore.getState();
      if (store.connection === "connected") store.patch({ connection: "host_lost", notice: "Host disconnected." });
    }
  }

  // -------------------------------------------------------------------------
  // Host actions
  // -------------------------------------------------------------------------

  private broadcastLobby(): void {
    const lobby = this.lobby;
    if (!lobby || !this.isHost) return;
    const copy: LobbyState = { ...lobby, players: lobby.players.map((p) => ({ ...p })) };
    this.send("lobby_state", { lobby: copy });
    saveJson(hostLobbyKey(this.roomCode), copy);
    if (active === this) useGameStore.getState().patch({ lobby: copy });
  }

  setDuration(durationSec: number): void {
    if (!this.isHost || !this.lobby || this.lobby.status !== "waiting") return;
    this.lobby.durationSec = durationSec;
    this.broadcastLobby();
  }

  removePlayer(playerId: string): void {
    const lobby = this.lobby;
    if (!this.isHost || !lobby || playerId === lobby.hostId) return;
    const player = lobby.players.find((p) => p.id === playerId);
    if (!player) return;
    lobby.players = lobby.players.filter((p) => p.id !== playerId);
    if (!player.isBot) this.kicked.add(playerId);
    this.send("player_kicked", { targetId: playerId });
    if (this.runtime) delete this.runtime.state.players[playerId];
    this.broadcastLobby();
    void this.registry.removePlayer(this.roomCode, playerId);
  }

  startGame(): void {
    const lobby = this.lobby;
    if (!this.isHost || !lobby || lobby.status !== "waiting") return;
    const rng = createRng(Date.now());
    // Inactive students are left out; anyone without a character gets a random one.
    lobby.players = lobby.players.filter((p) => p.connected || p.isBot || p.isHost);
    for (const p of lobby.players) p.characterKey ??= randomCharacterKey(rng);

    const seed = Math.floor(Math.random() * 2 ** 31);
    const state = createGameState({
      roomCode: this.roomCode,
      durationSec: lobby.durationSec,
      players: lobby.players.map((p) => ({ id: p.id, name: p.name, characterKey: p.characterKey!, isBot: p.isBot })),
      rng: createRng(seed),
    });
    this.stopRuntime();
    const runtime = new HostRuntime(this.session.playerId, state, this.runtimeHooks(), seed);
    this.runtime = runtime;
    lobby.status = "playing";
    useGameStore.getState().patch({ results: null, feed: [], hud: runtime.buildHud() });
    this.send("game_started", { snapshot: runtime.snapshot() });
    this.broadcastLobby();
    runtime.start();
    void this.registry.setStatus(this.roomCode, "playing");
  }

  endMatch(): void {
    if (this.runtime instanceof HostRuntime) this.runtime.endNow();
  }

  private finishMatch(results: MatchResults): void {
    const lobby = this.lobby;
    if (!lobby) return;
    lobby.status = "finished";
    this.stopRuntime();
    saveJson(resultsKey(this.roomCode), results);
    useGameStore.getState().patch({ results });
    this.send("game_ended", { results });
    this.broadcastLobby();
    void this.registry.setStatus(this.roomCode, "finished");
    void this.registry.saveResults(this.roomCode, results);
  }

  /** Back to the lobby with the same players, ready for another round. */
  resetRoom(): void {
    const lobby = this.lobby;
    if (!this.isHost || !lobby) return;
    this.stopRuntime();
    lobby.status = "waiting";
    useGameStore.getState().patch({ results: null, hud: null, feed: [] });
    this.send("room_reset", {});
    this.broadcastLobby();
    void this.registry.setStatus(this.roomCode, "waiting");
  }

  // -------------------------------------------------------------------------
  // Player actions
  // -------------------------------------------------------------------------

  selectCharacter(characterKey: CharacterKey): void {
    const lobby = this.lobby;
    if (!lobby || lobby.status !== "waiting") return;
    const me = lobby.players.find((p) => p.id === this.session.playerId);
    if (!me) return;
    me.characterKey = characterKey;
    if (this.isHost) {
      this.broadcastLobby();
      void this.registry.upsertPlayer(this.roomCode, me);
    } else {
      // Optimistic update; the host's next lobby_state confirms it.
      useGameStore.getState().patch({ lobby: { ...lobby, players: lobby.players.map((p) => ({ ...p })) } });
      this.send("character_selected", { characterKey });
    }
  }

  /** Returns false while the reaction cooldown is active. */
  sendReaction(reaction: Reaction): boolean {
    if (!REACTIONS.includes(reaction)) return false;
    const now = Date.now();
    if (now - this.lastReactionAt < REACTION_COOLDOWN_MS) return false;
    this.lastReactionAt = now;
    this.send("reaction_sent", { reaction });
    this.receiveReaction(this.session.playerId, reaction);
    return true;
  }

  private receiveReaction(playerId: string, reaction: Reaction): void {
    if (!REACTIONS.includes(reaction)) return;
    this.runtime?.showReaction(playerId, reaction);
    const name = this.nameOf(playerId);
    if (name) useGameStore.getState().pushFeed(`${name}: “${reaction}”`);
  }

  private nameOf(playerId: string): string | null {
    return (
      this.runtime?.state.players[playerId]?.name ?? this.lobby?.players.find((p) => p.id === playerId)?.name ?? null
    );
  }

  // -------------------------------------------------------------------------
  // Runtime wiring
  // -------------------------------------------------------------------------

  private startClientRuntime(snapshot: GameState): void {
    this.stopRuntime();
    const runtime = new ClientRuntime(this.session.playerId, snapshot, this.runtimeHooks());
    this.runtime = runtime;
    useGameStore.getState().patch({ hud: runtime.buildHud() });
    runtime.start();
  }

  private stopRuntime(): void {
    this.runtime?.stop();
    this.runtime = null;
  }

  private runtimeHooks(): RuntimeHooks {
    const store = () => useGameStore.getState();
    return {
      onHud: (hud) => {
        if (active === this) store().patch({ hud });
      },
      onEvents: (events) => this.announce(events),
      sendSnapshot: (snapshot, events) => this.send("game_state", { snapshot, events }),
      sendBotReaction: (botId, reaction) => {
        this.send("reaction_sent", { reaction }, botId);
        this.receiveReaction(botId, reaction);
      },
      onFinished: (results) => this.finishMatch(results),
      sendMove: (x, y, facing) => this.send("player_moved", { x, y, facing }),
      sendObstacleHit: (obstacleId) => this.send("obstacle_hit", { obstacleId }),
    };
  }

  /** Sounds and feed messages for gameplay events. */
  private announce(events: GameEvent[]): void {
    const me = this.session.playerId;
    const feed = useGameStore.getState().pushFeed;
    for (const e of events) {
      const name = "playerId" in e ? (this.nameOf(e.playerId) ?? "Someone") : "";
      const mine = "playerId" in e && e.playerId === me;
      switch (e.kind) {
        case "break_bell":
          playSound("break-bell");
          feed("Break time! Rush to the canteen!", "good");
          break;
        case "final_bell":
          playSound("final-bell");
          feed("The bell has rung.", "info");
          break;
        case "snack_collected":
          if (mine) playSound("snack-collect");
          if (e.points >= 20) feed(`${name} grabbed ${getSnackDefinition(e.snackType).name} +${e.points}`, "good");
          break;
        case "powerup_collected":
          if (mine) playSound("powerup");
          feed(`${name} picked up ${powerUpDefs[e.powerUp].name}`, "info");
          break;
        case "player_caught":
          if (mine) playSound("caught");
          feed(e.shielded ? `${name}'s shield blocked the prefect!` : `Prefect caught ${name}!${signed(e.penalty)}`, e.shielded ? "info" : "bad");
          break;
        case "returned_to_class":
          feed(`${name} is back in class +${e.bonus}`, "good");
          break;
        case "special_spawned":
          feed("A Special Lunch Pack appeared!", "good");
          break;
        case "restricted_zone":
          if (mine) feed(`Staff Room is out of bounds!${signed(e.penalty)}`, "bad");
          break;
        case "missed_bell":
          if (mine) feed(`You were outside class at the bell${signed(e.penalty)}`, "bad");
          break;
        default:
          break;
      }
    }
  }
}

export function characterLabel(key: CharacterKey | null): string {
  return key ? getCharacter(key).name : "Choosing…";
}
