/**
 * The shared school day. Time comes from the real clock, so every student in a class sees the
 * same period at the same moment without any server or host keeping time.
 */
export const DAY_MS = 10 * 60 * 1000;

export type PeriodKind = "assembly" | "lesson" | "break" | "after" | "home";

export type Period = { key: string; kind: PeriodKind; name: string; start: number; end: number };

/** Seconds into the 10-minute day. */
export const PERIODS: Period[] = [
  { key: "assembly", kind: "assembly", name: "Morning Assembly", start: 0, end: 45 },
  { key: "lesson1", kind: "lesson", name: "Lesson 1", start: 45, end: 195 },
  { key: "break", kind: "break", name: "Break Time", start: 195, end: 285 },
  { key: "lesson2", kind: "lesson", name: "Lesson 2", start: 285, end: 435 },
  { key: "after", kind: "after", name: "After School", start: 435, end: 555 },
  { key: "home", kind: "home", name: "Home Time", start: 555, end: 600 },
];

export const SUBJECTS = [
  "Mathematics",
  "English",
  "Basic Science",
  "Social Studies",
  "Computer Studies",
  "Creative Arts",
  "Agricultural Science",
  "Civic Education",
];

/** In-game clock: the day runs from 7:30 AM to 4:30 PM. */
const DAY_START_MIN = 7 * 60 + 30;
const DAY_LENGTH_MIN = 9 * 60;

export type SchoolTime = {
  dayIndex: number;
  secondsIntoDay: number;
  period: Period;
  secondsLeftInPeriod: number;
  /** Subject being taught when the period is a lesson. */
  subject: string | null;
  clockLabel: string;
};

export function subjectFor(dayIndex: number, periodKey: string): string {
  const offset = periodKey === "lesson2" ? 1 : 0;
  return SUBJECTS[(dayIndex * 2 + offset) % SUBJECTS.length];
}

export function formatClock(secondsIntoDay: number): string {
  const minutes = DAY_START_MIN + Math.floor((secondsIntoDay / (DAY_MS / 1000)) * DAY_LENGTH_MIN);
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

export function getSchoolTime(now: number = Date.now()): SchoolTime {
  const dayIndex = Math.floor(now / DAY_MS);
  const secondsIntoDay = (now - dayIndex * DAY_MS) / 1000;
  const period = PERIODS.find((p) => secondsIntoDay >= p.start && secondsIntoDay < p.end) ?? PERIODS[PERIODS.length - 1];
  return {
    dayIndex,
    secondsIntoDay,
    period,
    secondsLeftInPeriod: Math.max(0, period.end - secondsIntoDay),
    subject: period.kind === "lesson" ? subjectFor(dayIndex, period.key) : null,
    clockLabel: formatClock(secondsIntoDay),
  };
}
