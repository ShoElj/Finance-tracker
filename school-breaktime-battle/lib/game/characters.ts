import type { Character, CharacterKey } from "./types";

export const characters: Character[] = [
  {
    key: "fast_runner",
    name: "Fast Runner",
    description: "Moves slightly faster than others.",
    baseSpeed: 1.15,
    ability: "speed_bonus",
    color: "#ef4444",
    emoji: "🏃",
  },
  {
    key: "snack_lover",
    name: "Snack Lover",
    description: "Gets +2 bonus points for every snack.",
    baseSpeed: 1,
    ability: "snack_bonus",
    color: "#f97316",
    emoji: "😋",
  },
  {
    key: "class_captain",
    name: "Class Captain",
    description: "Starts with one prefect shield.",
    baseSpeed: 1,
    ability: "starter_shield",
    color: "#2563eb",
    emoji: "🎖️",
  },
  {
    key: "bookworm",
    name: "Bookworm",
    description: "Power-ups last slightly longer.",
    baseSpeed: 1,
    ability: "longer_powerups",
    color: "#9333ea",
    emoji: "📚",
  },
  {
    key: "football_boy",
    name: "Football Boy",
    description: "Recovers faster from obstacles.",
    baseSpeed: 1,
    ability: "quick_recovery",
    color: "#16a34a",
    emoji: "⚽",
  },
  {
    key: "quiet_genius",
    name: "Quiet Genius",
    description: "Less affected by slow zones.",
    baseSpeed: 1,
    ability: "slow_resistance",
    color: "#0891b2",
    emoji: "🤓",
  },
];

const byKey = new Map(characters.map((c) => [c.key, c]));

export function getCharacter(key: string | null | undefined): Character {
  return (key && byKey.get(key as CharacterKey)) || characters[0];
}

export function isCharacterKey(key: unknown): key is CharacterKey {
  return typeof key === "string" && byKey.has(key as CharacterKey);
}

export function randomCharacterKey(rng: () => number = Math.random): CharacterKey {
  return characters[Math.floor(rng() * characters.length)].key;
}
