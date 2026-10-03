import { create } from "zustand";
import type { Look } from "@/lib/game/art/students";
import type { PeriodKind } from "@/lib/life/clock";
import type { Needs, ReportCard } from "@/lib/life/types";

export type LifeHud = {
  needs: Needs;
  mood: number;
  coins: number;
  xp: number;
  level: number;
  gradePoints: number;
  grade: string;
  clockLabel: string;
  periodName: string;
  periodKind: PeriodKind;
  subject: string | null;
  secondsLeftInPeriod: number;
  goals: { id: string; text: string; value: number; target: number; done: boolean; reward: number }[];
  activity: { key: string; label: string; emoji: string; progress: number } | null;
  nearSpot: { id: string; label: string; emoji: string; durationSec: number; cost: number; blocker: string | null } | null;
  nearClassmate: { id: string; name: string } | null;
  onlineCount: number;
};

export type RosterEntry = { id: string; name: string; look: Look | null; online: boolean; friendship: number; nearby: boolean };

export type LifeToast = { id: number; text: string; tone: "good" | "bad" | "info"; at: number };

type LifeStore = {
  status: "idle" | "loading" | "playing" | "signed_out";
  me: { id: string; name: string; classCode: string; className: string } | null;
  look: Look | null;
  owned: string[];
  hud: LifeHud | null;
  roster: RosterEntry[];
  toasts: LifeToast[];
  report: ReportCard | null;
  patch: (partial: Partial<Omit<LifeStore, "patch" | "toast" | "reset">>) => void;
  toast: (text: string, tone?: LifeToast["tone"]) => void;
  reset: () => void;
};

let toastId = 0;

const initial = {
  status: "idle" as const,
  me: null,
  look: null,
  owned: [] as string[],
  hud: null,
  roster: [] as RosterEntry[],
  toasts: [] as LifeToast[],
  report: null,
};

export const useLifeStore = create<LifeStore>((set) => ({
  ...initial,
  patch: (partial) => set(partial),
  toast: (text, tone = "info") =>
    set((s) => ({ toasts: [...s.toasts, { id: ++toastId, text, tone, at: Date.now() }].slice(-4) })),
  reset: () => set({ ...initial }),
}));
