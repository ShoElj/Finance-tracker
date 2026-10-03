"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getActiveClient, RoomClient } from "@/lib/room/room-client";
import { clearSession, loadSession } from "@/lib/session";
import { useGameStore } from "@/store/gameStore";

export type RoomPage = "lobby" | "game" | "results";

export function roomPath(roomCode: string, page: RoomPage): string {
  if (page === "lobby") return `/room/${roomCode}`;
  return `/room/${roomCode}/${page}`;
}

/**
 * Connects (or reconnects after a reload) to a room and keeps every player on the page that
 * matches the room status: lobby while waiting, game while playing, results when finished.
 */
export function useRoom(roomCode: string, page: RoomPage) {
  const router = useRouter();
  const lobby = useGameStore((s) => s.lobby);
  const session = useGameStore((s) => s.session);
  const connection = useGameStore((s) => s.connection);
  const notice = useGameStore((s) => s.notice);
  const results = useGameStore((s) => s.results);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = getActiveClient();
    if (client && client.roomCode === roomCode) return;
    const { connection: current } = useGameStore.getState();
    if (current === "closed" || current === "kicked") return;
    const saved = loadSession();
    if (!saved || saved.roomCode !== roomCode) {
      router.replace(`/join?code=${encodeURIComponent(roomCode)}`);
      return;
    }
    let cancelled = false;
    RoomClient.resume(saved).catch((e: unknown) => {
      if (cancelled) return;
      clearSession();
      setError(e instanceof Error ? e.message : "Could not reconnect to the room.");
    });
    return () => {
      cancelled = true;
    };
  }, [roomCode, router]);

  useEffect(() => {
    if (!lobby || lobby.roomCode !== roomCode) return;
    const target: RoomPage = lobby.status === "waiting" ? "lobby" : lobby.status === "playing" ? "game" : "results";
    if (target === "results" && !results && page === "game") return;
    if (target !== page) router.replace(roomPath(roomCode, target));
  }, [lobby, results, page, roomCode, router]);

  const ready = Boolean(lobby && session && lobby.roomCode === roomCode && session.roomCode === roomCode);
  return { lobby: ready ? lobby : null, session: ready ? session : null, connection, notice, results, error, ready };
}
