/**
 * Runs a match in the browser. The host runtime owns the simulation (timer, snacks, prefects,
 * scoring, bots) and broadcasts snapshots; client runtimes move their own player locally and
 * render everyone else from the host's snapshots.
 */
import type { HudState } from "@/store/gameStore";
import { MOVE_SEND_INTERVAL_MS, RESULTS_DELAY_MS, SNAPSHOT_INTERVAL_MS, toSnapshot } from "@/lib/realtime/sync";
import { botInput, createBotMemory, type BotMemory } from "./bots";
import { getCharacter } from "./characters";
import { isWalkable } from "./collision";
import { powerUps as powerUpDefs, REACTION_DISPLAY_MS, TUNING, type Reaction } from "./constants";
import { applyObstacleHit, createRng, finishGame, isInClassroom, movePlayer, refreshDerived, stepGame, type Rng } from "./engine";
import { inputVector, playerInput, resetInput, type InputState } from "./input";
import { buildResults, rankPlayers } from "./scoring";
import type { Direction, GameEvent, GameState, MatchResults, Point } from "./types";

export type FloatingText = { id: number; x: number; y: number; text: string; color: string; born: number };

export type RuntimeHooks = {
  onEvents: (events: GameEvent[]) => void;
  onHud: (hud: HudState) => void;
  // Host
  sendSnapshot?: (snapshot: GameState, events: GameEvent[]) => void;
  sendBotReaction?: (botId: string, reaction: Reaction) => void;
  onFinished?: (results: MatchResults) => void;
  // Client
  sendMove?: (x: number, y: number, facing: Direction) => void;
  sendObstacleHit?: (obstacleId: string) => void;
};

const MAX_STEP_MS = 50;

/** " -20" for a real penalty; nothing when the score was already zero. */
export function signed(points: number): string {
  return points === 0 ? "" : ` ${points > 0 ? "+" : ""}${points}`;
}
const HUD_INTERVAL_MS = 200;
const FLOAT_MS = 1200;
let floatId = 0;

export abstract class GameRuntime {
  abstract readonly role: "host" | "client";
  readonly input: InputState = playerInput;
  /** Smoothed positions used for drawing. */
  readonly display = new Map<string, Point>();
  readonly prefectDisplay = new Map<string, Point>();
  readonly reactions = new Map<string, { text: string; until: number }>();
  floating: FloatingText[] = [];

  private lastTick: number | null = null;
  private hudAt = 0;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    public readonly myId: string,
    public state: GameState,
    protected hooks: RuntimeHooks,
  ) {}

  /** Starts a background loop so the match keeps running even when the tab is not rendering. */
  start(): void {
    if (this.fallbackTimer) return;
    resetInput(this.input);
    this.fallbackTimer = setInterval(() => {
      const now = performance.now();
      if (this.lastTick === null || now - this.lastTick > 90) this.frame(now);
    }, 100);
  }

  stop(): void {
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
    this.fallbackTimer = null;
  }

  /** Advances the match. Called every animation frame by the game scene. */
  frame(now: number = performance.now()): void {
    const dt = this.lastTick === null ? 16 : Math.min(now - this.lastTick, 1000);
    this.lastTick = now;
    let remaining = dt;
    while (remaining > 0) {
      const step = Math.min(MAX_STEP_MS, remaining);
      this.update(step, now);
      remaining -= step;
    }
    this.smooth(dt);
    if (now - this.hudAt >= HUD_INTERVAL_MS) {
      this.hudAt = now;
      this.hooks.onHud(this.buildHud());
    }
  }

  protected abstract update(dtMs: number, now: number): void;

  get me() {
    return this.state.players[this.myId];
  }

  showReaction(playerId: string, text: string): void {
    this.reactions.set(playerId, { text, until: Date.now() + REACTION_DISPLAY_MS });
  }

  protected handleEvents(events: GameEvent[]): void {
    if (events.length === 0) return;
    const now = performance.now();
    for (const e of events) {
      const at = (id: string): Point => this.display.get(id) ?? this.state.players[id] ?? { x: 0, y: 0 };
      switch (e.kind) {
        case "snack_collected":
          this.float(e.x, e.y, `+${e.points}`, "#15803d", now);
          break;
        case "powerup_collected":
          this.float(e.x, e.y, powerUpDefs[e.powerUp].name, "#1d4ed8", now);
          break;
        case "player_caught":
          this.float(e.x, e.y, e.shielded ? "Shield saved you!" : `Caught!${signed(e.penalty)}`, e.shielded ? "#1d4ed8" : "#dc2626", now);
          break;
        case "obstacle_hit":
          this.float(e.x, e.y, `Ouch!${signed(e.penalty)}`, "#dc2626", now);
          break;
        case "returned_to_class": {
          const p = at(e.playerId);
          this.float(p.x, p.y, `Back in class +${e.bonus}`, "#15803d", now);
          break;
        }
        case "reached_canteen": {
          const p = at(e.playerId);
          this.float(p.x, p.y, `Canteen +${e.bonus}`, "#15803d", now);
          break;
        }
        case "streak": {
          const p = at(e.playerId);
          this.float(p.x, p.y - 14, `Streak +${e.bonus}`, "#a16207", now);
          break;
        }
        case "restricted_zone": {
          const p = at(e.playerId);
          this.float(p.x, p.y, `Staff Room!${signed(e.penalty)}`, "#dc2626", now);
          break;
        }
        default:
          break;
      }
    }
    this.hooks.onEvents(events);
  }

  private float(x: number, y: number, text: string, color: string, now: number): void {
    this.floating.push({ id: ++floatId, x, y, text, color, born: now });
  }

  private smooth(dt: number): void {
    const k = Math.min(1, dt / 1000 * 12);
    for (const p of Object.values(this.state.players)) {
      const d = this.display.get(p.id);
      const exact = p.id === this.myId || (this.role === "host" && p.isBot);
      if (!d || exact || Math.hypot(d.x - p.x, d.y - p.y) > 120) {
        this.display.set(p.id, { x: p.x, y: p.y });
      } else {
        d.x += (p.x - d.x) * k;
        d.y += (p.y - d.y) * k;
      }
    }
    for (const id of this.display.keys()) if (!this.state.players[id]) this.display.delete(id);
    for (const pf of this.state.prefects) {
      const d = this.prefectDisplay.get(pf.id);
      if (!d || this.role === "host") this.prefectDisplay.set(pf.id, { x: pf.x, y: pf.y });
      else {
        d.x += (pf.x - d.x) * k;
        d.y += (pf.y - d.y) * k;
      }
    }
    const cutoff = performance.now() - FLOAT_MS;
    if (this.floating.length && this.floating[0].born < cutoff) this.floating = this.floating.filter((f) => f.born >= cutoff);
  }

  buildHud(): HudState {
    const me = this.me;
    const players = Object.values(this.state.players);
    const powerUps: HudState["powerUps"] = [];
    if (me?.hasShield) powerUps.push({ type: "prefect_shield", msLeft: null });
    if (me && me.speedMs > 0) powerUps.push({ type: "speed_shoes", msLeft: me.speedMs });
    if (me && me.doubleMs > 0) powerUps.push({ type: "double_points", msLeft: me.doubleMs });
    return {
      status: this.state.status,
      countdownMs: this.state.countdownMs,
      timeRemaining: this.state.timeRemaining,
      myScore: me?.score ?? 0,
      mySnacks: me?.snacksCollected ?? 0,
      inClassroom: me ? isInClassroom(me) : false,
      returnedToClass: me?.returnedToClass ?? false,
      isFrozen: (me?.frozenMs ?? 0) > 0,
      powerUps,
      leaderboard: rankPlayers(players).map((p) => ({
        id: p.id,
        name: p.name,
        characterKey: p.characterKey,
        score: p.score,
        isMe: p.id === this.myId,
        isBot: p.isBot,
        returnedToClass: p.returnedToClass,
        isFrozen: p.frozenMs > 0,
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------------

const BOT_TAUNTS: Reaction[] = ["Run", "I am winning", "Prefect is coming", "Good move", "Back to class", "Wait for me"];

export class HostRuntime extends GameRuntime {
  readonly role = "host" as const;
  private rng: Rng;
  private bots = new Map<string, BotMemory>();
  private pending: GameEvent[] = [];
  private snapshotAt = 0;
  private finishedAt: number | null = null;
  private resultsSent = false;
  private botChatterMs = 12000;

  constructor(myId: string, state: GameState, hooks: RuntimeHooks, seed: number) {
    super(myId, state, hooks);
    this.rng = createRng(seed);
    for (const p of Object.values(state.players)) if (p.isBot) this.bots.set(p.id, createBotMemory(this.rng));
  }

  protected update(dt: number, now: number): void {
    const state = this.state;
    const events: GameEvent[] = [];

    if (state.status === "playing") {
      const me = this.me;
      if (me && !me.isBot) {
        const hit = movePlayer(me, inputVector(this.input), dt).hitObstacleId;
        if (hit) {
          const e = applyObstacleHit(state, me.id, hit);
          if (e) events.push(e);
        }
      }
      for (const [id, memory] of this.bots) {
        const bot = state.players[id];
        if (!bot) continue;
        const hit = movePlayer(bot, botInput(state, bot, memory, dt, this.rng), dt).hitObstacleId;
        if (hit) {
          const e = applyObstacleHit(state, id, hit);
          if (e) events.push(e);
        }
      }
      this.botChatter(dt);
    }

    events.push(...stepGame(state, dt, this.rng));
    this.emit(events);

    if (state.status === "finished" && this.finishedAt === null) {
      this.finishedAt = now;
      this.snapshotAt = 0;
    }
    if (now - this.snapshotAt >= SNAPSHOT_INTERVAL_MS) this.flushSnapshot(now);
    if (this.finishedAt !== null && !this.resultsSent && now - this.finishedAt >= RESULTS_DELAY_MS) {
      this.resultsSent = true;
      this.hooks.onFinished?.(buildResults(state.roomCode, Object.values(state.players), state.endedAt ?? Date.now()));
    }
  }

  private emit(events: GameEvent[]): void {
    if (events.length === 0) return;
    this.pending.push(...events);
    this.handleEvents(events);
    for (const e of events) {
      if (e.kind === "player_caught" && !e.shielded && this.bots.has(e.playerId) && this.rng() < 0.6) {
        this.hooks.sendBotReaction?.(e.playerId, "You caught me");
      }
    }
  }

  private botChatter(dt: number): void {
    if (this.bots.size === 0) return;
    this.botChatterMs -= dt;
    if (this.botChatterMs > 0) return;
    this.botChatterMs = 9000 + this.rng() * 12000;
    const ids = [...this.bots.keys()];
    const id = ids[Math.floor(this.rng() * ids.length)];
    const leader = rankPlayers(Object.values(this.state.players))[0];
    const reaction = leader?.id === id ? "I am winning" : BOT_TAUNTS[Math.floor(this.rng() * BOT_TAUNTS.length)];
    this.hooks.sendBotReaction?.(id, reaction);
  }

  private flushSnapshot(now: number): void {
    this.snapshotAt = now;
    this.hooks.sendSnapshot?.(toSnapshot(this.state), this.pending);
    this.pending = [];
  }

  /** Latest snapshot, e.g. for a player who reconnects mid-match. */
  snapshot(): GameState {
    return toSnapshot(this.state);
  }

  handleRemoteMove(playerId: string, x: number, y: number, facing: Direction): void {
    const p = this.state.players[playerId];
    if (!p || p.isBot || playerId === this.myId) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    // Small tolerance for rounding; reject positions inside walls.
    if (isWalkable(x, y, TUNING.playerRadius - 2) === false) return;
    p.x = x;
    p.y = y;
    p.facing = facing;
  }

  handleObstacleHit(playerId: string, obstacleId: string): void {
    const e = applyObstacleHit(this.state, playerId, obstacleId);
    if (e) this.emit([e]);
  }

  /** Host "End Match": rings the final bell now. */
  endNow(): void {
    if (this.state.status === "finished") return;
    if (this.state.status === "countdown") this.state.status = "playing";
    this.emit(finishGame(this.state));
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ClientRuntime extends GameRuntime {
  readonly role = "client" as const;
  private sentAt = 0;
  private sentPos: Point = { x: -1, y: -1 };

  protected update(dt: number, now: number): void {
    const state = this.state;
    const me = this.me;

    if (state.status === "countdown") state.countdownMs = Math.max(0, state.countdownMs - dt);
    if (state.status === "playing") state.timeRemaining = Math.max(0, state.timeRemaining - dt);
    if (!me) return;

    // Predict my own timers between snapshots so effects end smoothly.
    me.frozenMs = Math.max(0, me.frozenMs - dt);
    me.stunMs = Math.max(0, me.stunMs - dt);
    me.speedMs = Math.max(0, me.speedMs - dt);
    me.doubleMs = Math.max(0, me.doubleMs - dt);
    me.hitCooldownMs = Math.max(0, me.hitCooldownMs - dt);

    if (state.status !== "playing") return;
    const result = movePlayer(me, inputVector(this.input), dt);
    if (result.hitObstacleId && me.hitCooldownMs <= 0) {
      const quick = getCharacter(me.characterKey).ability === "quick_recovery";
      me.stunMs = quick ? TUNING.quickRecoveryStunMs : TUNING.stunMs;
      me.hitCooldownMs = TUNING.obstacleHitCooldownMs;
      this.hooks.sendObstacleHit?.(result.hitObstacleId);
    }
    refreshDerived(me);

    const moved = Math.hypot(me.x - this.sentPos.x, me.y - this.sentPos.y) > 0.5;
    const due = now - this.sentAt >= (moved ? MOVE_SEND_INTERVAL_MS : 1000);
    if (due) {
      this.sentAt = now;
      this.sentPos = { x: me.x, y: me.y };
      this.hooks.sendMove?.(Math.round(me.x * 10) / 10, Math.round(me.y * 10) / 10, me.facing);
    }
  }

  applySnapshot(snapshot: GameState, events: GameEvent[]): void {
    const local = this.me;
    const incoming = snapshot.players[this.myId];
    // Keep my locally predicted position while playing unless the host moved me far away.
    if (local && incoming && snapshot.status === "playing" && this.state.status === "playing") {
      if (Math.hypot(local.x - incoming.x, local.y - incoming.y) < 150) {
        incoming.x = local.x;
        incoming.y = local.y;
        incoming.facing = local.facing;
      }
      incoming.stunMs = Math.max(incoming.stunMs, local.stunMs);
      incoming.hitCooldownMs = Math.max(incoming.hitCooldownMs, local.hitCooldownMs);
    }
    this.state = snapshot;
    this.handleEvents(events);
  }
}
