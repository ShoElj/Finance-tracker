import { solidObstacles, walkableZones, WORLD, type Obstacle, type Zone } from "./map";
import type { Point, Rect } from "./types";

export function rectContainsPoint(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function boxAround(x: number, y: number, half: number): Rect {
  return { x: x - half, y: y - half, width: half * 2, height: half * 2 };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function circlesOverlap(a: Point, ra: number, b: Point, rb: number): boolean {
  return distance(a, b) < ra + rb;
}

/** True when a circle touches a rectangle. */
export function circleRectOverlap(c: Point, radius: number, rect: Rect): boolean {
  const nx = Math.max(rect.x, Math.min(c.x, rect.x + rect.width));
  const ny = Math.max(rect.y, Math.min(c.y, rect.y + rect.height));
  return Math.hypot(c.x - nx, c.y - ny) < radius;
}

function pointWalkable(x: number, y: number, zones: Zone[]): boolean {
  for (const z of zones) if (rectContainsPoint(z, x, y)) return true;
  return false;
}

/**
 * A square body is walkable when all of its corners and its centre are inside the walkable
 * zones and it does not overlap a solid obstacle.
 */
export function isWalkable(x: number, y: number, half: number, zones: Zone[] = walkableZones): Obstacle | boolean {
  if (x - half < 0 || y - half < 0 || x + half > WORLD.width || y + half > WORLD.height) return false;
  const corners: [number, number][] = [
    [x - half, y - half],
    [x + half, y - half],
    [x - half, y + half],
    [x + half, y + half],
    [x, y],
  ];
  for (const [cx, cy] of corners) if (!pointWalkable(cx, cy, zones)) return false;
  const box = boxAround(x, y, half);
  for (const o of solidObstacles) if (rectsIntersect(box, o)) return o;
  return true;
}

export type MoveResult = { x: number; y: number; moved: boolean; hitObstacle: Obstacle | null };

/**
 * Moves a body by (dx, dy), resolving each axis separately so players slide along walls.
 * Reports the first solid obstacle bumped into.
 */
export function moveWithCollision(x: number, y: number, dx: number, dy: number, half: number): MoveResult {
  let hitObstacle: Obstacle | null = null;
  let nx = x;
  let ny = y;

  if (dx !== 0) {
    const r = isWalkable(nx + dx, ny, half);
    if (r === true) nx += dx;
    else if (typeof r === "object") hitObstacle = r;
  }
  if (dy !== 0) {
    const r = isWalkable(nx, ny + dy, half);
    if (r === true) ny += dy;
    else if (typeof r === "object") hitObstacle = hitObstacle ?? r;
  }
  return { x: nx, y: ny, moved: nx !== x || ny !== y, hitObstacle };
}

export function zoneAt(x: number, y: number, zones: Zone[] = walkableZones): Zone | null {
  // Prefer named areas over doorway links when both contain the point.
  let link: Zone | null = null;
  for (const z of zones) {
    if (!rectContainsPoint(z, x, y)) continue;
    if (!z.isLink) return z;
    link = link ?? z;
  }
  return link;
}
