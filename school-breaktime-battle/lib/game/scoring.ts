import { getCharacter } from "./characters";
import { SCORING } from "./constants";
import type { MatchResults, PlayerState } from "./types";

/** Adds (or subtracts) points. The score never goes below zero. Returns the applied change. */
export function addScore(player: PlayerState, delta: number): number {
  const next = Math.max(0, player.score + delta);
  const applied = next - player.score;
  player.score = next;
  return applied;
}

/** Points a player earns for a snack, including double points and the Snack Lover bonus. */
export function snackPoints(player: PlayerState, basePoints: number): number {
  const multiplier = player.doubleMs > 0 ? 2 : 1;
  const bonus = getCharacter(player.characterKey).ability === "snack_bonus" ? SCORING.snackLoverBonus : 0;
  return basePoints * multiplier + bonus;
}

type Rankable = Pick<PlayerState, "score" | "caughtCount" | "snacksCollected" | "returnedToClass" | "returnedAt">;

/**
 * Highest score first. Ties: fewer captures, then more snacks, then whoever returned to
 * class (earliest return first).
 */
export function comparePlayers(a: Rankable, b: Rankable): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.caughtCount !== b.caughtCount) return a.caughtCount - b.caughtCount;
  if (b.snacksCollected !== a.snacksCollected) return b.snacksCollected - a.snacksCollected;
  if (a.returnedToClass !== b.returnedToClass) return Number(b.returnedToClass) - Number(a.returnedToClass);
  return (a.returnedAt ?? Infinity) - (b.returnedAt ?? Infinity);
}

export function rankPlayers<T extends Rankable>(players: T[]): T[] {
  return [...players].sort(comparePlayers);
}

export function buildResults(roomCode: string, players: PlayerState[], endedAt: number): MatchResults {
  const ranked = rankPlayers(players);
  return {
    roomCode,
    endedAt,
    rows: ranked.map((p, i) => ({
      rank: i + 1,
      playerId: p.id,
      name: p.name,
      characterKey: p.characterKey,
      isBot: p.isBot,
      score: p.score,
      snacksCollected: p.snacksCollected,
      caughtCount: p.caughtCount,
      returnedToClass: p.returnedToClass,
    })),
  };
}
