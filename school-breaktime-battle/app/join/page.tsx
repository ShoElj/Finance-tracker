"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { roomPath } from "@/hooks/useRoom";
import { validateDisplayName } from "@/lib/moderation";
import { RoomClient } from "@/lib/room/room-client";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isValidRoomCode } from "@/lib/utils";

function JoinRoomForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(() => (params.get("code") ?? "").replace(/\D/g, "").slice(0, 4));
  const [name, setName] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cProblem = !code ? "Room code is required." : !isValidRoomCode(code) ? "Room codes are 4 digits." : null;
    const nProblem = validateDisplayName(name);
    setCodeError(cProblem);
    setNameError(nProblem);
    if (cProblem || nProblem) return;
    setError(null);
    setLoading(true);
    try {
      await RoomClient.join({ roomCode: code, name, mode: isSupabaseConfigured ? "online" : "local" });
      router.push(roomPath(code, "lobby"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the room.");
      setLoading(false);
    }
  }

  return (
    <Card className="animate-pop">
      <h1 className="text-3xl font-black text-brand">Join With Code</h1>
      <p className="mt-1 text-lg text-ink/70">Ask your host for the 4-digit room code.</p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        <Input
          label="Room code"
          placeholder="4821"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          error={codeError}
          className="text-center text-3xl font-black tracking-[0.4em]"
        />
        <Input
          label="Your name"
          placeholder="e.g. Amaka"
          maxLength={16}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          hint="2 to 16 characters. Be kind — no rude names."
        />
        {error && (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 font-bold text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" variant="secondary" loading={loading} fullWidth>
          {loading ? "Joining room…" : "Join Room"}
        </Button>
      </form>
    </Card>
  );
}

export default function JoinPage() {
  return (
    <PageShell>
      <Suspense fallback={<Card className="text-lg font-bold text-brand">Loading…</Card>}>
        <JoinRoomForm />
      </Suspense>
    </PageShell>
  );
}
