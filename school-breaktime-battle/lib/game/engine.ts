/**
 * Pure Canteen Rush simulation. It has no knowledge of Phaser, React or the network, so the
 * host, the demo bots and the tests all drive the exact same rules.
 */
import { getCharacter } from "./characters";
import { circleRectOverlap, circlesOverlap, isWalkable, moveWithCollision, rectContainsPoint, zoneAt } from "./collision";
import { powerUps as powerUpDefs, rarityWeights, SCORING, snacks as snackDefs, TUNING } from "./constants";
import {
  obstacles,
  playerSpawnPoints,
  powerUpSpawnPoints,
  prefectRoutes,
  returnZone,
  slowObstacles,
  snackSpawnAreas,
  solidObstacles,
} from "./map";
import { addScore, snackPoints } from "./scoring";
import type {
  CharacterKey,
  Direction,
  GameEvent,
  GameState,
  MovementInput,
  PlayerState,
  PowerUpType,
  PrefectState,
  Rarity,
  SnackState,
} from "./types";

export type Rng = () => number;

/** Small deterministic PRNG (mulberry32) so matches and tests are reproducible. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type NewPlayer = { id: string; name: string; characterKey: CharacterKey; isBot: boolean };

export function createPlayerState(p: NewPlayer, index: number): PlayerState {
  const spawn = playerSpawnPoints[index % playerSpawnPoints.length];
  const character = getCharacter(p.characterKey);
  return {
    id: p.id,
    name: p.name,
    characterKey: character.key,
    isBot: p.isBot,
    x: spawn.x,
    y: spawn.y,
    facing: "right",
    score: 0,
    speed: character.baseSpeed,
    isFrozen: false,
    hasShield: character.ability === "starter_shield",
    activePowerUps: [],
    returnedToClass: false,
    returnedAt: null,
    reachedCanteen: false,
    snacksCollected: 0,
    caughtCount: 0,
    frozenMs: 0,
    immuneMs: 0,
    speedMs: 0,
    doubleMs: 0,
    stunMs: 0,
    hitCooldownMs: 0,
    inRestricted: false,
    streak: 0,
    lastSnackAt: null,
  };
}

export function createGameState(opts: {
  roomCode: string;
  durationSec: number;
  players: NewPlayer[];
  rng: Rng;
}): GameState {
  const state: GameState = {
    roomCode: opts.roomCode,
    status: "countdown",
    durationMs: opts.durationSec * 1000,
    timeRemaining: opts.durationSec * 1000,
    countdownMs: TUNING.countdownMs,
    elapsedMs: 0,
    players: {},
    snacks: [],
    powerUps: [],
    prefects: [],
    nextSnackSpawnMs: TUNING.snackRespawnMs,
    nextPowerUpSpawnMs: TUNING.firstPowerUpMs,
    idCounter: 0,
  };
  opts.players.forEach((p, i) => {
    state.players[p.id] = createPlayerState(p, i);
  });
  for (const [routeKey, route] of Object.entries(prefectRoutes)) {
    state.prefects.push({
      id: `prefect-${routeKey}`,
      routeKey,
      x: route.points[0].x,
      y: route.points[0].y,
      patrolIndex: 1,
      step: 1,
      pauseMs: route.pausesMs[0],
      direction: "right",
    });
  }
  for (let i = 0; i < TUNING.targetSnackCount; i++) spawnSnack(state, opts.rng, { allowSpecial: false });
  return state;
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

function insideSlowZone(x: number, y: number): boolean {
  return slowObstacles.some((o) => rectContainsPoint(o, x, y));
}

/** Effective movement multiplier for a player at its current position. */
export function speedMultiplier(player: PlayerState): number {
  if (player.frozenMs > 0) return 0;
  const character = getCharacter(player.characterKey);
  let m = character.baseSpeed;
  if (player.speedMs > 0) m *= TUNING.speedShoesMultiplier;
  if (insideSlowZone(player.x, player.y)) {
    m *= character.ability === "slow_resistance" ? TUNING.slowResistantMultiplier : TUNING.slowZoneMultiplier;
  }
  if (player.stunMs > 0) m *= TUNING.stunSpeedMultiplier;
  if (player.isBot) m *= TUNING.botSpeedMultiplier;
  return m;
}

function directionOf(dx: number, dy: number, fallback: Direction): Direction {
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

export type PlayerMoveResult = { moved: boolean; hitObstacleId: string | null };

/** Moves one player according to its input. Used by whichever browser controls that player. */
export function movePlayer(player: PlayerState, input: MovementInput, dtMs: number): PlayerMoveResult {
  let { dx, dy } = input;
  const len = Math.hypot(dx, dy);
  if (len === 0 || player.frozenMs > 0) return { moved: false, hitObstacleId: null };
  if (len > 1) {
    dx /= len;
    dy /= len;
  }
  const distancePx = TUNING.baseSpeed * speedMultiplier(player) * (dtMs / 1000);
  const r = moveWithCollision(player.x, player.y, dx * distancePx, dy * distancePx, TUNING.playerRadius);
  player.x = r.x;
  player.y = r.y;
  player.facing = directionOf(dx, dy, player.facing);
  const hit = r.hitObstacle && r.hitObstacle.penalizes ? r.hitObstacle.id : null;
  return { moved: r.moved, hitObstacleId: hit };
}

/**
 * Applies the penalty for bumping a solid obstacle. Host only. Returns null while the
 * player is still on cooldown from a previous bump.
 */
export function applyObstacleHit(state: GameState, playerId: string, obstacleId: string): GameEvent | null {
  const player = state.players[playerId];
  const obstacle = obstacles.find((o) => o.id === obstacleId && o.penalizes);
  if (!player || !obstacle || state.status !== "playing" || player.hitCooldownMs > 0) return null;
  const quick = getCharacter(player.characterKey).ability === "quick_recovery";
  player.stunMs = quick ? TUNING.quickRecoveryStunMs : TUNING.stunMs;
  player.hitCooldownMs = TUNING.obstacleHitCooldownMs;
  const penalty = addScore(player, SCORING.hitObstacle);
  refreshDerived(player);
  return { kind: "obstacle_hit", playerId, obstacleId, penalty, x: player.x, y: player.y };
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------

function nextId(state: GameState, prefix: string): string {
  state.idCounter += 1;
  return `${prefix}${state.idCounter}`;
}

function pickWeighted<T>(items: { item: T; weight: number }[], rng: Rng): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = rng() * total;
  for (const i of items) {
    roll -= i.weight;
    if (roll < 0) return i.item;
  }
  return items[items.length - 1].item;
}

function spotIsFree(state: GameState, x: number, y: number): boolean {
  if (isWalkable(x, y, TUNING.itemRadius) !== true) return false;
  if (solidObstacles.some((o) => circleRectOverlap({ x, y }, TUNING.itemRadius + 4, o))) return false;
  const minGap = TUNING.itemRadius * 2 + 6;
  for (const s of state.snacks) if (!s.collected && Math.hypot(s.x - x, s.y - y) < minGap) return false;
  for (const p of state.powerUps) if (!p.collected && Math.hypot(p.x - x, p.y - y) < minGap) return false;
  return true;
}

export function spawnSnack(state: GameState, rng: Rng, opts: { allowSpecial: boolean }): SnackState | null {
  const hasSpecial = state.snacks.some((s) => s.rarity === "special" && !s.collected);
  const weights = (Object.keys(rarityWeights) as Rarity[])
    .filter((r) => r !== "special" || (opts.allowSpecial && !hasSpecial))
    .map((r) => ({ item: r, weight: rarityWeights[r] }));
  const rarity = pickWeighted(weights, rng);
  const options = snackDefs.filter((s) => s.rarity === rarity);
  const def = options[Math.floor(rng() * options.length)];

  for (let attempt = 0; attempt < 25; attempt++) {
    const area = pickWeighted(
      snackSpawnAreas.map((a) => ({ item: a.area, weight: a.weight })),
      rng,
    );
    const x = Math.round(area.x + TUNING.itemRadius + rng() * (area.width - TUNING.itemRadius * 2));
    const y = Math.round(area.y + TUNING.itemRadius + rng() * (area.height - TUNING.itemRadius * 2));
    if (!spotIsFree(state, x, y)) continue;
    const snack: SnackState = {
      id: nextId(state, "s"),
      type: def.type,
      name: def.name,
      points: def.points,
      rarity: def.rarity,
      x,
      y,
      collected: false,
      collectedBy: null,
    };
    state.snacks.push(snack);
    return snack;
  }
  return null;
}

export function spawnPowerUp(state: GameState, rng: Rng): boolean {
  const free = powerUpSpawnPoints.filter((p) => spotIsFree(state, p.x, p.y));
  if (free.length === 0) return false;
  const spot = free[Math.floor(rng() * free.length)];
  const types = Object.keys(powerUpDefs) as PowerUpType[];
  state.powerUps.push({
    id: nextId(state, "p"),
    type: types[Math.floor(rng() * types.length)],
    x: spot.x,
    y: spot.y,
    collected: false,
  });
  return true;
}

// ---------------------------------------------------------------------------
// Prefects
// ---------------------------------------------------------------------------

function updatePrefect(prefect: PrefectState, dtMs: number): void {
  const route = prefectRoutes[prefect.routeKey];
  if (!route) return;
  if (prefect.pauseMs > 0) {
    prefect.pauseMs = Math.max(0, prefect.pauseMs - dtMs);
    return;
  }
  const target = route.points[prefect.patrolIndex];
  const dx = target.x - prefect.x;
  const dy = target.y - prefect.y;
  const dist = Math.hypot(dx, dy);
  const stepPx = route.speed * (dtMs / 1000);
  prefect.direction = directionOf(dx, dy, prefect.direction);
  if (dist <= stepPx) {
    prefect.x = target.x;
    prefect.y = target.y;
    prefect.pauseMs = route.pausesMs[prefect.patrolIndex] ?? 0;
    const last = route.points.length - 1;
    if (prefect.patrolIndex === last) prefect.step = -1;
    else if (prefect.patrolIndex === 0) prefect.step = 1;
    prefect.patrolIndex += prefect.step;
  } else {
    prefect.x += (dx / dist) * stepPx;
    prefect.y += (dy / dist) * stepPx;
  }
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function powerUpDuration(player: PlayerState, type: PowerUpType): number {
  const base = powerUpDefs[type].durationMs;
  return getCharacter(player.characterKey).ability === "longer_powerups"
    ? Math.round(base * TUNING.longerPowerUpsMultiplier)
    : base;
}

/** Keeps the convenience fields (isFrozen, speed, activePowerUps) in sync with the timers. */
export function refreshDerived(player: PlayerState): void {
  player.isFrozen = player.frozenMs > 0;
  player.speed = Number(speedMultiplier(player).toFixed(2));
  const active: PowerUpType[] = [];
  if (player.speedMs > 0) active.push("speed_shoes");
  if (player.doubleMs > 0) active.push("double_points");
  if (player.hasShield) active.push("prefect_shield");
  player.activePowerUps = active;
}

function tickTimers(player: PlayerState, dtMs: number): void {
  player.frozenMs = Math.max(0, player.frozenMs - dtMs);
  player.immuneMs = Math.max(0, player.immuneMs - dtMs);
  player.speedMs = Math.max(0, player.speedMs - dtMs);
  player.doubleMs = Math.max(0, player.doubleMs - dtMs);
  player.stunMs = Math.max(0, player.stunMs - dtMs);
  player.hitCooldownMs = Math.max(0, player.hitCooldownMs - dtMs);
}

function resolvePlayer(state: GameState, player: PlayerState, events: GameEvent[]): void {
  const pos = { x: player.x, y: player.y };
  const reach = TUNING.playerRadius + TUNING.itemRadius;

  if (player.frozenMs <= 0) {
    for (const snack of state.snacks) {
      if (snack.collected || !circlesOverlap(pos, reach, snack, 0)) continue;
      snack.collected = true;
      snack.collectedBy = player.id;
      const points = addScore(player, snackPoints(player, snack.points));
      player.snacksCollected += 1;
      const withinStreak =
        player.lastSnackAt !== null && state.elapsedMs - player.lastSnackAt <= SCORING.streakWindowMs;
      player.streak = withinStreak ? player.streak + 1 : 1;
      player.lastSnackAt = state.elapsedMs;
      events.push({ kind: "snack_collected", playerId: player.id, snackType: snack.type, points, x: snack.x, y: snack.y });
      if (player.streak % SCORING.streakLength === 0) {
        events.push({ kind: "streak", playerId: player.id, bonus: addScore(player, SCORING.streakBonus) });
      }
    }

    for (const pu of state.powerUps) {
      if (pu.collected || !circlesOverlap(pos, reach, pu, 0)) continue;
      pu.collected = true;
      if (pu.type === "prefect_shield") player.hasShield = true;
      if (pu.type === "speed_shoes") player.speedMs = powerUpDuration(player, pu.type);
      if (pu.type === "double_points") player.doubleMs = powerUpDuration(player, pu.type);
      events.push({ kind: "powerup_collected", playerId: player.id, powerUp: pu.type, x: pu.x, y: pu.y });
    }

    if (player.immuneMs <= 0) {
      const prefect = state.prefects.find((pf) =>
        circlesOverlap(pos, TUNING.playerRadius, pf, TUNING.prefectRadius - 2),
      );
      if (prefect) {
        if (player.hasShield) {
          player.hasShield = false;
          player.immuneMs = 1500;
          events.push({ kind: "player_caught", playerId: player.id, penalty: 0, shielded: true, x: player.x, y: player.y });
        } else {
          const penalty = addScore(player, SCORING.caughtByPrefect);
          player.frozenMs = TUNING.frozenMs;
          player.immuneMs = TUNING.frozenMs + TUNING.postCaptureImmunityMs;
          player.caughtCount += 1;
          player.streak = 0;
          events.push({ kind: "player_caught", playerId: player.id, penalty, shielded: false, x: player.x, y: player.y });
        }
      }
    }
  }

  const zone = zoneAt(player.x, player.y);
  if (zone?.key === "canteen" && !player.reachedCanteen) {
    player.reachedCanteen = true;
    events.push({ kind: "reached_canteen", playerId: player.id, bonus: addScore(player, SCORING.reachedCanteenBonus) });
  }
  if (zone?.key === "classroom" && !player.returnedToClass && player.snacksCollected > 0) {
    player.returnedToClass = true;
    player.returnedAt = state.elapsedMs;
    events.push({ kind: "returned_to_class", playerId: player.id, bonus: addScore(player, SCORING.returnToClassBonus) });
  }
  const restricted = Boolean(zone?.restricted);
  if (restricted && !player.inRestricted) {
    events.push({ kind: "restricted_zone", playerId: player.id, penalty: addScore(player, SCORING.restrictedZone) });
  }
  player.inRestricted = restricted;
}

export function isInClassroom(player: Pick<PlayerState, "x" | "y">): boolean {
  return rectContainsPoint(returnZone, player.x, player.y);
}

/** Rings the final bell: applies end-of-match penalties/bonuses and marks the match finished. */
export function finishGame(state: GameState, now: number = Date.now()): GameEvent[] {
  if (state.status === "finished") return [];
  const events: GameEvent[] = [{ kind: "final_bell" }];
  for (const player of Object.values(state.players)) {
    if (!isInClassroom(player)) {
      events.push({ kind: "missed_bell", playerId: player.id, penalty: addScore(player, SCORING.outsideClassAtBell) });
    }
    if (player.caughtCount === 0 && player.snacksCollected > 0) {
      events.push({ kind: "clean_run", playerId: player.id, bonus: addScore(player, SCORING.cleanRunBonus) });
    }
    player.frozenMs = 0;
    player.speedMs = 0;
    player.doubleMs = 0;
    player.stunMs = 0;
    refreshDerived(player);
  }
  state.timeRemaining = 0;
  state.status = "finished";
  state.endedAt = now;
  return events;
}

/** Advances the host simulation by dtMs. Player movement is applied separately via movePlayer. */
export function stepGame(state: GameState, dtMs: number, rng: Rng, now: number = Date.now()): GameEvent[] {
  const events: GameEvent[] = [];

  if (state.status === "countdown") {
    state.countdownMs = Math.max(0, state.countdownMs - dtMs);
    if (state.countdownMs === 0) {
      state.status = "playing";
      state.startedAt = now;
      events.push({ kind: "break_bell" });
    }
    return events;
  }
  if (state.status !== "playing") return events;

  state.elapsedMs += dtMs;
  state.timeRemaining = Math.max(0, state.timeRemaining - dtMs);

  for (const prefect of state.prefects) updatePrefect(prefect, dtMs);

  for (const player of Object.values(state.players)) {
    tickTimers(player, dtMs);
    resolvePlayer(state, player, events);
    refreshDerived(player);
  }

  state.snacks = state.snacks.filter((s) => !s.collected);
  state.powerUps = state.powerUps.filter((p) => !p.collected);

  state.nextSnackSpawnMs -= dtMs;
  if (state.nextSnackSpawnMs <= 0) {
    state.nextSnackSpawnMs = TUNING.snackRespawnMs;
    if (state.snacks.length < TUNING.targetSnackCount) {
      const allowSpecial = state.elapsedMs >= state.durationMs * TUNING.specialMinElapsedRatio;
      const snack = spawnSnack(state, rng, { allowSpecial });
      if (snack?.rarity === "special") events.push({ kind: "special_spawned", x: snack.x, y: snack.y });
    }
  }

  state.nextPowerUpSpawnMs -= dtMs;
  if (state.nextPowerUpSpawnMs <= 0) {
    state.nextPowerUpSpawnMs = TUNING.powerUpRespawnMs;
    if (state.powerUps.length < TUNING.maxPowerUps) spawnPowerUp(state, rng);
  }

  if (state.timeRemaining <= 0) events.push(...finishGame(state, now));
  return events;
}
