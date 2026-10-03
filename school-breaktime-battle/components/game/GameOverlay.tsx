"use client";

import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";

/** Messages drawn over the canvas: countdown, capture, hurry-up and the final bell. */
export function GameOverlay({ bannerTop = "top-2" }: { bannerTop?: string }) {
  const hud = useGameStore((s) => s.hud);
  if (!hud) return null;

  if (hud.status === "countdown") {
    const n = Math.max(1, Math.ceil(hud.countdownMs / 1000));
    return (
      <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-brand/30" role="status">
        <div className="animate-pop rounded-3xl bg-white px-8 py-5 text-center shadow-xl">
          <p className="text-lg font-bold text-ink/70">Break starts in</p>
          <p key={n} className="animate-pop text-6xl font-black text-brand">
            {n}
          </p>
          <p className="mt-1 text-base font-bold text-ink/70">Rush to the canteen, then back to class!</p>
        </div>
      </div>
    );
  }

  if (hud.status === "finished") {
    return (
      <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-brand/40" role="status">
        <div className="animate-pop rounded-3xl bg-white px-8 py-6 text-center shadow-xl">
          <p className="text-5xl" aria-hidden>
            🔔
          </p>
          <p className="text-3xl font-black text-brand">The bell has rung.</p>
          <p className="mt-1 text-base font-bold text-ink/70">Counting scores…</p>
        </div>
      </div>
    );
  }

  const hurry = hud.timeRemaining <= 20000 && !hud.inClassroom;
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-2 px-3", bannerTop)} aria-live="polite">
      {hud.isFrozen && (
        <p className="animate-pop rounded-full bg-sky px-4 py-1.5 text-base font-black text-brand shadow">
          ❄️ Caught by a prefect! Wait a moment…
        </p>
      )}
      {hurry && (
        <p className="rounded-full bg-sun px-4 py-1.5 text-base font-black text-ink shadow">
          🏃 Hurry back to class before the bell!
        </p>
      )}
    </div>
  );
}
