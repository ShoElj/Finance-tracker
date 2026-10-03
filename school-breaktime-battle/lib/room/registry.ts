/**
 * Persistent room records. Online rooms live in Supabase (rooms, players, match_results);
 * demo rooms live in localStorage so other tabs of the same browser can find them.
 * All writes are best-effort: a failed write is logged and never interrupts a match.
 */
import type { MatchResults } from "@/lib/game/types";
import type { LobbyPlayer } from "@/lib/realtime/room-events";
import type { RoomMode } from "@/lib/session";
import { getSupabase } from "@/lib/supabase/client";

export type RoomRecordStatus = "waiting" | "playing" | "finished" | "closed";

export type RoomRecord = {
  code: string;
  hostName: string;
  status: RoomRecordStatus;
  maxPlayers: number;
  durationSec: number;
};

export interface RoomRegistry {
  isCodeTaken(code: string): Promise<boolean>;
  createRoom(room: Omit<RoomRecord, "status">): Promise<void>;
  findRoom(code: string): Promise<RoomRecord | null>;
  setStatus(code: string, status: RoomRecordStatus): Promise<void>;
  /** Host keep-alive (used by demo rooms to expire abandoned codes). */
  touch(code: string): void;
  upsertPlayer(code: string, player: LobbyPlayer): Promise<void>;
  removePlayer(code: string, playerId: string): Promise<void>;
  saveResults(code: string, results: MatchResults): Promise<void>;
}

/** Codes of rooms older than this no longer block a new room from using the code. */
const ROOM_CODE_TTL_MS = 12 * 60 * 60 * 1000;
const LOCAL_STALE_MS = 20_000;
const LOCAL_KEY = "sbb-local-rooms";

function warn(action: string, error: unknown) {
  console.warn(`[rooms] ${action} failed`, error);
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

type RoomRow = {
  id: string;
  room_code: string;
  host_name: string;
  status: RoomRecordStatus;
  max_players: number;
  match_duration: number;
};

class SupabaseRegistry implements RoomRegistry {
  private roomIds = new Map<string, string>();

  private get db() {
    const db = getSupabase();
    if (!db) throw new Error("Supabase is not configured.");
    return db;
  }

  private async latestRoom(code: string): Promise<RoomRow | null> {
    const since = new Date(Date.now() - ROOM_CODE_TTL_MS).toISOString();
    const { data, error } = await this.db
      .from("rooms")
      .select("id, room_code, host_name, status, max_players, match_duration")
      .eq("room_code", code)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = (data?.[0] as RoomRow | undefined) ?? null;
    if (row) this.roomIds.set(code, row.id);
    return row;
  }

  private async roomId(code: string): Promise<string | null> {
    return this.roomIds.get(code) ?? (await this.latestRoom(code))?.id ?? null;
  }

  async isCodeTaken(code: string): Promise<boolean> {
    const row = await this.latestRoom(code);
    return Boolean(row && row.status !== "closed");
  }

  async createRoom(room: Omit<RoomRecord, "status">): Promise<void> {
    const { data, error } = await this.db
      .from("rooms")
      .insert({
        room_code: room.code,
        host_name: room.hostName,
        max_players: room.maxPlayers,
        match_duration: room.durationSec,
        status: "waiting",
      })
      .select("id")
      .single();
    if (error) throw error;
    this.roomIds.set(room.code, (data as { id: string }).id);
  }

  async findRoom(code: string): Promise<RoomRecord | null> {
    const row = await this.latestRoom(code);
    if (!row || row.status === "closed") return null;
    return {
      code: row.room_code,
      hostName: row.host_name,
      status: row.status,
      maxPlayers: row.max_players,
      durationSec: row.match_duration,
    };
  }

  async setStatus(code: string, status: RoomRecordStatus): Promise<void> {
    try {
      const id = await this.roomId(code);
      if (!id) return;
      const patch: Record<string, unknown> = { status };
      if (status === "playing") patch.started_at = new Date().toISOString();
      if (status === "finished" || status === "closed") patch.ended_at = new Date().toISOString();
      const { error } = await this.db.from("rooms").update(patch).eq("id", id);
      if (error) throw error;
    } catch (e) {
      warn("setStatus", e);
    }
  }

  touch(): void {
    // Online rooms are kept alive by the realtime channel itself.
  }

  async upsertPlayer(code: string, player: LobbyPlayer): Promise<void> {
    if (player.isBot) return;
    try {
      const id = await this.roomId(code);
      if (!id) return;
      const { error } = await this.db.from("players").upsert({
        id: player.id,
        room_id: id,
        display_name: player.name,
        character_key: player.characterKey,
        is_host: player.isHost,
        is_connected: player.connected,
      });
      if (error) throw error;
    } catch (e) {
      warn("upsertPlayer", e);
    }
  }

  async removePlayer(_code: string, playerId: string): Promise<void> {
    try {
      const { error } = await this.db.from("players").delete().eq("id", playerId);
      if (error) throw error;
    } catch (e) {
      warn("removePlayer", e);
    }
  }

  async saveResults(code: string, results: MatchResults): Promise<void> {
    try {
      const id = await this.roomId(code);
      if (!id) return;
      const humans = results.rows.filter((r) => !r.isBot);
      for (const r of humans) {
        await this.db.from("players").update({ score: r.score }).eq("id", r.playerId);
      }
      if (humans.length > 0) {
        const { error } = await this.db.from("match_results").insert(
          humans.map((r) => ({
            room_id: id,
            player_id: r.playerId,
            final_score: r.score,
            rank: r.rank,
            snacks_collected: r.snacksCollected,
            caught_count: r.caughtCount,
            returned_to_class: r.returnedToClass,
          })),
        );
        if (error) throw error;
      }
    } catch (e) {
      warn("saveResults", e);
    }
  }
}

// ---------------------------------------------------------------------------
// Local (demo mode)
// ---------------------------------------------------------------------------

type LocalRoom = RoomRecord & { updatedAt: number };

function readLocal(): Record<string, LocalRoom> {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "{}") as Record<string, LocalRoom>;
  } catch {
    return {};
  }
}

function writeLocal(rooms: Record<string, LocalRoom>): void {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(rooms));
  } catch {
    // Storage unavailable: demo rooms then only work inside this tab.
  }
}

function liveLocal(code: string): LocalRoom | null {
  const room = readLocal()[code];
  if (!room || room.status === "closed" || Date.now() - room.updatedAt > LOCAL_STALE_MS) return null;
  return room;
}

class LocalRegistry implements RoomRegistry {
  async isCodeTaken(code: string): Promise<boolean> {
    return liveLocal(code) !== null;
  }

  async createRoom(room: Omit<RoomRecord, "status">): Promise<void> {
    const rooms = readLocal();
    // Drop expired rooms while we are here.
    for (const [code, r] of Object.entries(rooms)) {
      if (Date.now() - r.updatedAt > LOCAL_STALE_MS) delete rooms[code];
    }
    rooms[room.code] = { ...room, status: "waiting", updatedAt: Date.now() };
    writeLocal(rooms);
  }

  async findRoom(code: string): Promise<RoomRecord | null> {
    const room = liveLocal(code);
    if (!room) return null;
    return { code: room.code, hostName: room.hostName, status: room.status, maxPlayers: room.maxPlayers, durationSec: room.durationSec };
  }

  async setStatus(code: string, status: RoomRecordStatus): Promise<void> {
    const rooms = readLocal();
    if (!rooms[code]) return;
    rooms[code] = { ...rooms[code], status, updatedAt: Date.now() };
    writeLocal(rooms);
  }

  touch(code: string): void {
    const rooms = readLocal();
    if (!rooms[code] || rooms[code].status === "closed") return;
    rooms[code].updatedAt = Date.now();
    writeLocal(rooms);
  }

  async upsertPlayer(): Promise<void> {}
  async removePlayer(): Promise<void> {}
  async saveResults(): Promise<void> {}
}

const registries: Partial<Record<RoomMode, RoomRegistry>> = {};

export function getRegistry(mode: RoomMode): RoomRegistry {
  registries[mode] ??= mode === "online" ? new SupabaseRegistry() : new LocalRegistry();
  return registries[mode]!;
}
