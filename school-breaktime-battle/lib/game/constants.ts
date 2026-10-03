import type { PowerUpType, Rarity, SnackDefinition } from "./types";

export const snacks: SnackDefinition[] = [
  { type: "biscuit", name: "Biscuit", points: 5, rarity: "common", emoji: "🍪", color: "#d6a35c" },
  { type: "chin_chin", name: "Chin Chin", points: 8, rarity: "common", emoji: "🥨", color: "#e0b26b" },
  { type: "puff_puff", name: "Puff Puff", points: 10, rarity: "uncommon", emoji: "🍩", color: "#c9822f" },
  { type: "zobo", name: "Zobo", points: 12, rarity: "uncommon", emoji: "🥤", color: "#b91c5c" },
  { type: "meat_pie", name: "Meat Pie", points: 20, rarity: "rare", emoji: "🥧", color: "#b45309" },
  { type: "indomie", name: "Indomie Bowl", points: 30, rarity: "rare", emoji: "🍜", color: "#eab308" },
  {
    type: "special_lunch_pack",
    name: "Special Lunch Pack",
    points: 50,
    rarity: "special",
    emoji: "🍱",
    color: "#16a34a",
  },
];

/** Relative chance of each rarity when a snack spawns. */
export const rarityWeights: Record<Rarity, number> = {
  common: 50,
  uncommon: 30,
  rare: 16,
  special: 4,
};

export const powerUps: Record<PowerUpType, { name: string; description: string; emoji: string; color: string; durationMs: number }> = {
  speed_shoes: {
    name: "Speed Shoes",
    description: "Move faster for 5 seconds.",
    emoji: "👟",
    color: "#22c55e",
    durationMs: 5000,
  },
  prefect_shield: {
    name: "Prefect Shield",
    description: "Blocks one prefect capture.",
    emoji: "🛡️",
    color: "#3b82f6",
    durationMs: 0,
  },
  double_points: {
    name: "Double Points",
    description: "Snacks give double points for 8 seconds.",
    emoji: "✨",
    color: "#facc15",
    durationMs: 8000,
  },
};

export const SCORING = {
  returnToClassBonus: 25,
  caughtByPrefect: -20,
  hitObstacle: -5,
  outsideClassAtBell: -30,
  // Extra score sources from the design brief, kept small so the main table dominates.
  reachedCanteenBonus: 5,
  restrictedZone: -10,
  streakBonus: 5,
  streakLength: 3,
  streakWindowMs: 4000,
  cleanRunBonus: 10,
  snackLoverBonus: 2,
} as const;

export const TUNING = {
  baseSpeed: 150,
  playerRadius: 12,
  itemRadius: 11,
  prefectRadius: 14,
  speedShoesMultiplier: 1.5,
  slowZoneMultiplier: 0.5,
  slowResistantMultiplier: 0.75,
  stunMs: 700,
  quickRecoveryStunMs: 300,
  stunSpeedMultiplier: 0.45,
  frozenMs: 2000,
  /** Grace period after a capture so the prefect cannot catch the same player again straight away. */
  postCaptureImmunityMs: 3500,
  obstacleHitCooldownMs: 1200,
  longerPowerUpsMultiplier: 1.3,
  botSpeedMultiplier: 0.88,
  countdownMs: 3000,
  targetSnackCount: 14,
  snackRespawnMs: 2500,
  maxPowerUps: 2,
  powerUpRespawnMs: 9000,
  firstPowerUpMs: 4000,
  specialMinElapsedRatio: 0.25,
} as const;

export const MATCH_DURATIONS = [60, 120, 180] as const;
export const DEFAULT_MATCH_DURATION = 120;
export const MAX_PLAYERS = 8;
export const MAX_BOTS = 3;

export const REACTIONS = [
  "Run",
  "Bell is ringing",
  "Good move",
  "I am winning",
  "Prefect is coming",
  "Wait for me",
  "Nice one",
  "You caught me",
  "Back to class",
] as const;

export type Reaction = (typeof REACTIONS)[number];

export const REACTION_COOLDOWN_MS = 1500;
export const REACTION_DISPLAY_MS = 2500;

export function getSnackDefinition(type: string): SnackDefinition {
  return snacks.find((s) => s.type === type) ?? snacks[0];
}
