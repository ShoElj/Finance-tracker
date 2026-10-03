/** Per-tab session so several tabs in one browser can play as different students. */
export type RoomMode = "online" | "local";

export type Session = {
  roomCode: string;
  playerId: string;
  name: string;
  isHost: boolean;
  mode: RoomMode;
};

const KEY = "sbb-session";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function loadSession(): Session | null {
  try {
    const raw = storage()?.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable (private mode); the session then lasts until reload.
  }
}

export function clearSession(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function loadJson<T>(key: string): T | null {
  try {
    const raw = storage()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function removeKey(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // ignore
  }
}
