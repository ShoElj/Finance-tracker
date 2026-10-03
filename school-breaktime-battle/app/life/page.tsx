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
import { validateDisplayName } from "@/lib/moderation";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const mode = isSupabaseConfigured ? "online" : "local";
const normaliseCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

function JoinForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [errors, setErrors] = useState<{ code?: string; name?: string; pin?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = {
      code: code.length !== 6 ? "Class codes are 6 letters and numbers." : undefined,
      name: validateDisplayName(name) ?? undefined,
      pin: /^\d{4}$/.test(pin) ? undefined : "Your PIN must be 4 numbers.",
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
        label="Class code"
        placeholder="AB3K9Q"
        autoComplete="off"
        autoCapitalize="characters"
        value={code}
        onChange={(e) => setCode(normaliseCode(e.target.value))}
        error={errors.code}
        className="text-center text-2xl font-black tracking-[0.3em] uppercase"
      />
      <Input
        label="Your name"
        placeholder="e.g. Amaka"
        maxLength={16}
        autoComplete="off"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />
      <Input
        label="Secret PIN (4 numbers)"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        error={errors.pin}
        hint="First time? Choose any 4 numbers and remember them. Next time, use the same name and PIN."
        className="tracking-[0.5em]"
      />
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

function CreateForm({ onJoin }: { onJoin: (code: string) => void }) {
  const [className, setClassName] = useState("");
  const [teacher, setTeacher] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (className.trim().length < 2 || teacher.trim().length < 2) {
      setError("Please enter the class name and your name.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      setCreated(await getLifeApi(mode).createClass(className.trim(), teacher.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the class.");
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="text-center">
        <p className="text-base font-bold text-ink/70">Your class code</p>
        <p className="my-2 text-5xl font-black tracking-[0.2em] text-brand">{created}</p>
        <p className="mb-4 text-base text-ink/70">
          Share this code with your students. Each student picks their own name and 4-digit PIN.
        </p>
        <Button variant="secondary" onClick={() => onJoin(created)}>
          Join this class
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Input label="Class name" placeholder="e.g. JSS 2B" maxLength={40} value={className} onChange={(e) => setClassName(e.target.value)} />
      <Input label="Teacher name" placeholder="e.g. Mrs Okafor" maxLength={40} value={teacher} onChange={(e) => setTeacher(e.target.value)} />
      {error && (
        <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 font-bold text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" variant="secondary" loading={loading} fullWidth>
        {loading ? "Creating class…" : "Create class"}
      </Button>
    </form>
  );
}

function LifeLanding() {
  const params = useSearchParams();
  const router = useRouter();
  const [joinCode, setJoinCode] = useState(() => normaliseCode(params.get("code") ?? ""));
  const [tab, setTab] = useState<"join" | "create">("join");
  const [saved, setSaved] = useState<{ classCode: string; name: string } | null>(null);

  useEffect(() => {
    // Read after mount so the server render matches the first client render.
    const s = savedLifeSession();
    if (s) queueMicrotask(() => setSaved(s));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <span className="rounded-full bg-leaf/15 px-4 py-1.5 text-sm font-extrabold tracking-wide text-leaf-dark uppercase">New · School Life</span>
        <h1 className="mt-3 text-4xl font-black text-brand">Live your school day</h1>
        <p className="mt-2 text-lg text-ink/75">
          Go to lessons, eat at the canteen, play football with friends, keep your energy up and earn coins for new outfits.
          Everyone in your class shares the same school.
        </p>
      </div>

      {saved && (
        <Card className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-base font-bold text-ink">
            Welcome back, {saved.name}! <span className="font-semibold text-ink/60">Class {saved.classCode}</span>
          </p>
          <Button onClick={() => router.push(`/life/${saved.classCode}`)}>Continue</Button>
        </Card>
      )}

      <Card>
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-ink/5 p-1" role="tablist">
          {(["join", "create"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("min-h-11 rounded-xl text-base font-bold", tab === t ? "bg-white text-brand shadow" : "text-ink/60")}
            >
              {t === "join" ? "I'm a student" : "I'm a teacher"}
            </button>
          ))}
        </div>
        {tab === "join" ? (
          <JoinForm key={joinCode} initialCode={joinCode} />
        ) : (
          <CreateForm
            onJoin={(code) => {
              setJoinCode(code);
              setTab("join");
            }}
          />
        )}
      </Card>

      <p className="text-center text-sm text-ink/60">
        No email or personal details needed. Only your class can see your name.{" "}
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
