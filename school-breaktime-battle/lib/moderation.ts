/**
 * Lightweight name filter for a student audience. It is deliberately simple: a blocklist
 * checked against a normalised version of the name (leetspeak and separators removed).
 */
const BLOCKED_SUBSTRINGS = [
  "fuck", "fuk", "shit", "bitch", "bastard", "cunt", "pussy", "whore", "slut", "nigg",
  "faggot", "penis", "vagina", "boob", "porn", "sexy", "asshole", "wanker", "motherf",
  "idiot", "stupid", "olodo", "mumu", "ashawo", "werey", "suicide",
];

/** Short words only blocked when they are the whole word, to avoid false positives. */
const BLOCKED_WORDS = ["ass", "fag", "hoe", "ode", "dumb", "die", "nude", "dick", "sex", "rape", "kill"];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

function normalise(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((c) => LEET[c] ?? c)
    .join("");
}

export function containsBlockedWord(text: string): boolean {
  const norm = normalise(text);
  const squashed = norm.replace(/[^a-z]/g, "");
  if (BLOCKED_SUBSTRINGS.some((w) => squashed.includes(w))) return true;
  const words = norm.split(/[^a-z]+/).filter(Boolean);
  return words.some((w) => BLOCKED_WORDS.includes(w));
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Returns an error message, or null when the display name is acceptable. */
export function validateDisplayName(raw: string): string | null {
  const name = cleanName(raw);
  if (!name) return "Please enter your name.";
  if (name.length < 2) return "Name is too short.";
  if (name.length > 16) return "Name must be 16 characters or fewer.";
  if (!/^[A-Za-z0-9 ._'-]+$/.test(name)) return "Use letters, numbers and spaces only.";
  if (containsBlockedWord(name)) return "Please choose a friendlier name.";
  return null;
}
