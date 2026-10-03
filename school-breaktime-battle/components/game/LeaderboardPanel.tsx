"use client";

import { CharacterAvatar } from "@/components/lobby/CharacterAvatar";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";

const medals = ["🥇", "🥈", "🥉"];

export function LeaderboardPanel({ className, hideTitle = false }: { className?: string; hideTitle?: boolean }) {
  const rows = useGameStore((s) => s.hud?.leaderboard ?? []);
  return (
    <section className={className} aria-labelledby="live-leaderboard">
      <h2 id="live-leaderboard" className={cn("mb-2 text-lg font-black text-brand", hideTitle && "sr-only")}>
        Live leaderboard
      </h2>
      <ol className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <li
            key={r.id}
            className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5", r.isMe ? "bg-sun/40 ring-2 ring-sun" : "bg-cream")}
          >
            <span className="w-7 text-center text-base font-black text-ink/70">{medals[i] ?? i + 1}</span>
            <CharacterAvatar characterKey={r.characterKey} size="sm" />
            <span className="min-w-0 flex-1 truncate text-base font-bold">
              {r.name}
              {r.returnedToClass && (
                <span className="ml-1" title="Back in class" aria-label="back in class">
                  🏫
                </span>
              )}
              {r.isFrozen && (
                <span className="ml-1" title="Caught" aria-label="caught by prefect">
                  ❄️
                </span>
              )}
            </span>
            <span className="text-lg font-black text-brand tabular-nums">{r.score}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FeedPanel({ className }: { className?: string }) {
  const feed = useGameStore((s) => s.feed);
  return (
    <section className={className} aria-label="Game feed">
      <ul className="flex flex-col gap-1" aria-live="polite">
        {feed.slice(-4).map((f) => (
          <li
            key={f.id}
            className={cn(
              "animate-pop truncate rounded-lg px-2 py-1 text-sm font-bold",
              f.tone === "good" && "bg-leaf/15 text-leaf-dark",
              f.tone === "bad" && "bg-danger/10 text-danger",
              f.tone === "info" && "bg-brand/5 text-brand",
            )}
          >
            {f.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
