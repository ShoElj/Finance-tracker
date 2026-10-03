"use client";

import { useParams } from "next/navigation";
import { GameCanvas } from "@/components/game/GameCanvas";
import { GameHUD } from "@/components/game/GameHUD";
import { GameOverlay } from "@/components/game/GameOverlay";
import { FeedPanel, LeaderboardPanel } from "@/components/game/LeaderboardPanel";
import { MobileControls } from "@/components/game/MobileControls";
import { ReactionPanel } from "@/components/game/ReactionPanel";
import { PageShell } from "@/components/layout/PageShell";
import { ConnectionBanner, LoadingCard, RoomEndedCard } from "@/components/layout/RoomNotice";
import { Card } from "@/components/ui/Card";
import { useRoom } from "@/hooks/useRoom";
import { useGameStore } from "@/store/gameStore";

function MobileLeaderboard() {
  const rows = useGameStore((s) => s.hud?.leaderboard ?? []);
  return (
    <ol className="flex gap-2 overflow-x-auto pb-1 text-sm font-bold" aria-label="Top players">
      {rows.slice(0, 4).map((r, i) => (
        <li key={r.id} className={`shrink-0 rounded-full px-3 py-1 ${r.isMe ? "bg-sun/60" : "bg-white ring-1 ring-brand/15"}`}>
          {i + 1}. {r.name} · <span className="font-black text-brand">{r.score}</span>
        </li>
      ))}
    </ol>
  );
}

export default function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { lobby, session, connection, notice, error } = useRoom(roomCode, "game");
  const hasHud = useGameStore((s) => s.hud !== null);

  if (connection === "closed" || connection === "kicked" || error) {
    return (
      <PageShell>
        <RoomEndedCard message={error ?? notice ?? "This room has closed."} />
      </PageShell>
    );
  }
  if (!lobby || !session || !hasHud) {
    return (
      <PageShell>
        <LoadingCard text="Starting game…" />
      </PageShell>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="px-3 pt-3 short:pt-1">
        <ConnectionBanner connection={connection} notice={notice} />
        <GameHUD roomCode={roomCode} isHost={session.isHost} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 short:p-1 lg:flex-row">
        <div className="relative min-h-[160px] flex-1">
          <GameCanvas />
          <GameOverlay />
          <div className="absolute bottom-2 left-2 hidden opacity-90 short:block">
            <MobileControls className="w-32 bg-white/50" />
          </div>
        </div>
        <aside className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto lg:flex">
          <Card className="p-4 sm:p-4">
            <LeaderboardPanel />
          </Card>
          <Card className="p-3 sm:p-3">
            <FeedPanel />
          </Card>
          <p className="px-1 text-sm text-ink/60">
            Move with <kbd className="rounded bg-white px-1 font-bold">Arrow keys</kbd> or{" "}
            <kbd className="rounded bg-white px-1 font-bold">WASD</kbd>.
          </p>
        </aside>
      </div>

      <footer className="border-t-2 border-brand/10 bg-white/80 px-3 py-2 short:py-1">
        <div className="flex items-center gap-3">
          <MobileControls className="hidden w-40 max-lg:block pointer-coarse:block sm:w-44 short:hidden" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="lg:hidden short:hidden">
              <MobileLeaderboard />
            </div>
            <ReactionPanel className="lg:hidden" compact />
            <ReactionPanel className="hidden lg:block" />
          </div>
        </div>
      </footer>
    </div>
  );
}
