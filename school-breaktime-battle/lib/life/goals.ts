import type { CounterKey } from "./types";

export type GoalDef = {
  id: string;
  text: string;
  /** Daily counter that tracks progress, or "gradePoints". */
  counter: CounterKey | "gradePoints";
  target: number;
  reward: number;
};

export const goalDefs: GoalDef[] = [
  { id: "lessons2", text: "Attend 2 lessons", counter: "lessons", target: 2, reward: 20 },
  { id: "study2", text: "Study in the library twice", counter: "study", target: 2, reward: 15 },
  { id: "meal", text: "Eat a proper meal", counter: "meals", target: 1, reward: 10 },
  { id: "football", text: "Play football", counter: "football", target: 1, reward: 10 },
  { id: "hi3", text: "Say hi to 3 classmates", counter: "greetings", target: 3, reward: 15 },
  { id: "help", text: "Help a classmate with homework", counter: "helped", target: 1, reward: 20 },
  { id: "assembly", text: "Attend morning assembly", counter: "assembly", target: 1, reward: 15 },
  { id: "rest", text: "Take a rest in the common room", counter: "rest", target: 1, reward: 10 },
  { id: "gradeB", text: "Reach a B for today", counter: "gradePoints", target: 50, reward: 25 },
  { id: "friends", text: "Do 2 things with classmates", counter: "friendActs", target: 2, reward: 15 },
];

export const GOALS_PER_DAY = 3;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Each student gets their own 3 goals per day, the same on every device. */
export function pickGoals(dayIndex: number, studentId: string): GoalDef[] {
  const ranked = [...goalDefs].sort((a, b) => hash(`${dayIndex}:${studentId}:${a.id}`) - hash(`${dayIndex}:${studentId}:${b.id}`));
  return ranked.slice(0, GOALS_PER_DAY);
}

export function getGoal(id: string): GoalDef | undefined {
  return goalDefs.find((g) => g.id === id);
}
