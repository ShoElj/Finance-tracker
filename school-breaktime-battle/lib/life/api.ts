/**
 * Student Life accounts and saves. Online it calls the Supabase functions in
 * supabase/migrations/002_school_life.sql; in demo mode the same rules run against
 * localStorage so the game can be tried (and played across tabs) without a backend.
 */
import type { Look } from "@/lib/game/art/students";
import type { RoomMode } from "@/lib/session";
import { getSupabase } from "@/lib/supabase/client";
import { generateId } from "@/lib/utils";
import type { LifeProfile } from "./types";

export type ClassInfo = { name: string; studentCount: number };

export type EnterResult = {
  studentId: string;
  token: string;
  name: string;
  isNew: boolean;
  profile: LifeProfile | null;
  className: string;
};

export type Roster = {
  students: { id: string; name: string; look: Look | null }[];
  friendships: Record<string, number>;
};

export class LifeApiError extends Error {}

const ERROR_MESSAGES: Record<string, string> = {
  class_not_found: "We couldn't find a school with that code.",
  invalid_name: "Names can use letters, numbers and spaces (2–16 characters).",
  invalid_pin: "Your PIN must be 4 numbers.",
  wrong_pin: "That PIN doesn't match. Try again.",
  locked: "Too many wrong PINs. Wait 5 minutes and try again.",
  class_full: "This school is full.",
  signed_out: "You signed in somewhere else. Please sign in again.",
};

function fail(code: string): never {
  throw new LifeApiError(ERROR_MESSAGES[code] ?? "Something went wrong. Please try again.");
}

export interface LifeApi {
  readonly mode: RoomMode;
  /** Starts a new school and returns its 6-character code. */
  createClass(name: string): Promise<string>;
  classInfo(code: string): Promise<ClassInfo | null>;
  enter(code: string, name: string, pin: string): Promise<EnterResult>;
  /** Returns false when the session is no longer valid (signed in elsewhere). */
  save(token: string, profile: LifeProfile): Promise<boolean>;
  roster(token: string): Promise<Roster>;
  addFriendship(token: string, otherId: string, points: number): Promise<number | null>;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

class SupabaseLifeApi implements LifeApi {
  readonly mode = "online" as const;

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const db = getSupabase();
    if (!db) throw new LifeApiError("Online play is not configured.");
    const { data, error } = await db.rpc(fn, args);
    if (error) {
      console.error(`[life] ${fn} failed`, error);
      throw new LifeApiError("Could not reach the school server. Check your connection.");
    }
    return data as T;
  }

  async createClass(name: string): Promise<string> {
    return this.rpc<string>("life_create_class", { p_name: name });
  }

  async classInfo(code: string): Promise<ClassInfo | null> {
    return this.rpc<ClassInfo | null>("life_class_info", { p_code: code });
  }

  async enter(code: string, name: string, pin: string): Promise<EnterResult> {
    const result = await this.rpc<EnterResult & { error?: string }>("life_enter", { p_code: code, p_name: name, p_pin: pin });
    if (result?.error) fail(result.error);
    return result;
  }

  async save(token: string, profile: LifeProfile): Promise<boolean> {
    return this.rpc<boolean>("life_save", { p_token: token, p_profile: profile });
  }

  async roster(token: string): Promise<Roster> {
    const result = await this.rpc<Roster & { error?: string }>("life_roster", { p_token: token });
    if (result?.error) fail(result.error);
    return result;
  }

  async addFriendship(token: string, otherId: string, points: number): Promise<number | null> {
    return this.rpc<number | null>("life_add_friendship", { p_token: token, p_other: otherId, p_points: points });
  }
}

// ---------------------------------------------------------------------------
// Demo mode (localStorage)
// ---------------------------------------------------------------------------

type LocalStudent = {
  id: string;
  name: string;
  pinHash: string;
  token: string | null;
  failed: number;
  lockedUntil: number;
  profile: LifeProfile | null;
};
type LocalClass = { name: string; students: Record<string, LocalStudent>; friendships: Record<string, number> };

const LOCAL_KEY = "sbb-life-classes";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function readAll(): Record<string, LocalClass> {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "{}") as Record<string, LocalClass>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, LocalClass>): void {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: progress lasts until the tab closes.
  }
}

async function hashPin(code: string, nameKey: string, pin: string): Promise<string> {
  const text = `${code}:${nameKey}:${pin}`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return text;
}

const nameKeyOf = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function findByToken(data: Record<string, LocalClass>, token: string): { cls: LocalClass; me: LocalStudent } | null {
  for (const cls of Object.values(data)) {
    for (const s of Object.values(cls.students)) if (s.token === token) return { cls, me: s };
  }
  return null;
}

class LocalLifeApi implements LifeApi {
  readonly mode = "local" as const;

  async createClass(name: string): Promise<string> {
    if (name.trim().length < 2) throw new LifeApiError("Please give your school a name.");
    const data = readAll();
    let code = "";
    do {
      code = Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
    } while (data[code]);
    data[code] = { name: name.trim(), students: {}, friendships: {} };
    writeAll(data);
    return code;
  }

  async classInfo(code: string): Promise<ClassInfo | null> {
    const cls = readAll()[code.trim().toUpperCase()];
    return cls ? { name: cls.name, studentCount: Object.keys(cls.students).length } : null;
  }

  async enter(rawCode: string, rawName: string, pin: string): Promise<EnterResult> {
    const code = rawCode.trim().toUpperCase();
    const data = readAll();
    const cls = data[code];
    if (!cls) fail("class_not_found");
    const name = rawName.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 16 || !/^[A-Za-z0-9 ._'-]+$/.test(name)) fail("invalid_name");
    if (!/^\d{4}$/.test(pin)) fail("invalid_pin");
    const key = nameKeyOf(name);
    const pinHash = await hashPin(code, key, pin);
    const token = generateId();
    let student = cls.students[key];

    if (!student) {
      student = { id: generateId(), name, pinHash, token, failed: 0, lockedUntil: 0, profile: null };
      cls.students[key] = student;
      writeAll(data);
      return { studentId: student.id, token, name, isNew: true, profile: null, className: cls.name };
    }
    if (student.lockedUntil > Date.now()) fail("locked");
    if (student.pinHash !== pinHash) {
      student.failed += 1;
      if (student.failed >= 5) {
        student.failed = 0;
        student.lockedUntil = Date.now() + 5 * 60_000;
      }
      writeAll(data);
      fail("wrong_pin");
    }
    student.failed = 0;
    student.token = token;
    writeAll(data);
    return { studentId: student.id, token, name: student.name, isNew: false, profile: student.profile, className: cls.name };
  }

  async save(token: string, profile: LifeProfile): Promise<boolean> {
    const data = readAll();
    const found = findByToken(data, token);
    if (!found) return false;
    found.me.profile = profile;
    writeAll(data);
    return true;
  }

  async roster(token: string): Promise<Roster> {
    const found = findByToken(readAll(), token);
    if (!found) fail("signed_out");
    const { cls, me } = found;
    const friendships: Record<string, number> = {};
    const students = Object.values(cls.students)
      .filter((s) => s.id !== me.id)
      .map((s) => {
        const points = cls.friendships[pairKey(me.id, s.id)];
        if (points) friendships[s.id] = points;
        return { id: s.id, name: s.name, look: s.profile?.look ?? null };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return { students, friendships };
  }

  async addFriendship(token: string, otherId: string, points: number): Promise<number | null> {
    const data = readAll();
    const found = findByToken(data, token);
    if (!found) return null;
    const { cls, me } = found;
    if (!Object.values(cls.students).some((s) => s.id === otherId) || otherId === me.id) return null;
    const key = pairKey(me.id, otherId);
    cls.friendships[key] = Math.min(1000, (cls.friendships[key] ?? 0) + Math.max(1, Math.min(5, points)));
    writeAll(data);
    return cls.friendships[key];
  }
}

const apis: Partial<Record<RoomMode, LifeApi>> = {};

export function getLifeApi(mode: RoomMode): LifeApi {
  apis[mode] ??= mode === "online" ? new SupabaseLifeApi() : new LocalLifeApi();
  return apis[mode]!;
}
