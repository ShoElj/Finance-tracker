/** Simple demo bots: wander to snacks, dodge prefects and head back to class in time. */
import { rectContainsPoint } from "./collision";
import type { Rng } from "./engine";
import { returnZone, walkableZones, type Zone, type ZoneKey } from "./map";
import type { GameState, MovementInput, PlayerState, Point } from "./types";

const navZones: Zone[] = walkableZones.filter((z) => !z.restricted && z.key !== "staffLink");

function overlapCenter(a: Zone, b: Zone): Point | null {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x1 > x2 || y1 > y2) return null;
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

const doors = new Map<string, Point>();
const neighbours = new Map<ZoneKey, ZoneKey[]>();
for (const a of navZones) {
  neighbours.set(a.key, []);
  for (const b of navZones) {
    if (a === b) continue;
    const door = overlapCenter(a, b);
    if (!door) continue;
    doors.set(`${a.key}|${b.key}`, door);
    neighbours.get(a.key)!.push(b.key);
  }
}

function zonesAt(p: Point): ZoneKey[] {
  return navZones.filter((z) => rectContainsPoint(z, p.x, p.y)).map((z) => z.key);
}

/** Next point to walk toward on the way from `from` to `to`, routing through doorways. */
export function nextWaypoint(from: Point, to: Point): Point {
  const start = zonesAt(from);
  const goal = new Set(zonesAt(to));
  if (start.length === 0 || goal.size === 0 || start.some((z) => goal.has(z))) return to;

  const previous = new Map<ZoneKey, ZoneKey | null>();
  const queue: ZoneKey[] = [];
  for (const z of start) {
    previous.set(z, null);
    queue.push(z);
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (goal.has(current)) {
      // Walk back to find the first step out of the starting zone.
      let step = current;
      let prev = previous.get(step) ?? null;
      while (prev !== null && previous.get(prev) !== null) {
        step = prev;
        prev = previous.get(step) ?? null;
      }
      if (prev === null) return to;
      return doors.get(`${prev}|${step}`) ?? to;
    }
    for (const n of neighbours.get(current) ?? []) {
      if (previous.has(n)) continue;
      previous.set(n, current);
      queue.push(n);
    }
  }
  return to;
}

export type BotMemory = {
  mode: "collect" | "return";
  target: Point | null;
  targetId: string | null;
  decideInMs: number;
  snackGoal: number;
  snacksAtLastReturn: number;
  /** Bot heads home for good once less than this much time remains. */
  returnAtMs: number;
  classSpot: Point;
  lastPos: Point;
  stuckMs: number;
  jitter: { dx: number; dy: number; ms: number };
};

export function createBotMemory(rng: Rng): BotMemory {
  return {
    mode: "collect",
    target: null,
    targetId: null,
    decideInMs: 0,
    snackGoal: 3 + Math.floor(rng() * 4),
    snacksAtLastReturn: 0,
    returnAtMs: 14000 + Math.floor(rng() * 8000),
    classSpot: {
      x: returnZone.x + 50 + rng() * (returnZone.width - 100),
      y: returnZone.y + 50 + rng() * (returnZone.height - 100),
    },
    lastPos: { x: 0, y: 0 },
    stuckMs: 0,
    jitter: { dx: 0, dy: 0, ms: 0 },
  };
}

function inClassroom(p: Point): boolean {
  return rectContainsPoint(returnZone, p.x, p.y);
}

function decide(state: GameState, bot: PlayerState, mem: BotMemory, rng: Rng): void {
  const late = state.timeRemaining < mem.returnAtMs;
  const collectedThisTrip = bot.snacksCollected - mem.snacksAtLastReturn;

  if (mem.mode === "collect" && (late || collectedThisTrip >= mem.snackGoal)) mem.mode = "return";
  if (mem.mode === "return" && !late && inClassroom(bot) && bot.returnedToClass) {
    // Back in class with plenty of time left: go out for another trip.
    mem.mode = "collect";
    mem.snacksAtLastReturn = bot.snacksCollected;
    mem.snackGoal = 2 + Math.floor(rng() * 4);
  }

  if (mem.mode === "return") {
    mem.target = mem.classSpot;
    mem.targetId = null;
    return;
  }

  const candidates = [
    ...state.snacks.map((s) => ({ id: s.id, x: s.x, y: s.y, value: s.points })),
    ...state.powerUps.map((p) => ({ id: p.id, x: p.x, y: p.y, value: 15 })),
  ]
    .map((c) => ({ ...c, cost: Math.hypot(c.x - bot.x, c.y - bot.y) - c.value * 2 }))
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 3);

  if (candidates.length === 0) {
    mem.target = { x: 760, y: 300 };
    mem.targetId = null;
    return;
  }
  const pick = candidates[Math.floor(rng() * candidates.length * rng())] ?? candidates[0];
  mem.target = { x: pick.x, y: pick.y };
  mem.targetId = pick.id;
}

function targetStillExists(state: GameState, id: string | null): boolean {
  if (!id) return true;
  return state.snacks.some((s) => s.id === id) || state.powerUps.some((p) => p.id === id);
}

/** Produces the movement input for one bot this frame. */
export function botInput(state: GameState, bot: PlayerState, mem: BotMemory, dtMs: number, rng: Rng): MovementInput {
  if (state.status !== "playing" || bot.frozenMs > 0) return { dx: 0, dy: 0 };

  mem.decideInMs -= dtMs;
  if (mem.decideInMs <= 0 || !mem.target || !targetStillExists(state, mem.targetId)) {
    decide(state, bot, mem, rng);
    mem.decideInMs = 400 + rng() * 400;
  }
  if (!mem.target) return { dx: 0, dy: 0 };

  if (mem.jitter.ms > 0) {
    mem.jitter.ms -= dtMs;
    return { dx: mem.jitter.dx, dy: mem.jitter.dy };
  }

  const waypoint = nextWaypoint(bot, mem.target);
  let dx = waypoint.x - bot.x;
  let dy = waypoint.y - bot.y;
  const dist = Math.hypot(dx, dy);
  if (mem.mode === "return" && dist < 6 && inClassroom(bot)) return { dx: 0, dy: 0 };
  if (dist > 0) {
    dx /= dist;
    dy /= dist;
  }

  // Step away from nearby prefects unless protected.
  if (bot.immuneMs <= 0 && !bot.hasShield) {
    for (const pf of state.prefects) {
      const ax = bot.x - pf.x;
      const ay = bot.y - pf.y;
      const d = Math.hypot(ax, ay);
      if (d > 0 && d < 70) {
        dx += (ax / d) * 1.3;
        dy += (ay / d) * 1.3;
      }
    }
  }

  // Unstick from walls and furniture with a short sideways shuffle.
  const movedPx = Math.hypot(bot.x - mem.lastPos.x, bot.y - mem.lastPos.y);
  mem.lastPos = { x: bot.x, y: bot.y };
  mem.stuckMs = movedPx < 0.3 ? mem.stuckMs + dtMs : 0;
  if (mem.stuckMs > 350) {
    mem.stuckMs = 0;
    const side = rng() < 0.5 ? 1 : -1;
    mem.jitter = { dx: -dy * side, dy: dx * side, ms: 300 + rng() * 200 };
  }

  return { dx, dy };
}
