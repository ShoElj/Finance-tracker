"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CharacterSelect } from "@/components/lobby/CharacterSelect";
import { PlayerList } from "@/components/lobby/PlayerList";
import { PageShell } from "@/components/layout/PageShell";
import { ConnectionBanner, LoadingCard, RoomEndedCard } from "@/components/layout/RoomNotice";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { useRoom } from "@/hooks/useRoom";
import { MATCH_DURATIONS } from "@/lib/game/constants";
import { getActiveClient } from "@/lib/room/room-client";
import { playSound } from "@/lib/sound";

export default function LobbyPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const router = useRouter();
  const { lobby, session, connection, notice, error } = useRoom(roomCode, "lobby");
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  if (connection === "closed" || connection === "kicked") {
    return (
      <PageShell>
        <RoomEndedCard message={notice ?? "This room has closed."} />
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell>
        <RoomEndedCard message={error} />
      </PageShell>
    );
  }
  if (!lobby || !session) {
    return (
      <PageShell>
        <LoadingCard text="Loading lobby…" />
      </PageShell>
    );
  }

  const me = lobby.players.find((p) => p.id === session.playerId);
  const isHost = session.isHost;
  const client = getActiveClient();

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the code is on screen anyway.
    }
  }

  function leave() {
    client?.leave();
    router.push("/");
  }

  return (
    <PageShell wide>
      <ConnectionBanner connection={connection} notice={notice} />
      <Card className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-bold uppercase tracking-wide text-ink/60">Room code</p>
          <div className="flex items-center gap-3">
            <span className="text-5xl font-black tracking-[0.2em] text-brand" aria-label={`Room code ${roomCode.split("").join(" ")}`}>
              {roomCode}
            </span>
            <button
              type="button"
              onClick={copyCode}
              className="min-h-10 rounded-xl bg-brand/10 px-3 text-sm font-bold text-brand hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Badge tone="green" className="w-fit">
            ⏱ {lobby.durationSec} second break
          </Badge>
          <p className="text-lg font-bold text-ink/80" aria-live="polite">
            {isHost
              ? "Share the code. Start when everyone is ready."
              : "Waiting for the host to start the breaktime battle."}
          </p>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card>
          <h2 className="mb-1 text-xl font-black text-brand">Choose your character</h2>
          <p className="mb-4 text-base text-ink/70">Each student has a small special ability.</p>
          <CharacterSelect
            selected={me?.characterKey ?? null}
            onSelect={(key) => {
              playSound("button-click");
              client?.selectCharacter(key);
            }}
          />
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <PlayerList
              players={lobby.players}
              maxPlayers={lobby.maxPlayers}
              myId={session.playerId}
              canRemove={isHost}
              onRemove={(id) => client?.removePlayer(id)}
            />
          </Card>

          <Card className="flex flex-col gap-4">
            {isHost ? (
              <>
                <Select
                  label="Match duration"
                  value={lobby.durationSec}
                  onChange={(e) => client?.setDuration(Number(e.target.value))}
                >
                  {MATCH_DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} seconds
                    </option>
                  ))}
                </Select>
                <Button
                  size="lg"
                  variant="secondary"
                  fullWidth
                  loading={starting}
                  onClick={() => {
                    setStarting(true);
                    playSound("button-click");
                    client?.startGame();
                  }}
                >
                  {starting ? "Starting game…" : "Start Break Time"}
                </Button>
                {lobby.players.length < 2 && (
                  <p className="text-sm text-ink/60">You can start alone to test, or wait for classmates to join.</p>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl bg-sky px-4 py-3" role="status">
                <span className="text-2xl" aria-hidden>
                  ⏳
                </span>
                <p className="text-base font-bold text-ink/80">
                  {me?.characterKey ? "You're ready! Waiting for the host…" : "Pick a character while you wait."}
                </p>
              </div>
            )}
            <Button variant="ghost" fullWidth onClick={leave}>
              {isHost ? "Close Room" : "Leave Room"}
            </Button>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
