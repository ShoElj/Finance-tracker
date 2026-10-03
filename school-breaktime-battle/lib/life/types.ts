import type { Look } from "@/lib/game/art/students";
import type { Direction } from "@/lib/game/types";

export type NeedKey = "energy" | "hunger" | "fun" | "social";
export type Needs = Record<NeedKey, number>;

export type CounterKey =
  | "lessons"
  | "study"
  | "meals"
  | "snacks"
  | "football"
  | "greetings"
  | "helped"
  | "assembly"
  | "rest"
  | "friendActs";

export type Counters = Record<CounterKey, number>;

export type GoalProgress = { id: string; done: boolean };

/** Everything about the current school day. Reset when a new day starts. */
export type DayState = {
  dayIndex: number;
  needs: Needs;
  gradePoints: number;
  counters: Counters;
  /** Classmates already greeted today (friendship from greetings counts once a day). */
  greeted: string[];
  goals: GoalProgress[];
  coinsEarned: number;
  reportShown: boolean;
};

/** What is saved for each student. */
export type LifeProfile = {
  look: Look;
  coins: number;
  xp: number;
  owned: string[];
  day: DayState;
};

export type ActivityState = { key: string; spotId: string; elapsedMs: number; durationMs: number };

/** A classmate seen through the realtime channel. */
export type Classmate = {
  id: string;
  name: string;
  look: Look;
  x: number;
  y: number;
  facing: Direction;
  activity: string | null;
  mood: number;
  lastSeen: number;
};

export type ReportCard = {
  dayIndex: number;
  grade: string;
  gradePoints: number;
  coinsEarned: number;
  goalsDone: number;
  goalsTotal: number;
  mood: number;
};

export type SocialKind = "hi" | "help" | "share";
