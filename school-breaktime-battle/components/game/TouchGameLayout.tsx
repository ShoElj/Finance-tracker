"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectionBanner } from "@/components/layout/RoomNotice";
import { useMuted } from "@/hooks/useMuted";
import { powerUps as powerUpDefs, REACTION_COOLDOWN_MS, REACTIONS, type Reaction } from "@/lib/game/constants";
import { getActiveClient } from "@/lib/room/room-client";
import { cn, formatTime } from "@/lib/utils";
import { useGameStore, type ConnectionState } from "@/store/gameStore";
import { BottomSheet } from "./BottomSheet";
import { GameCanvas } from "./GameCanvas";
import { GameOverlay } from "./GameOverlay";
import { Joystick } from "./Joystick";
import { LeaderboardPanel } from "./LeaderboardPanel";

type Sheet = "reactions" | "menu" | "scores" | null;

const pill = "pointer-events-auto flex h-11 items-center gap-1.5 rounded-full px-3.5 font-black shadow-md";

function TouchHud({ onMenu, onScores }: { onMenu: () => void; onScores: () => void }) {
  const hud = useGameStore((s) => s.hud);
  const time = hud?.timeRemaining ?? 0;
  const urgent = hud?.status === "playing" && time <= 15000;
  const rank = hud ? hud.leaderboard.findIndex((r) => r.isMe) + 1 : 0;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-1.5 px-[max(0.5rem,env(safe-area-inset-left))] pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-1.5">
        <div className={cn(pill, "text-white", urgent ? "bg-danger" : "bg-brand")} role="timer" aria-label={`Time left ${formatTime(time)}`}>
          <span aria-hidden>🔔</span>
          <span className="text-xl tabular-nums">{formatTime(time)}</span>
        </div>
        <div className={cn(pill, "bg-white text-brand")} aria-label={`Score ${hud?.myScore ?? 0}`}>
          <span className="text-xs font-bold text-ink/60">PTS</span>
          <span className="text-xl tabular-nums">{hud?.myScore ?? 0}</span>
        </div>
        {rank > 0 && (
          <button type="button" onClick={onScores} className={cn(pill, "bg-sun text-ink")} aria-label="Show leaderboard">
            🏆 #{rank}
            <span className="text-sm font-bold text-ink/60">/{hud?.leaderboard.length}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onMenu}
          className={cn(pill, "ml-auto w-11 justify-center bg-white px-0 text-xl text-brand")}
          aria-label="Game menu"
        >
          ☰
        </button>
      </div>
      {hud && hud.powerUps.length > 0 && (
        <div className="flex gap-1.5">
          {hud.powerUps.map((p) => (
            <span key={p.type} className="rounded-full bg-white/95 px-2.5 py-1 text-sm font-bold text-leaf-dark shadow">
              {powerUpDefs[p.type].emoji} {p.msLeft !== null ? `${Math.ceil(p.msLeft / 1000)}s` : powerUpDefs[p.type].name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The last couple of feed messages, shown briefly over the game. */
function ToastFeed() {
  const feed = useGameStore((s) => s.feed);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const recent = feed.filter((f) => now - f.at < 2500).slice(-1);
  return (
    <ul className="pointer-events-none absolute inset-x-0 top-[calc(max(0.5rem,env(safe-area-inset-top))+6.5rem)] z-20 flex flex-col items-center gap-1 px-4" aria-live="polite">
      {recent.map((f) => (
        <li
          key={f.id}
          className={cn(
            "animate-pop max-w-full truncate rounded-full px-3 py-1 text-sm font-bold shadow",
            f.tone === "good" && "bg-leaf text-white",
            f.tone === "bad" && "bg-danger text-white",
            f.tone === "info" && "bg-white text-brand",
          )}
        >
          {f.text}
        </li>
      ))}
    </ul>
  );
}

function ReactionGrid({ onSent }: { onSent: () => void }) {
  const [cooling, setCooling] = useState(false);
  function send(reaction: Reaction) {
    if (cooling) return;
    if (getActiveClient()?.sendReaction(reaction)) {
      setCooling(true);
      setTimeout(() => setCooling(false), REACTION_COOLDOWN_MS);
      onSent();
    }
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {REACTIONS.map((r) => (
        <button
          key={r}
          type="button"
          disabled={cooling}
          onClick={() => send(r)}
          className="min-h-14 rounded-2xl bg-sky px-3 text-base font-bold text-brand active:scale-95 active:bg-sun disabled:opacity-50"
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function canFullscreen(): boolean {
  return typeof document !== "undefined" && Boolean(document.documentElement.requestFullscreen);
}

function GameMenu({ isHost, onClose }: { isHost: boolean; onClose: () => void }) {
  const [muted, toggleMuted] = useMuted();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const item = "flex min-h-14 w-full items-center gap-3 rounded-2xl bg-ink/5 px-4 text-left text-lg font-bold text-ink active:bg-sun/40";
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={item} onClick={toggleMuted} aria-pressed={!muted}>
        <span aria-hidden>{muted ? "🔇" : "🔊"}</span> Sound {muted ? "off" : "on"}
      </button>
      {canFullscreen() && (
        <button
          type="button"
          className={item}
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen().catch(() => undefined);
            onClose();
          }}
        >
          <span aria-hidden>⛶</span> Full screen
        </button>
      )}
      {isHost && (
        <button
          type="button"
          className={cn(item, "text-danger")}
          onClick={() => {
            if (!confirmEnd) return setConfirmEnd(true);
            getActiveClient()?.endMatch();
            onClose();
          }}
        >
          <span aria-hidden>🔔</span> {confirmEnd ? "Tap again to end the match" : "End Match"}
        </button>
      )}
      <p className="px-1 pt-1 text-sm text-ink/60">Drag on the left side of the screen to move.</p>
    </div>
  );
}

export function TouchGameLayout({
  isHost,
  connection,
  notice,
}: {
  isHost: boolean;
  connection: ConnectionState;
  notice: string | null;
}) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = useCallback(() => setSheet(null), []);

  return (
    <div className="fixed inset-0 touch-none overflow-hidden overscroll-none bg-[#8fcf7a] select-none">
      <GameCanvas fullBleed />
      <Joystick />
      <GameOverlay bannerTop="top-[calc(max(0.5rem,env(safe-area-inset-top))+3.5rem)]" />
      <TouchHud onMenu={() => setSheet("menu")} onScores={() => setSheet("scores")} />
      <ToastFeed />
      <div className="absolute inset-x-2 top-[calc(max(0.5rem,env(safe-area-inset-top))+3.5rem)] z-20">
        <ConnectionBanner connection={connection} notice={notice} />
      </div>

      <button
        type="button"
        onClick={() => setSheet("reactions")}
        aria-label="Send a reaction"
        className="absolute right-[max(1.25rem,env(safe-area-inset-right))] bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-20 grid h-16 w-16 place-items-center rounded-full border-[3px] border-white bg-brand text-3xl shadow-[0_4px_12px_rgba(0,0,0,0.3)] active:scale-95"
      >
        💬
      </button>

      {sheet === "reactions" && (
        <BottomSheet title="Quick reactions" onClose={close}>
          <ReactionGrid onSent={close} />
        </BottomSheet>
      )}
      {sheet === "scores" && (
        <BottomSheet title="Leaderboard" onClose={close}>
          <LeaderboardPanel hideTitle />
        </BottomSheet>
      )}
      {sheet === "menu" && (
        <BottomSheet title="Menu" onClose={close}>
          <GameMenu isHost={isHost} onClose={close} />
        </BottomSheet>
      )}
    </div>
  );
}
