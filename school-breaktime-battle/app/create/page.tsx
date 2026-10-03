"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { roomPath } from "@/hooks/useRoom";
import { DEFAULT_MATCH_DURATION, MATCH_DURATIONS, MAX_BOTS, MAX_PLAYERS } from "@/lib/game/constants";
import { validateDisplayName } from "@/lib/moderation";
import { RoomClient } from "@/lib/room/room-client";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function CreateRoomForm() {
  const router = useRouter();
  const practice = useSearchParams().get("practice") === "1";
  const local = practice || !isSupabaseConfigured;

  const [hostName, setHostName] = useState("");
  const [duration, setDuration] = useState<number>(DEFAULT_MATCH_DURATION);
  const [maxPlayers, setMaxPlayers] = useState<number>(practice ? 4 : MAX_PLAYERS);
  const [bots, setBots] = useState<number>(local ? MAX_BOTS : 0);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validateDisplayName(hostName);
    setNameError(problem);
    if (problem) return;
    setError(null);
    setLoading(true);
    try {
      const client = await RoomClient.create({
        hostName,
        maxPlayers,
        durationSec: duration,
        bots: Math.min(bots, maxPlayers - 1),
        mode: local ? "local" : "online",
      });
      router.push(roomPath(client.roomCode, "lobby"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the room. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Card className="animate-pop">
      <h1 className="text-3xl font-black text-brand">{practice ? "Practice vs Bots" : "Create Game Room"}</h1>
      <p className="mt-1 text-lg text-ink/70">
        {practice
          ? "Play a quick round against computer students."
          : "You will be the host. Share the room code with your classmates."}
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        <Input
          label="Host name"
          placeholder="e.g. Mr. Okafor"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          maxLength={16}
          autoComplete="off"
          error={nameError}
          hint="2 to 16 characters."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Select label="Match duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {MATCH_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} seconds
              </option>
            ))}
          </Select>
          <Select label="Maximum players" value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))}>
            {Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n} players
              </option>
            ))}
          </Select>
        </div>
        <Select
          label="Practice bots"
          value={bots}
          onChange={(e) => setBots(Number(e.target.value))}
          hint="Bots fill empty spots so you can test the game on your own."
        >
          {Array.from({ length: MAX_BOTS + 1 }, (_, i) => i).map((n) => (
            <option key={n} value={n} disabled={n > maxPlayers - 1}>
              {n === 0 ? "No bots" : `${n} bot${n > 1 ? "s" : ""}`}
            </option>
          ))}
        </Select>
        {local && !practice && (
          <p className="rounded-2xl bg-sky px-4 py-3 text-base text-ink/80">
            Demo room: open another tab in this browser and use <strong>Join With Code</strong> to add more players.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 font-bold text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={loading} fullWidth>
          {loading ? "Creating room…" : practice ? "Create Practice Room" : "Create Game Room"}
        </Button>
      </form>
    </Card>
  );
}

export default function CreatePage() {
  return (
    <PageShell>
      <Suspense fallback={<Card className="text-lg font-bold text-brand">Loading…</Card>}>
        <CreateRoomForm />
      </Suspense>
    </PageShell>
  );
}
