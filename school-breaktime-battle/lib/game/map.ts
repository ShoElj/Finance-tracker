import type { Point, Rect } from "./types";

export const WORLD = { width: 960, height: 640 } as const;

export type ZoneKey =
  | "classroom"
  | "corridor"
  | "canteen"
  | "waterTap"
  | "openSpace"
  | "staffRoom"
  | "canteenDoor"
  | "waterLink"
  | "openLink"
  | "staffLink";

export type Zone<K extends string = ZoneKey> = Rect & {
  key: K;
  label: string | null;
  floor: string;
  /** Doorways/links are walkable but not named areas. */
  isLink?: boolean;
  restricted?: boolean;
};

/**
 * Walkable areas of the school. A player may stand anywhere inside the union of these
 * rectangles; everything else is wall. Links are the doorways joining the named areas.
 */
export const zones: Record<ZoneKey, Zone> = {
  classroom: { key: "classroom", x: 40, y: 220, width: 220, height: 180, label: "Classroom", floor: "#f3d9a4" },
  corridor: { key: "corridor", x: 260, y: 260, width: 380, height: 100, label: "Corridor", floor: "#d9dee7" },
  canteen: { key: "canteen", x: 650, y: 180, width: 240, height: 240, label: "Canteen", floor: "#fde7c8" },
  waterTap: { key: "waterTap", x: 520, y: 420, width: 160, height: 100, label: "Water Tap", floor: "#cfe8f5" },
  openSpace: { key: "openSpace", x: 300, y: 60, width: 300, height: 150, label: "Open Space", floor: "#b9e4a5" },
  staffRoom: {
    key: "staffRoom",
    x: 620,
    y: 70,
    width: 110,
    height: 90,
    label: "Staff Room",
    floor: "#e5d4f5",
    restricted: true,
  },
  canteenDoor: { key: "canteenDoor", x: 630, y: 270, width: 30, height: 80, label: null, floor: "#d9dee7", isLink: true },
  waterLink: { key: "waterLink", x: 560, y: 350, width: 60, height: 80, label: null, floor: "#d9dee7", isLink: true },
  openLink: { key: "openLink", x: 420, y: 200, width: 60, height: 70, label: null, floor: "#d9dee7", isLink: true },
  staffLink: { key: "staffLink", x: 590, y: 95, width: 40, height: 40, label: null, floor: "#e5d4f5", isLink: true },
};

export const walkableZones: Zone[] = Object.values(zones);

/** The zone players must be in when the final bell rings. */
export const returnZone: Rect = zones.classroom;

export type ObstacleKind = "slow" | "solid";

export type Obstacle = Rect & {
  id: string;
  label: string;
  kind: ObstacleKind;
  /** Solid obstacles with a penalty cost points when bumped. */
  penalizes: boolean;
  color: string;
  emoji?: string;
};

export const obstacles: Obstacle[] = [
  {
    id: "spilled_water",
    label: "Spilled water",
    kind: "slow",
    penalizes: false,
    x: 370,
    y: 280,
    width: 56,
    height: 44,
    color: "#7cc4f0",
    emoji: "💧",
  },
  {
    id: "broken_chair",
    label: "Broken chair",
    kind: "solid",
    penalizes: true,
    x: 520,
    y: 322,
    width: 26,
    height: 26,
    color: "#8b5a2b",
    emoji: "🪑",
  },
  {
    id: "crowd_zone",
    label: "Crowd",
    kind: "slow",
    penalizes: false,
    x: 700,
    y: 300,
    width: 80,
    height: 70,
    color: "#fbbf77",
    emoji: "👥",
  },
  {
    id: "school_bag",
    label: "School bag",
    kind: "solid",
    penalizes: true,
    x: 420,
    y: 120,
    width: 28,
    height: 22,
    color: "#7c3aed",
    emoji: "🎒",
  },
  {
    id: "blocked_path",
    label: "Blocked",
    kind: "solid",
    penalizes: true,
    x: 600,
    y: 462,
    width: 44,
    height: 22,
    color: "#f59e0b",
    emoji: "🚧",
  },
  {
    id: "canteen_counter",
    label: "Counter",
    kind: "solid",
    penalizes: false,
    x: 662,
    y: 184,
    width: 216,
    height: 18,
    color: "#a16207",
  },
  {
    id: "water_tap",
    label: "Tap",
    kind: "solid",
    penalizes: false,
    x: 540,
    y: 500,
    width: 50,
    height: 16,
    color: "#64748b",
    emoji: "🚰",
  },
];

export const solidObstacles = obstacles.filter((o) => o.kind === "solid");
export const slowObstacles = obstacles.filter((o) => o.kind === "slow");

export const playerSpawnPoints: Point[] = [
  { x: 80, y: 260 },
  { x: 120, y: 260 },
  { x: 160, y: 260 },
  { x: 200, y: 260 },
  { x: 80, y: 330 },
  { x: 120, y: 330 },
  { x: 160, y: 330 },
  { x: 200, y: 330 },
];

export const snackSpawnArea: Rect = { x: 670, y: 210, width: 200, height: 180 };

/** Snacks mainly spawn in the canteen, with a few treats elsewhere. */
export const snackSpawnAreas: { area: Rect; weight: number }[] = [
  { area: snackSpawnArea, weight: 10 },
  { area: { x: 535, y: 432, width: 130, height: 56 }, weight: 2 },
  { area: { x: 320, y: 80, width: 260, height: 110 }, weight: 1 },
];

export const powerUpSpawnPoints: Point[] = [
  { x: 350, y: 150 },
  { x: 560, y: 90 },
  { x: 548, y: 450 },
  { x: 865, y: 400 },
  { x: 300, y: 335 },
];

export type PatrolRoute = { points: Point[]; pausesMs: number[]; speed: number };

export const prefectRoutes: Record<string, PatrolRoute> = {
  corridor: {
    // Corridor → canteen entrance, pause, then back toward the classroom corridor.
    points: [
      { x: 320, y: 300 },
      { x: 470, y: 322 },
      { x: 600, y: 298 },
    ],
    pausesMs: [2000, 300, 2000],
    speed: 70,
  },
  openSpace: {
    points: [
      { x: 330, y: 92 },
      { x: 570, y: 92 },
      { x: 570, y: 182 },
      { x: 330, y: 182 },
    ],
    pausesMs: [900, 900, 900, 900],
    speed: 55,
  },
};
