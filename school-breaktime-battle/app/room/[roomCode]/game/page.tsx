"use client";

import { useParams } from "next/navigation";
import { GameCanvas } from "@/components/game/GameCanvas";
import { GameHUD } from "@/components/game/GameHUD";
import { GameOverlay } from "@/components/game/GameOverlay";
import { FeedPanel, LeaderboardPanel } from "@/components/game/LeaderboardPanel";
import { TouchGameLayout } from "@/components/game/TouchGameLayout";
import { ReactionPanel } from "@/components/game/ReactionPanel";
import { PageShell } from "@/components/layout/PageShell";
import { ConnectionBanner, LoadingCard, RoomEndedCard } from "@/components/layout/RoomNotice";
import { Card } from "@/components/ui/Card";
import { useRoom } from "@/hooks/useRoom";
import { useTouchLayout } from "@/hooks/useTouchLayout";
import { useGameStore } from "@/store/gameStore";

export default function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { lobby, session, connection, notice, error } = useRoom(roomCode, "game");
  const hasHud = useGameStore((s) => s.hud !== null);
  const touch = useTouchLayout();

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

  if (touch) {
    return <TouchGameLayout isHost={session.isHost} connection={connection} notice={notice} />;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="px-3 pt-3">
        <ConnectionBanner connection={connection} notice={notice} />
        <GameHUD roomCode={roomCode} isHost={session.isHost} />
      </header>

      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <div className="relative min-h-0 flex-1">
          <GameCanvas />
          <GameOverlay />
        </div>
        <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto">
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

      <footer className="border-t-2 border-brand/10 bg-white/80 px-3 py-2">
        <ReactionPanel />
      </footer>
    </div>
  );
}
