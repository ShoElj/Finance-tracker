import type { MapGeometry } from "@/lib/game/collision";
import type { Obstacle, Zone } from "@/lib/game/map";
import type { Point, Rect } from "@/lib/game/types";

export const LIFE_WORLD = { width: 1280, height: 800 } as const;

export type LifeZoneKey =
  | "library"
  | "assembly"
  | "canteen"
  | "corridor"
  | "classroom"
  | "common"
  | "field"
  | "libLink"
  | "asmLink"
  | "canLink"
  | "clsLink"
  | "comLink"
  | "fldLink";

const link = (key: LifeZoneKey, x: number, y: number, width: number, height: number): Zone<LifeZoneKey> => ({
  key,
  x,
  y,
  width,
  height,
  label: null,
  floor: "#d9dee7",
  isLink: true,
});

export const lifeZones: Zone<LifeZoneKey>[] = [
  { key: "library", x: 40, y: 40, width: 320, height: 200, label: "Library", floor: "#ead9bd" },
  { key: "assembly", x: 420, y: 40, width: 440, height: 220, label: "Assembly Ground", floor: "#d6e9c4" },
  { key: "canteen", x: 920, y: 40, width: 320, height: 240, label: "Canteen", floor: "#fde7c8" },
  { key: "corridor", x: 40, y: 310, width: 1200, height: 100, label: "Corridor", floor: "#d9dee7" },
  { key: "classroom", x: 40, y: 480, width: 340, height: 280, label: "Classroom", floor: "#f3d9a4" },
  { key: "common", x: 440, y: 480, width: 260, height: 280, label: "Common Room", floor: "#e5d4f5" },
  { key: "field", x: 760, y: 470, width: 480, height: 290, label: "Sports Field", floor: "#8fd16f" },
  link("libLink", 170, 230, 60, 90),
  link("asmLink", 610, 250, 60, 70),
  link("canLink", 1050, 270, 60, 50),
  link("clsLink", 180, 400, 60, 90),
  link("comLink", 540, 400, 60, 90),
  link("fldLink", 960, 400, 80, 80),
];

const solid = (id: string, label: string, x: number, y: number, width: number, height: number, color: string, emoji?: string): Obstacle => ({
  id,
  label,
  kind: "solid",
  penalizes: false,
  x,
  y,
  width,
  height,
  color,
  emoji,
});

/** Furniture. Solid, but bumping it is harmless in School Life. */
export const lifeFurniture: Obstacle[] = [
  solid("shelf_top", "Bookshelf", 50, 48, 190, 18, "#8b5a2b", "📚"),
  solid("study_table", "Study table", 120, 120, 100, 40, "#a16207"),
  solid("counter", "Canteen counter", 930, 48, 300, 20, "#a16207"),
  solid("canteen_table_1", "Table", 960, 170, 60, 34, "#c2410c"),
  solid("canteen_table_2", "Table", 1120, 170, 60, 34, "#c2410c"),
  solid("flagpole", "Flagpole", 636, 60, 8, 8, "#64748b"),
  solid("tap", "Water tap", 700, 312, 30, 12, "#64748b", "🚰"),
  solid("desk_1", "Desk", 80, 590, 44, 24, "#b45309"),
  solid("desk_2", "Desk", 160, 590, 44, 24, "#b45309"),
  solid("desk_3", "Desk", 240, 590, 44, 24, "#b45309"),
  solid("desk_4", "Desk", 80, 665, 44, 24, "#b45309"),
  solid("desk_5", "Desk", 160, 665, 44, 24, "#b45309"),
  solid("desk_6", "Desk", 240, 665, 44, 24, "#b45309"),
  solid("teacher_desk", "Teacher's desk", 300, 500, 70, 28, "#78350f"),
  solid("sofa", "Sofa", 460, 715, 130, 30, "#7c3aed", "🛋️"),
  solid("ludo_table", "Games table", 600, 550, 60, 40, "#0f766e", "🎲"),
];

export const lifeGeometry: MapGeometry = { zones: lifeZones, solids: lifeFurniture, world: LIFE_WORLD };

/** Things drawn on the map that do not block movement. */
export type Decoration = Rect & { kind: "goal" | "pitch" | "board" | "rug" | "flag"; color: string };

export const lifeDecorations: Decoration[] = [
  { kind: "pitch", x: 790, y: 500, width: 420, height: 230, color: "#ffffff" },
  { kind: "goal", x: 776, y: 585, width: 14, height: 60, color: "#ffffff" },
  { kind: "goal", x: 1210, y: 585, width: 14, height: 60, color: "#ffffff" },
  { kind: "board", x: 44, y: 540, width: 8, height: 140, color: "#14532d" },
  { kind: "board", x: 380, y: 314, width: 70, height: 10, color: "#b45309" },
  { kind: "rug", x: 470, y: 600, width: 110, height: 90, color: "#c4b5fd" },
  { kind: "flag", x: 640, y: 40, width: 30, height: 18, color: "#16a34a" },
];

/** A place where a student can do an activity. */
export type Spot = Point & { id: string; activity: string; radius: number; label: string };

export const lifeSpots: Spot[] = [
  { id: "assembly", activity: "assembly", x: 640, y: 170, radius: 150, label: "Assembly" },
  { id: "lesson", activity: "attend_lesson", x: 200, y: 640, radius: 150, label: "Classroom" },
  { id: "study", activity: "study", x: 170, y: 190, radius: 70, label: "Study table" },
  { id: "comics", activity: "read_comics", x: 300, y: 100, radius: 60, label: "Comics shelf" },
  { id: "meal", activity: "buy_meal", x: 1000, y: 110, radius: 60, label: "Food counter" },
  { id: "snack", activity: "buy_snack", x: 1170, y: 110, radius: 60, label: "Snack counter" },
  { id: "water", activity: "drink_water", x: 715, y: 345, radius: 45, label: "Water tap" },
  { id: "football", activity: "play_football", x: 1000, y: 615, radius: 200, label: "Football pitch" },
  { id: "rest", activity: "rest", x: 525, y: 680, radius: 70, label: "Sofa" },
  { id: "ludo", activity: "board_games", x: 630, y: 625, radius: 60, label: "Games table" },
];

export const LIFE_SPAWN: Point = { x: 640, y: 360 };
