import type { PeriodKind } from "./clock";
import type { CounterKey, NeedKey } from "./types";

export type ActivityEffects = Partial<Record<NeedKey, number>> & { grades?: number; xp?: number; coins?: number };

export type ActivityDef = {
  key: string;
  label: string;
  /** Shown in a bubble over the student while they do it. */
  emoji: string;
  verb: string;
  durationSec: number;
  cost: number;
  effects: ActivityEffects;
  /** When set, the activity only works during these periods. */
  periods?: PeriodKind[];
  closedMessage?: string;
  counter?: CounterKey;
};

export const activities: Record<string, ActivityDef> = {
  assembly: {
    key: "assembly",
    label: "Join assembly",
    emoji: "🎤",
    verb: "at assembly",
    durationSec: 10,
    cost: 0,
    effects: { social: 8, xp: 10, coins: 5 },
    periods: ["assembly"],
    closedMessage: "Assembly is in the morning.",
    counter: "assembly",
  },
  attend_lesson: {
    key: "attend_lesson",
    label: "Attend lesson",
    emoji: "📝",
    verb: "in class",
    durationSec: 20,
    cost: 0,
    effects: { grades: 12, energy: -6, fun: -3, xp: 15, coins: 5 },
    periods: ["lesson"],
    closedMessage: "No lesson right now — study in the library instead.",
    counter: "lessons",
  },
  study: {
    key: "study",
    label: "Study",
    emoji: "📚",
    verb: "studying",
    durationSec: 15,
    cost: 0,
    effects: { grades: 8, energy: -6, fun: -4, xp: 8 },
    periods: ["assembly", "lesson", "break", "after"],
    closedMessage: "The library is closed. Go home and rest!",
    counter: "study",
  },
  read_comics: {
    key: "read_comics",
    label: "Read comics",
    emoji: "📖",
    verb: "reading",
    durationSec: 10,
    cost: 0,
    effects: { fun: 14, energy: -2 },
    periods: ["assembly", "lesson", "break", "after"],
    closedMessage: "The library is closed.",
  },
  buy_meal: {
    key: "buy_meal",
    label: "Buy jollof rice",
    emoji: "🍛",
    verb: "eating",
    durationSec: 6,
    cost: 10,
    effects: { hunger: 45, fun: 3 },
    periods: ["break", "after"],
    closedMessage: "The canteen opens at break time.",
    counter: "meals",
  },
  buy_snack: {
    key: "buy_snack",
    label: "Buy puff-puff",
    emoji: "🍩",
    verb: "snacking",
    durationSec: 4,
    cost: 4,
    effects: { hunger: 18, fun: 4 },
    periods: ["break", "after"],
    closedMessage: "The canteen opens at break time.",
    counter: "snacks",
  },
  drink_water: {
    key: "drink_water",
    label: "Drink water",
    emoji: "🚰",
    verb: "drinking",
    durationSec: 3,
    cost: 0,
    effects: { hunger: 5, energy: 2 },
  },
  play_football: {
    key: "play_football",
    label: "Play football",
    emoji: "⚽",
    verb: "playing football",
    durationSec: 15,
    cost: 0,
    effects: { fun: 20, energy: -12, social: 4, xp: 6 },
    periods: ["break", "after"],
    closedMessage: "Football is for break time and after school.",
    counter: "football",
  },
  rest: {
    key: "rest",
    label: "Rest",
    emoji: "😴",
    verb: "resting",
    durationSec: 12,
    cost: 0,
    effects: { energy: 30 },
    counter: "rest",
  },
  board_games: {
    key: "board_games",
    label: "Play ludo",
    emoji: "🎲",
    verb: "playing ludo",
    durationSec: 10,
    cost: 0,
    effects: { fun: 12, social: 5 },
    periods: ["break", "after"],
    closedMessage: "Games are for break time and after school.",
  },
};

export function getActivity(key: string | null | undefined): ActivityDef | null {
  return (key && activities[key]) || null;
}
