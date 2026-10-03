"use client";

import { useEffect, useState } from "react";
import { powerUps as powerUpDefs } from "@/lib/game/constants";
import { getActiveClient } from "@/lib/room/room-client";
import { isMuted, setMuted } from "@/lib/sound";
import { cn, formatTime } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";

export function GameHUD({ roomCode, isHost }: { roomCode: string; isHost: boolean }) {
  const hud = useGameStore((s) => s.hud);
  const [muted, setMutedState] = useState(() => isMuted());
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    if (!confirmEnd) return;
    const t = setTimeout(() => setConfirmEnd(false), 3000);
    return () => clearTimeout(t);
  }, [confirmEnd]);

  const time = hud?.timeRemaining ?? 0;
  const urgent = hud?.status === "playing" && time <= 15000;
  const rank = hud ? hud.leaderboard.findIndex((r) => r.isMe) + 1 : 0;

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div
        className={cn(
          "flex items-baseline gap-2 rounded-2xl px-4 py-1.5 text-white shadow-[0_3px_0_0_var(--color-brand-dark)]",
          urgent ? "bg-danger" : "bg-brand",
        )}
        role="timer"
        aria-label={`Break time left ${formatTime(time)}`}
      >
        <span aria-hidden className="text-lg">
          🔔
        </span>
        <span className="text-2xl font-black tabular-nums sm:text-3xl">{formatTime(time)}</span>
      </div>
      <div className="rounded-2xl bg-white px-4 py-1.5 ring-2 ring-brand/10">
        <span className="text-sm font-bold text-ink/60">Score </span>
        <span className="text-2xl font-black tabular-nums text-brand">{hud?.myScore ?? 0}</span>
      </div>
      <div className="hidden rounded-2xl bg-white px-3 py-2 text-base font-bold ring-2 ring-brand/10 sm:block" title="Snacks collected">
        🍪 {hud?.mySnacks ?? 0}
      </div>
      {rank > 0 && (
        <div className="rounded-2xl bg-sun/40 px-3 py-2 text-base font-black text-ink">
          #{rank}
          <span className="font-bold text-ink/60">/{hud?.leaderboard.length}</span>
        </div>
      )}
      {hud?.powerUps.map((p) => (
        <span
          key={p.type}
          className="rounded-2xl bg-leaf/15 px-3 py-2 text-sm font-bold text-leaf-dark"
          title={powerUpDefs[p.type].description}
        >
          {powerUpDefs[p.type].emoji} {powerUpDefs[p.type].name}
          {p.msLeft !== null && <span className="tabular-nums"> {Math.ceil(p.msLeft / 1000)}s</span>}
        </span>
      ))}

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden rounded-full bg-brand/10 px-3 py-1 text-sm font-bold text-brand md:inline">Room {roomCode}</span>
        <button
          type="button"
          onClick={() => {
            setMuted(!muted);
            setMutedState(!muted);
          }}
          aria-pressed={muted}
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          className="grid h-11 w-11 place-items-center rounded-xl bg-white text-xl ring-2 ring-brand/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun"
        >
          {muted ? "🔇" : "🔊"}
        </button>
        {isHost && hud?.status !== "finished" && (
          <button
            type="button"
            onClick={() => {
              if (confirmEnd) getActiveClient()?.endMatch();
              setConfirmEnd(!confirmEnd);
            }}
            className="min-h-11 rounded-xl bg-white px-3 text-sm font-bold text-danger ring-2 ring-danger/30 hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-4"
          >
            {confirmEnd ? "Tap again to end" : "End Match"}
          </button>
        )}
      </div>
    </div>
  );
}
