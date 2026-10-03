export const FRIEND_LEVELS = [
  { min: 60, name: "Best friend", hearts: 4 },
  { min: 30, name: "Good friend", hearts: 3 },
  { min: 10, name: "Friend", hearts: 2 },
  { min: 0, name: "Classmate", hearts: 1 },
] as const;

export function friendLevel(points: number) {
  return FRIEND_LEVELS.find((l) => points >= l.min) ?? FRIEND_LEVELS[FRIEND_LEVELS.length - 1];
}

/** Safe preset greetings — there is no free chat. */
export const GREETINGS = [
  "Hi! 👋",
  "Good morning!",
  "How far?",
  "Let's play football!",
  "Let's study together",
  "Nice outfit!",
  "See you at break!",
  "Well done! 🎉",
] as const;

export type Greeting = (typeof GREETINGS)[number];

export const SOCIAL_RULES = {
  hi: { friendship: 2, social: 5 },
  help: { friendship: 3, xp: 8, theirGrades: 5, cooldownMs: 60_000 },
  share: { friendship: 3, cost: 3, theirHunger: 12 },
  footballTogether: { friendship: 2, social: 4, range: 160 },
  /** How close two students must be to interact. */
  talkRange: 90,
} as const;
