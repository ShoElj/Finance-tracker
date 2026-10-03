"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CharacterAvatar } from "@/components/lobby/CharacterAvatar";
import { PageShell } from "@/components/layout/PageShell";
import { LoadingCard, RoomEndedCard } from "@/components/layout/RoomNotice";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useRoom } from "@/hooks/useRoom";
import { getCharacter } from "@/lib/game/characters";
import { getActiveClient } from "@/lib/room/room-client";
import { playSound } from "@/lib/sound";
import { cn } from "@/lib/utils";

const medals = ["🥇", "🥈", "🥉"];

export default function ResultsPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const router = useRouter();
  const { session, connection, notice, results, error } = useRoom(roomCode, "results");
  const [waiting, setWaiting] = useState(false);
  const played = useRef(false);

  useEffect(() => {
    if (results && !played.current) {
      played.current = true;
      playSound("winner");
    }
  }, [results]);

  if (connection === "closed" || connection === "kicked" || error) {
    return (
      <PageShell>
        <RoomEndedCard message={error ?? notice ?? "This room has closed."} />
      </PageShell>
    );
  }
  if (!results || !session) {
    return (
      <PageShell>
        <LoadingCard text="Saving results…" />
      </PageShell>
    );
  }

  const winner = results.rows[0];
  const myRow = results.rows.find((r) => r.playerId === session.playerId);

  function backHome() {
    getActiveClient()?.leave();
    router.push("/");
  }

  function playAgain() {
    playSound("button-click");
    if (session?.isHost) getActiveClient()?.resetRoom();
    else setWaiting(true);
  }

  return (
    <PageShell wide>
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card className="animate-pop flex flex-col items-center text-center">
          <p className="text-6xl" aria-hidden>
            🏆
          </p>
          <p className="mt-2 text-base font-extrabold uppercase tracking-widest text-leaf-dark">Breaktime Champion</p>
          {winner ? (
            <>
              <div className="mt-4">
                <CharacterAvatar characterKey={winner.characterKey} size="lg" />
              </div>
              <h1 className="mt-2 text-4xl font-black text-brand">{winner.name}</h1>
              <p className="text-lg font-bold text-ink/70">{getCharacter(winner.characterKey).name}</p>
              <p className="mt-3 rounded-2xl bg-sun px-6 py-2 text-3xl font-black text-ink">{winner.score} pts</p>
            </>
          ) : (
            <h1 className="mt-2 text-2xl font-black text-brand">No players this round</h1>
          )}
          {myRow && myRow.playerId !== winner?.playerId && (
            <p className="mt-4 text-lg font-bold text-ink/80">
              You finished #{myRow.rank} with {myRow.score} points.
            </p>
          )}
          <div className="mt-6 flex w-full flex-col gap-3">
            <Button size="lg" variant="secondary" fullWidth onClick={playAgain} disabled={waiting}>
              {waiting ? "Waiting for the host…" : "Play Again"}
            </Button>
            <Button variant="ghost" fullWidth onClick={backHome}>
              Back to Home
            </Button>
          </div>
          {waiting && (
            <p className="mt-3 text-base text-ink/70" role="status">
              You will join the next round as soon as the host starts it.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-2xl font-black text-brand">Final leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="text-sm uppercase tracking-wide text-ink/60">
                  <th className="pb-2 pl-2">Rank</th>
                  <th className="pb-2">Student</th>
                  <th className="pb-2 text-right">Snacks</th>
                  <th className="pb-2 text-right">Caught</th>
                  <th className="pb-2 text-center">In class</th>
                  <th className="pb-2 pr-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {results.rows.map((r, i) => (
                  <tr
                    key={r.playerId}
                    className={cn("border-t border-brand/10 text-base", r.playerId === session.playerId && "bg-sun/25")}
                  >
                    <td className="py-2.5 pl-2 text-lg font-black">{medals[i] ?? r.rank}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <CharacterAvatar characterKey={r.characterKey} size="sm" />
                        <span className="font-bold">
                          {r.name}
                          {r.playerId === session.playerId && <span className="text-brand"> (You)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{r.snacksCollected}</td>
                    <td className="py-2.5 text-right tabular-nums">{r.caughtCount}</td>
                    <td className="py-2.5 text-center" aria-label={r.returnedToClass ? "Returned to class" : "Did not return"}>
                      {r.returnedToClass ? "✅" : "—"}
                    </td>
                    <td className="py-2.5 pr-2 text-right text-xl font-black tabular-nums text-brand">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
