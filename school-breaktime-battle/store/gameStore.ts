import { create } from "zustand";
import type { CharacterKey, GameStatus, MatchResults, PowerUpType } from "@/lib/game/types";
import type { LobbyState } from "@/lib/realtime/room-events";
import type { Session } from "@/lib/session";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "host_lost"
  | "closed"
  | "kicked";

export type LeaderRow = {
  id: string;
  name: string;
  characterKey: CharacterKey;
  score: number;
  isMe: boolean;
  isBot: boolean;
  returnedToClass: boolean;
  isFrozen: boolean;
};

export type HudState = {
  status: GameStatus;
  countdownMs: number;
  timeRemaining: number;
  myScore: number;
  mySnacks: number;
  inClassroom: boolean;
  returnedToClass: boolean;
  isFrozen: boolean;
  powerUps: { type: PowerUpType; msLeft: number | null }[];
  leaderboard: LeaderRow[];
};

export type FeedTone = "good" | "bad" | "info";
export type FeedItem = { id: number; text: string; tone: FeedTone; at: number };

type RoomStore = {
  session: Session | null;
  lobby: LobbyState | null;
  connection: ConnectionState;
  notice: string | null;
  hud: HudState | null;
  feed: FeedItem[];
  results: MatchResults | null;
  patch: (partial: Partial<Omit<RoomStore, "patch" | "pushFeed" | "reset">>) => void;
  pushFeed: (text: string, tone?: FeedTone) => void;
  reset: () => void;
};

const initial = {
  session: null,
  lobby: null,
  connection: "idle" as ConnectionState,
  notice: null,
  hud: null,
  feed: [] as FeedItem[],
  results: null,
};

let feedId = 0;
const MAX_FEED = 6;

export const useGameStore = create<RoomStore>((set) => ({
  ...initial,
  patch: (partial) => set(partial),
  pushFeed: (text, tone = "info") =>
    set((s) => ({ feed: [...s.feed, { id: ++feedId, text, tone, at: Date.now() }].slice(-MAX_FEED) })),
  reset: () => set({ ...initial }),
}));
