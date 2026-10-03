import { describe, expect, it } from "vitest";
import { botInput, createBotMemory, nextWaypoint } from "../bots";
import { isWalkable, moveWithCollision } from "../collision";
import { SCORING, TUNING } from "../constants";
import {
  applyObstacleHit,
  createGameState,
  createRng,
  finishGame,
  movePlayer,
  stepGame,
  type NewPlayer,
} from "../engine";
import { playerSpawnPoints, zones } from "../map";
import { addScore, buildResults, rankPlayers } from "../scoring";
import type { CharacterKey, GameState } from "../types";

const rng = createRng(42);

function makeState(characters: CharacterKey[] = ["snack_lover"], durationSec = 60): GameState {
  const players: NewPlayer[] = characters.map((c, i) => ({ id: `p${i}`, name: `P${i}`, characterKey: c, isBot: false }));
  const state = createGameState({ roomCode: "1234", durationSec, players, rng: createRng(7) });
  stepGame(state, TUNING.countdownMs, rng);
  expect(state.status).toBe("playing");
  return state;
}

function clearMap(state: GameState) {
  state.snacks = [];
  state.powerUps = [];
  for (const pf of state.prefects) {
    pf.x = -500;
    pf.y = -500;
    pf.pauseMs = 1e9;
  }
}

describe("collision", () => {
  it("allows every spawn point and blocks walls", () => {
    for (const p of playerSpawnPoints) expect(isWalkable(p.x, p.y, TUNING.playerRadius)).toBe(true);
    expect(isWalkable(20, 20, TUNING.playerRadius)).toBe(false);
    // Between classroom and canteen outside the corridor is wall.
    expect(isWalkable(400, 420, TUNING.playerRadius)).toBe(false);
  });

  it("slides along walls and reports penalising obstacles", () => {
    const r = moveWithCollision(80, 235, 0, -10, TUNING.playerRadius);
    expect(r.y).toBe(235);
    const chair = moveWithCollision(505, 335, 10, 0, TUNING.playerRadius);
    expect(chair.hitObstacle?.id).toBe("broken_chair");
  });
});

describe("scoring", () => {
  it("never goes below zero", () => {
    const state = makeState();
    const p = state.players.p0;
    expect(addScore(p, -50)).toBe(0);
    expect(p.score).toBe(0);
  });

  it("ranks by score, then captures, snacks and return", () => {
    const base = { returnedAt: null, returnedToClass: false, snacksCollected: 0, caughtCount: 0 };
    const ranked = rankPlayers([
      { ...base, id: "a", score: 10, caughtCount: 2 },
      { ...base, id: "b", score: 10, caughtCount: 1 },
      { ...base, id: "c", score: 30 },
      { ...base, id: "d", score: 10, caughtCount: 1, snacksCollected: 3 },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["c", "d", "b", "a"]);
  });
});

describe("game rules", () => {
  it("collects snacks with character bonus and double points", () => {
    const state = makeState(["snack_lover"]);
    clearMap(state);
    const p = state.players.p0;
    p.x = 400;
    p.y = 345;
    state.snacks.push({ id: "x", type: "puff_puff", name: "Puff Puff", points: 10, rarity: "uncommon", x: p.x, y: p.y, collected: false, collectedBy: null });
    const events = stepGame(state, 16, rng);
    expect(events.find((e) => e.kind === "snack_collected")).toBeTruthy();
    expect(p.score).toBe(12);
    expect(state.snacks).toHaveLength(0);

    p.doubleMs = 5000;
    state.snacks.push({ id: "y", type: "biscuit", name: "Biscuit", points: 5, rarity: "common", x: p.x, y: p.y, collected: false, collectedBy: null });
    stepGame(state, 16, rng);
    expect(p.score).toBe(12 + 12);
  });

  it("prefect capture penalises and freezes; shield blocks once", () => {
    const state = makeState(["class_captain", "fast_runner"]);
    clearMap(state);
    const captain = state.players.p0;
    const runner = state.players.p1;
    runner.score = 50;
    expect(captain.hasShield).toBe(true);
    const pf = state.prefects[0];
    pf.x = captain.x;
    pf.y = captain.y;
    stepGame(state, 16, rng);
    expect(captain.hasShield).toBe(false);
    expect(captain.caughtCount).toBe(0);

    pf.x = runner.x;
    pf.y = runner.y;
    stepGame(state, 16, rng);
    expect(runner.score).toBe(50 + SCORING.caughtByPrefect);
    expect(runner.isFrozen).toBe(true);
    expect(runner.caughtCount).toBe(1);
    expect(movePlayer(runner, { dx: 1, dy: 0 }, 100).moved).toBe(false);
    // Immune while frozen: no double penalty.
    stepGame(state, 16, rng);
    expect(runner.caughtCount).toBe(1);
  });

  it("gives the return-to-class bonus only once and only after a snack", () => {
    const state = makeState();
    clearMap(state);
    const p = state.players.p0;
    stepGame(state, 16, rng);
    expect(p.returnedToClass).toBe(false);
    p.snacksCollected = 1;
    stepGame(state, 16, rng);
    stepGame(state, 16, rng);
    expect(p.returnedToClass).toBe(true);
    expect(p.score).toBe(SCORING.returnToClassBonus);
  });

  it("speed shoes make players faster", () => {
    const state = makeState(["bookworm", "bookworm"]);
    const [a, b] = [state.players.p0, state.players.p1];
    a.x = b.x = 300;
    a.y = 280;
    b.y = 340;
    b.speedMs = 1000;
    movePlayer(a, { dx: 1, dy: 0 }, 100);
    movePlayer(b, { dx: 1, dy: 0 }, 100);
    expect(b.x - 300).toBeCloseTo((a.x - 300) * TUNING.speedShoesMultiplier, 3);
  });

  it("obstacle hits cost points with a cooldown", () => {
    const state = makeState();
    const p = state.players.p0;
    p.score = 20;
    expect(applyObstacleHit(state, "p0", "broken_chair")).toMatchObject({ penalty: SCORING.hitObstacle });
    expect(applyObstacleHit(state, "p0", "broken_chair")).toBeNull();
    expect(p.score).toBe(15);
  });

  it("applies the bell penalty to players outside class", () => {
    const state = makeState(["fast_runner", "fast_runner"]);
    clearMap(state);
    state.players.p1.x = 700;
    state.players.p1.y = 300;
    state.players.p1.score = 40;
    finishGame(state);
    expect(state.status).toBe("finished");
    expect(state.players.p1.score).toBe(40 + SCORING.outsideClassAtBell);
    expect(state.players.p0.score).toBe(0);
    const results = buildResults("1234", Object.values(state.players), 0);
    expect(results.rows[0].playerId).toBe("p1");
  });

  it("ends when the timer runs out", () => {
    const state = makeState(["fast_runner"], 60);
    for (let t = 0; t < 61_000 && state.status === "playing"; t += 50) stepGame(state, 50, rng);
    expect(state.status).toBe("finished");
  });
});

describe("bots", () => {
  it("routes through doorways", () => {
    const wp = nextWaypoint({ x: 100, y: 300 }, { x: 760, y: 300 });
    expect(wp.x).toBeCloseTo(zones.classroom.x + zones.classroom.width, 0);
  });

  it("play a full match: collect snacks and get back to class", () => {
    const players: NewPlayer[] = [0, 1, 2].map((i) => ({ id: `b${i}`, name: `Bot ${i}`, characterKey: "fast_runner", isBot: true }));
    const r = createRng(3);
    const state = createGameState({ roomCode: "9999", durationSec: 90, players, rng: r });
    const memories = Object.fromEntries(players.map((p) => [p.id, createBotMemory(r)]));
    const dt = 1000 / 30;
    while (state.status !== "finished") {
      for (const p of players) movePlayer(state.players[p.id], botInput(state, state.players[p.id], memories[p.id], dt, r), dt);
      stepGame(state, dt, r);
    }
    const bots = Object.values(state.players);
    expect(bots.reduce((n, b) => n + b.snacksCollected, 0)).toBeGreaterThan(8);
    expect(bots.filter((b) => b.returnedToClass).length).toBeGreaterThanOrEqual(2);
    expect(bots.every((b) => b.score >= 0)).toBe(true);
  });
});
