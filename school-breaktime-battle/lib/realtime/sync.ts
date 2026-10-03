import type { GameState } from "@/lib/game/types";

/** How often the host broadcasts game snapshots and clients send their position. */
export const SNAPSHOT_INTERVAL_MS = 125;
export const MOVE_SEND_INTERVAL_MS = 110;
export const HEARTBEAT_INTERVAL_MS = 2000;
/** A player is marked inactive after this long without any message. */
export const PLAYER_TIMEOUT_MS = 8000;
/** Players show "Host disconnected" after this long without hearing from the host. */
export const HOST_TIMEOUT_MS = 7000;
export const JOIN_RETRY_MS = 1000;
export const JOIN_TIMEOUT_MS = 6000;
/** Pause on "The bell has rung." before everyone moves to the results screen. */
export const RESULTS_DELAY_MS = 2500;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Compact copy of the game state for the network (rounded positions, no collected items). */
export function toSnapshot(state: GameState): GameState {
  const players: GameState["players"] = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = { ...p, x: round1(p.x), y: round1(p.y), activePowerUps: [...p.activePowerUps] };
  }
  return {
    ...state,
    players,
    snacks: state.snacks.filter((s) => !s.collected).map((s) => ({ ...s })),
    powerUps: state.powerUps.filter((p) => !p.collected).map((p) => ({ ...p })),
    prefects: state.prefects.map((p) => ({ ...p, x: round1(p.x), y: round1(p.y) })),
  };
}
