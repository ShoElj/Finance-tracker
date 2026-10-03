"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { getLifeApi } from "@/lib/life/api";
import { LifeClient, savedLifeSession } from "@/lib/life/client";
import { containsBlockedWord, validateDisplayName } from "@/lib/moderation";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useLifeStore } from "@/store/lifeStore";
import { cn } from "@/lib/utils";

const mode = isSupabaseConfigured ? "online" : "local";
const normaliseCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

type Errors = { school?: string; code?: string; name?: string; pin?: string; form?: string };

function NameAndPin({
  name,
  pin,
  errors,
  onName,
  onPin,
}: {
  name: string;
  pin: string;
  errors: Errors;
  onName: (v: string) => void;
  onPin: (v: string) => void;
}) {
  return (
    <>
      <Input
        label="Your name"
        placeholder="e.g. Amaka"
        maxLength={16}
        autoComplete="off"
        value={name}
        onChange={(e) => onName(e.target.value)}
        error={errors.name}
      />
      <Input
        label="Secret PIN (4 numbers)"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={pin}
        onChange={(e) => onPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        error={errors.pin}
        hint="Choose any 4 numbers and remember them. Next time, use the same name and PIN to continue your life."
        className="tracking-[0.5em]"
      />
    </>
  );
}

function checkNameAndPin(name: string, pin: string): Errors {
  return {
    name: validateDisplayName(name) ?? undefined,
    pin: /^\d{4}$/.test(pin) ? undefined : "Your PIN must be 4 numbers.",
  };
}

function JoinForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {
      code: code.length !== 6 ? "School codes are 6 letters and numbers." : undefined,
      ...checkNameAndPin(name, pin),
    };
    setErrors(next);
    if (next.code || next.name || next.pin) return;
    setLoading(true);
    try {
      await LifeClient.signIn(mode, code, name, pin);
      router.push(`/life/${code}`);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Could not sign in." });
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        label="School code"
        placeholder="AB3K9Q"
        autoComplete="off"
        autoCapitalize="characters"
        value={code}
        onChange={(e) => setCode(normaliseCode(e.target.value))}
        error={errors.code}
        hint="Ask a friend for their school's code."
        className="text-center text-2xl font-black tracking-[0.3em] uppercase"
      />
      <NameAndPin name={name} pin={pin} errors={errors} onName={setName} onPin={setPin} />
      {errors.form && (
        <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 font-bold text-danger">
          {errors.form}
        </p>
      )}
      <Button type="submit" size="lg" loading={loading} fullWidth>
        {loading ? "Going to school…" : "Go to school"}
      </Button>
    </form>
  );
}

function StartForm() {
  const router = useRouter();
  const [school, setSchool] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = school.trim().replace(/\s+/g, " ");
    const next: Errors = {
      school:
        trimmed.length < 2
          ? "Give your school a name."
          : containsBlockedWord(trimmed)
            ? "Please choose a friendlier school name."
            : undefined,
      ...checkNameAndPin(name, pin),
    };
    setErrors(next);
    if (next.school || next.name || next.pin) return;
    setLoading(true);
    try {
      const code = await getLifeApi(mode).createClass(trimmed);
      await LifeClient.signIn(mode, code, name, pin);
      useLifeStore.getState().toast(`🏫 Welcome to ${trimmed}! Your school code is ${code} — share it with friends.`, "good");
      router.push(`/life/${code}`);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Could not start the school." });
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        label="School name"
        placeholder="e.g. Unity High"
        maxLength={40}
        autoComplete="off"
        value={school}
        onChange={(e) => setSchool(e.target.value)}
        error={errors.school}
        hint="You'll get a code to share with your friends so they can join."
      />
      <NameAndPin name={name} pin={pin} errors={errors} onName={setName} onPin={setPin} />
      {errors.form && (
        <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 font-bold text-danger">
          {errors.form}
        </p>
      )}
      <Button type="submit" size="lg" variant="secondary" loading={loading} fullWidth>
        {loading ? "Building your school…" : "Start my school"}
      </Button>
    </form>
  );
}

function LifeLanding() {
  const params = useSearchParams();
  const router = useRouter();
  const initialCode = normaliseCode(params.get("code") ?? "");
  const [tab, setTab] = useState<"join" | "start">("join");
  const [saved, setSaved] = useState<{ classCode: string; name: string } | null>(null);

  useEffect(() => {
    // Read after mount so the server render matches the first client render.
    const s = savedLifeSession();
    if (s) queueMicrotask(() => setSaved(s));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <span className="rounded-full bg-leaf/15 px-4 py-1.5 text-sm font-extrabold tracking-wide text-leaf-dark uppercase">New · Student Life</span>
        <h1 className="mt-3 text-4xl font-black text-brand">Live the student life</h1>
        <p className="mt-2 text-lg text-ink/75">
          Go to lessons, eat at the canteen, play football with friends, keep your energy up and earn coins for new outfits.
          Start a school and everyone you invite lives in it with you.
        </p>
      </div>

      {saved && (
        <Card className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-base font-bold text-ink">
            Welcome back, {saved.name}! <span className="font-semibold text-ink/60">School {saved.classCode}</span>
          </p>
          <Button onClick={() => router.push(`/life/${saved.classCode}`)}>Continue</Button>
        </Card>
      )}

      <Card>
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-ink/5 p-1" role="tablist">
          {(["join", "start"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("min-h-11 rounded-xl text-base font-bold", tab === t ? "bg-white text-brand shadow" : "text-ink/60")}
            >
              {t === "join" ? "Join a school" : "Start a school"}
            </button>
          ))}
        </div>
        {tab === "join" ? <JoinForm initialCode={initialCode} /> : <StartForm />}
      </Card>

      <p className="text-center text-sm text-ink/60">
        No email or personal details needed. Only people in your school can see your name.{" "}
        <Link href="/" className="font-bold text-brand underline">
          Play Breaktime Battle instead
        </Link>
      </p>
    </div>
  );
}

export default function LifePage() {
  return (
    <PageShell>
      <Suspense fallback={<Card className="text-lg font-bold text-brand">Loading…</Card>}>
        <LifeLanding />
      </Suspense>
    </PageShell>
  );
}
