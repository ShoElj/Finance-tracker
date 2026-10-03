export type GameStatus = "waiting" | "countdown" | "playing" | "finished";

export type Direction = "up" | "down" | "left" | "right";

export type CharacterKey =
  | "fast_runner"
  | "snack_lover"
  | "class_captain"
  | "bookworm"
  | "football_boy"
  | "quiet_genius";

export type CharacterAbility =
  | "speed_bonus"
  | "snack_bonus"
  | "starter_shield"
  | "longer_powerups"
  | "quick_recovery"
  | "slow_resistance";

export type Character = {
  key: CharacterKey;
  name: string;
  description: string;
  baseSpeed: number;
  ability: CharacterAbility;
  color: string;
  emoji: string;
};

export type SnackType =
  | "biscuit"
  | "chin_chin"
  | "puff_puff"
  | "zobo"
  | "meat_pie"
  | "indomie"
  | "special_lunch_pack";

export type Rarity = "common" | "uncommon" | "rare" | "special";

export type SnackDefinition = {
  type: SnackType;
  name: string;
  points: number;
  rarity: Rarity;
  emoji: string;
  color: string;
};

export type PowerUpType = "speed_shoes" | "prefect_shield" | "double_points";

export type Point = { x: number; y: number };

export type Rect = { x: number; y: number; width: number; height: number };

export type PlayerState = {
  id: string;
  name: string;
  characterKey: CharacterKey;
  isBot: boolean;
  x: number;
  y: number;
  facing: Direction;
  score: number;
  /** Current movement multiplier (character base speed × active effects). */
  speed: number;
  isFrozen: boolean;
  hasShield: boolean;
  activePowerUps: PowerUpType[];
  returnedToClass: boolean;
  /** Match time (ms since break started) when the player first returned to class. */
  returnedAt: number | null;
  reachedCanteen: boolean;
  snacksCollected: number;
  caughtCount: number;
  // Effect timers in milliseconds remaining. Owned by the host simulation.
  frozenMs: number;
  immuneMs: number;
  speedMs: number;
  doubleMs: number;
  stunMs: number;
  hitCooldownMs: number;
  inRestricted: boolean;
  streak: number;
  lastSnackAt: number | null;
};

export type SnackState = {
  id: string;
  type: SnackType;
  name: string;
  points: number;
  rarity: Rarity;
  x: number;
  y: number;
  collected: boolean;
  collectedBy: string | null;
};

export type PowerUpState = {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  collected: boolean;
};

export type PrefectState = {
  id: string;
  routeKey: string;
  x: number;
  y: number;
  patrolIndex: number;
  /** +1 or -1: ping-pong direction along the patrol route. */
  step: 1 | -1;
  pauseMs: number;
  direction: Direction;
};

export type GameState = {
  roomCode: string;
  status: GameStatus;
  durationMs: number;
  timeRemaining: number;
  countdownMs: number;
  elapsedMs: number;
  players: Record<string, PlayerState>;
  snacks: SnackState[];
  powerUps: PowerUpState[];
  prefects: PrefectState[];
  nextSnackSpawnMs: number;
  nextPowerUpSpawnMs: number;
  idCounter: number;
  startedAt?: number;
  endedAt?: number;
};

/** Things that happened during a simulation step, used for sounds, floating text and the feed. */
export type GameEvent =
  | { kind: "break_bell" }
  | { kind: "final_bell" }
  | { kind: "snack_collected"; playerId: string; snackType: SnackType; points: number; x: number; y: number }
  | { kind: "powerup_collected"; playerId: string; powerUp: PowerUpType; x: number; y: number }
  | { kind: "player_caught"; playerId: string; penalty: number; shielded: boolean; x: number; y: number }
  | { kind: "obstacle_hit"; playerId: string; obstacleId: string; penalty: number; x: number; y: number }
  | { kind: "reached_canteen"; playerId: string; bonus: number }
  | { kind: "returned_to_class"; playerId: string; bonus: number }
  | { kind: "restricted_zone"; playerId: string; penalty: number }
  | { kind: "streak"; playerId: string; bonus: number }
  | { kind: "missed_bell"; playerId: string; penalty: number }
  | { kind: "clean_run"; playerId: string; bonus: number }
  | { kind: "special_spawned"; x: number; y: number };

export type MovementInput = { dx: number; dy: number };

export type ResultRow = {
  rank: number;
  playerId: string;
  name: string;
  characterKey: CharacterKey;
  isBot: boolean;
  score: number;
  snacksCollected: number;
  caughtCount: number;
  returnedToClass: boolean;
};

export type MatchResults = {
  roomCode: string;
  endedAt: number;
  rows: ResultRow[];
};
