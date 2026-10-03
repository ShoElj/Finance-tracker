import type { Reaction } from "@/lib/game/constants";
import type { CharacterKey, Direction, GameEvent, GameState, MatchResults } from "@/lib/game/types";

export type LobbyPlayer = {
  id: string;
  name: string;
  characterKey: CharacterKey | null;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
};

export type RoomStatus = "waiting" | "playing" | "finished";

export type LobbyState = {
  roomCode: string;
  hostId: string;
  hostName: string;
  status: RoomStatus;
  maxPlayers: number;
  durationSec: number;
  players: LobbyPlayer[];
};

/** Payload for every message sent on the `room:{roomCode}` channel. */
export type RoomEventPayloads = {
  // Lobby
  join_request: { name: string };
  join_rejected: { targetId: string; reason: string };
  lobby_state: { lobby: LobbyState };
  character_selected: { characterKey: CharacterKey };
  player_left: Record<string, never>;
  player_kicked: { targetId: string };
  heartbeat: Record<string, never>;
  room_reset: Record<string, never>;
  room_closed: Record<string, never>;
  // Match
  game_started: { snapshot: GameState };
  player_moved: { x: number; y: number; facing: Direction };
  obstacle_hit: { obstacleId: string };
  /**
   * Host snapshot. Carries the timer, scores (score_updated) and the batched gameplay events
   * since the previous snapshot: snack_collected, powerup_collected, player_caught, …
   */
  game_state: { snapshot: GameState; events: GameEvent[] };
  reaction_sent: { reaction: Reaction };
  game_ended: { results: MatchResults };
};

export type RoomEventType = keyof RoomEventPayloads;

export type RoomEvent<T extends RoomEventType = RoomEventType> = {
  type: T;
  roomCode: string;
  playerId: string;
  payload: RoomEventPayloads[T];
  timestamp: number;
};

/** Discriminated union of every concrete event, for exhaustive `switch (event.type)`. */
export type AnyRoomEvent = { [K in RoomEventType]: RoomEvent<K> }[RoomEventType];

export function makeEvent<T extends RoomEventType>(
  type: T,
  roomCode: string,
  playerId: string,
  payload: RoomEventPayloads[T],
): RoomEvent<T> {
  return { type, roomCode, playerId, payload, timestamp: Date.now() };
}

export function isRoomEvent(value: unknown): value is AnyRoomEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<RoomEvent>;
  return typeof v.type === "string" && typeof v.roomCode === "string" && typeof v.playerId === "string";
}
