"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BottomSheet } from "@/components/game/BottomSheet";
import { GameCanvas } from "@/components/game/GameCanvas";
import { Joystick } from "@/components/game/Joystick";
import { useMuted } from "@/hooks/useMuted";
import { useTouchLayout } from "@/hooks/useTouchLayout";
import { getLifeClient } from "@/lib/life/client";
import { friendLevel, GREETINGS, SOCIAL_RULES } from "@/lib/life/friendship";
import { level } from "@/lib/life/sim";
import type { NeedKey } from "@/lib/life/types";
import { cn } from "@/lib/utils";
import { useLifeStore, type LifeHud } from "@/store/lifeStore";
import { LookAvatar } from "./LookPreview";
import { WardrobeSheet } from "./WardrobeSheet";

type Sheet = { kind: "goals" } | { kind: "wardrobe" } | { kind: "people" } | { kind: "menu" } | { kind: "talk"; id: string } | null;

const NEEDS: { key: NeedKey; emoji: string; label: string }[] = [
  { key: "energy", emoji: "⚡", label: "Energy" },
  { key: "hunger", emoji: "🍛", label: "Food" },
  { key: "fun", emoji: "😄", label: "Fun" },
  { key: "social", emoji: "🤝", label: "Friends" },
];

const pill = "pointer-events-auto flex h-11 items-center gap-1.5 rounded-full px-3.5 font-black shadow-md";

function formatLeft(seconds: number): string {
  const s = Math.ceil(seconds);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

function NeedBar({ value, emoji, label }: { value: number; emoji: string; label: string }) {
  const low = value < 25;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1" title={`${label}: ${Math.round(value)}%`}>
      <span aria-hidden className="text-sm">
        {emoji}
      </span>
      <div
        className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink/15"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", low ? "bg-danger" : value < 50 ? "bg-sun" : "bg-leaf")}
          style={{ width: `${Math.max(3, value)}%` }}
        />
      </div>
    </div>
  );
}

function Hud({ hud, onOpen }: { hud: LifeHud; onOpen: (sheet: Sheet) => void }) {
  const goalsDone = hud.goals.filter((g) => g.done).length;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-1.5 px-[max(0.5rem,env(safe-area-inset-left))] pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-1.5">
        <div className={cn(pill, "min-w-0 bg-brand text-white")} aria-label={`${hud.clockLabel}, ${hud.periodName}`}>
          <span className="whitespace-nowrap tabular-nums">{hud.clockLabel}</span>
          <span className="min-w-0 truncate text-sm font-bold text-white/80">
            {hud.subject ?? hud.periodName}
            <span className="hidden sm:inline"> · {formatLeft(hud.secondsLeftInPeriod)} left</span>
          </span>
        </div>
        <div className={cn(pill, "bg-white text-brand")} aria-label={`${hud.coins} coins`}>
          🪙 <span className="tabular-nums">{hud.coins}</span>
        </div>
        <button type="button" onClick={() => onOpen({ kind: "menu" })} className={cn(pill, "ml-auto w-11 justify-center bg-white px-0 text-xl text-brand")} aria-label="Menu">
          ☰
        </button>
      </div>
      <div className="pointer-events-auto flex max-w-xl items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-md">
        {NEEDS.map((n) => (
          <NeedBar key={n.key} value={hud.needs[n.key]} emoji={n.emoji} label={n.label} />
        ))}
        <span className="shrink-0 rounded-lg bg-brand/10 px-2 py-0.5 text-sm font-black text-brand" title={`Today's grade (${hud.gradePoints} points)`}>
          📝 {hud.gradePoints > 0 ? hud.grade : "–"}
        </span>
      </div>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => onOpen({ kind: "goals" })} className={cn(pill, "h-10 bg-sun text-sm text-ink")}>
          🎯 Goals {goalsDone}/{hud.goals.length}
        </button>
        <button type="button" onClick={() => onOpen({ kind: "wardrobe" })} className={cn(pill, "h-10 bg-white text-sm text-brand")}>
          👕 Wardrobe
        </button>
        <button type="button" onClick={() => onOpen({ kind: "people" })} className={cn(pill, "h-10 bg-white text-sm text-brand")}>
          👥 {hud.onlineCount}
        </button>
      </div>
    </div>
  );
}

function Actions({ hud, onTalk, touch }: { hud: LifeHud; onTalk: (id: string) => void; touch: boolean }) {
  const client = getLifeClient();
  if (hud.activity) {
    return (
      <div className="absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-4" role="status">
        <div className="w-full max-w-sm rounded-2xl bg-white/95 p-3 shadow-lg">
          <p className="mb-1.5 text-center text-base font-bold text-ink">
            {hud.activity.emoji} You are {hud.activity.label}…
          </p>
          <div className="h-3 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-leaf transition-[width] duration-200" style={{ width: `${hud.activity.progress * 100}%` }} />
          </div>
          <p className="mt-1 text-center text-xs text-ink/60">Moving will stop it.</p>
        </div>
      </div>
    );
  }
  const spot = hud.nearSpot;
  return (
    <div className="absolute right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 flex flex-col items-end gap-2">
      {hud.nearClassmate && (
        <button
          type="button"
          onClick={() => onTalk(hud.nearClassmate!.id)}
          className="min-h-12 rounded-full border-[3px] border-white bg-brand px-5 text-base font-black text-white shadow-lg active:scale-95"
        >
          👋 Talk to {hud.nearClassmate.name}
          {!touch && <span className="ml-1 text-xs font-bold text-white/70">(T)</span>}
        </button>
      )}
      {spot && (
        <button
          type="button"
          onClick={() => client?.doActivity()}
          aria-disabled={Boolean(spot.blocker)}
          className={cn(
            "flex min-h-16 max-w-[70vw] flex-col items-end rounded-3xl border-[3px] border-white px-5 py-2 text-right shadow-lg active:scale-95",
            spot.blocker ? "bg-ink/60 text-white" : "bg-sun text-ink",
          )}
        >
          <span className="text-lg font-black">
            {spot.emoji} {spot.label}
            {!touch && <span className="ml-1 text-xs font-bold opacity-60">(E)</span>}
          </span>
          <span className="text-xs font-bold opacity-80">
            {spot.blocker ?? `${spot.durationSec}s${spot.cost ? ` · ${spot.cost} 🪙` : ""}`}
          </span>
        </button>
      )}
    </div>
  );
}

function Toasts() {
  const toasts = useLifeStore((s) => s.toasts);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const recent = toasts.filter((t) => now - t.at < 3500).slice(-2);
  return (
    <ul className="pointer-events-none absolute inset-x-0 top-[calc(max(0.5rem,env(safe-area-inset-top))+9.5rem)] z-20 flex flex-col items-center gap-1 px-4" aria-live="polite">
      {recent.map((t) => (
        <li
          key={t.id}
          className={cn(
            "animate-pop max-w-full rounded-2xl px-3 py-1.5 text-center text-sm font-bold shadow",
            t.tone === "good" && "bg-leaf text-white",
            t.tone === "bad" && "bg-danger text-white",
            t.tone === "info" && "bg-white text-brand",
          )}
        >
          {t.text}
        </li>
      ))}
    </ul>
  );
}

function GoalsSheet({ hud }: { hud: LifeHud }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base text-ink/70">New goals every school day. Finish them for coins!</p>
      {hud.goals.map((g) => (
        <div key={g.id} className={cn("rounded-2xl p-3", g.done ? "bg-leaf/15" : "bg-ink/5")}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-bold text-ink">
              {g.done ? "✅" : "🎯"} {g.text}
            </p>
            <span className="shrink-0 text-sm font-black text-brand">+{g.reward} 🪙</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-leaf" style={{ width: `${(g.value / g.target) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs font-bold text-ink/60">
            {g.value} / {g.target}
          </p>
        </div>
      ))}
      <div className="mt-1 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-sky p-2">
          <p className="text-xs font-bold text-ink/60">Level</p>
          <p className="text-2xl font-black text-brand">{level(hud.xp)}</p>
        </div>
        <div className="rounded-2xl bg-sky p-2">
          <p className="text-xs font-bold text-ink/60">Today&apos;s grade</p>
          <p className="text-2xl font-black text-brand">{hud.gradePoints > 0 ? hud.grade : "–"}</p>
        </div>
        <div className="rounded-2xl bg-sky p-2">
          <p className="text-xs font-bold text-ink/60">Mood</p>
          <p className="text-2xl font-black text-brand">{hud.mood}%</p>
        </div>
      </div>
    </div>
  );
}

function PeopleSheet({ onTalk }: { onTalk: (id: string) => void }) {
  const roster = useLifeStore((s) => s.roster);
  if (roster.length === 0) {
    return <p className="text-base text-ink/70">No classmates yet. Share your school code so friends can join!</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {roster.map((r) => {
        const lvl = friendLevel(r.friendship);
        return (
          <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-ink/5 p-2.5">
            <LookAvatar look={r.look} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-extrabold text-ink">
                <span className={cn("mr-1.5 inline-block h-2.5 w-2.5 rounded-full", r.online ? "bg-leaf" : "bg-ink/25")} aria-hidden />
                {r.name}
              </p>
              <p className="text-sm text-ink/60">
                {"❤️".repeat(lvl.hearts)} {lvl.name}
                {r.online ? " · at school" : ""}
              </p>
            </div>
            {r.nearby && (
              <button type="button" onClick={() => onTalk(r.id)} className="min-h-11 rounded-xl bg-brand px-3 text-sm font-bold text-white">
                Talk
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function TalkSheet({ targetId, onDone }: { targetId: string; onDone: () => void }) {
  const entry = useLifeStore((s) => s.roster.find((r) => r.id === targetId));
  const coins = useLifeStore((s) => s.hud?.coins ?? 0);
  const [busy, setBusy] = useState(false);
  const client = getLifeClient();
  if (!entry || !client) return null;
  const lvl = friendLevel(entry.friendship);

  async function act(kind: "hi" | "help" | "share", line?: string) {
    if (busy) return;
    setBusy(true);
    const ok = await getLifeClient()?.social(kind, targetId, line);
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <LookAvatar look={entry.look} size={52} />
        <div>
          <p className="text-lg font-black text-ink">{entry.name}</p>
          <p className="text-sm text-ink/60">
            {"❤️".repeat(lvl.hearts)} {lvl.name} · {entry.friendship} friendship
          </p>
        </div>
      </div>
      <p className="text-sm font-bold text-ink/60">Say something</p>
      <div className="grid grid-cols-2 gap-2">
        {GREETINGS.map((g) => (
          <button
            key={g}
            type="button"
            disabled={busy}
            onClick={() => act("hi", g)}
            className="min-h-12 rounded-2xl bg-sky px-3 text-base font-bold text-brand active:scale-95 disabled:opacity-50"
          >
            {g}
          </button>
        ))}
      </div>
      <p className="text-sm font-bold text-ink/60">Do something nice</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => act("help")}
          className="min-h-14 rounded-2xl bg-leaf/15 px-3 text-base font-bold text-leaf-dark active:scale-95 disabled:opacity-50"
        >
          📚 Help with homework
          <span className="block text-xs font-bold opacity-70">In library or classroom</span>
        </button>
        <button
          type="button"
          disabled={busy || coins < SOCIAL_RULES.share.cost}
          onClick={() => act("share")}
          className="min-h-14 rounded-2xl bg-sun/40 px-3 text-base font-bold text-ink active:scale-95 disabled:opacity-50"
        >
          🍩 Share a snack
          <span className="block text-xs font-bold opacity-70">{SOCIAL_RULES.share.cost} 🪙</span>
        </button>
      </div>
    </div>
  );
}

function MenuSheet({ onClose }: { onClose: () => void }) {
  const [muted, toggleMuted] = useMuted();
  const me = useLifeStore((s) => s.me);
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const item = "flex min-h-14 w-full items-center gap-3 rounded-2xl bg-ink/5 px-4 text-left text-lg font-bold text-ink active:bg-sun/40";
  return (
    <div className="flex flex-col gap-2">
      {me && (
        <div className="rounded-2xl bg-sky p-3">
          <p className="text-sm font-bold text-ink/60">{me.className} · school code</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-black tracking-widest text-brand">{me.classCode}</p>
            <button
              type="button"
              className="min-h-10 rounded-xl bg-white px-3 text-sm font-bold text-brand"
              onClick={() => {
                void navigator.clipboard?.writeText(me.classCode).then(() => setCopied(true), () => undefined);
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
      <button type="button" className={item} onClick={toggleMuted} aria-pressed={!muted}>
        <span aria-hidden>{muted ? "🔇" : "🔊"}</span> Sound {muted ? "off" : "on"}
      </button>
      <div className="rounded-2xl bg-ink/5 p-3 text-sm text-ink/70">
        <p className="mb-1 font-bold text-ink">How to play</p>
        Walk to a sign to do an activity. Keep your ⚡🍛😄🤝 bars up, attend lessons for good grades, finish
        goals for coins, and be kind to classmates to make friends. A school day lasts 10 minutes.
      </div>
      <button
        type="button"
        className={cn(item, "text-danger")}
        onClick={async () => {
          onClose();
          await getLifeClient()?.signOut();
          router.push("/life");
        }}
      >
        <span aria-hidden>🚪</span> Sign out
      </button>
    </div>
  );
}

function ReportCardModal() {
  const report = useLifeStore((s) => s.report);
  if (!report) return null;
  const great = report.grade === "A" || report.grade === "B";
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div className="animate-pop w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl">
        <p className="text-5xl" aria-hidden>
          {great ? "🌟" : "📒"}
        </p>
        <h2 id="report-title" className="mt-1 text-2xl font-black text-brand">
          Report card
        </h2>
        <p className="text-base text-ink/60">The school day is over. Here&apos;s how you did:</p>
        <div className="my-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-sky p-3">
            <p className="text-xs font-bold text-ink/60">Grade</p>
            <p className="text-4xl font-black text-brand">{report.grade}</p>
          </div>
          <div className="rounded-2xl bg-sun/40 p-3">
            <p className="text-xs font-bold text-ink/60">Coins earned</p>
            <p className="text-4xl font-black text-ink">{report.coinsEarned}</p>
          </div>
          <div className="rounded-2xl bg-leaf/15 p-3">
            <p className="text-xs font-bold text-ink/60">Goals</p>
            <p className="text-2xl font-black text-leaf-dark">
              {report.goalsDone}/{report.goalsTotal}
            </p>
          </div>
          <div className="rounded-2xl bg-ink/5 p-3">
            <p className="text-xs font-bold text-ink/60">Mood</p>
            <p className="text-2xl font-black text-ink">{report.mood}%</p>
          </div>
        </div>
        <p className="mb-4 text-sm text-ink/70">A new day starts soon — you&apos;ll get new goals.</p>
        <button
          type="button"
          onClick={() => getLifeClient()?.closeReport()}
          className="min-h-12 w-full rounded-2xl bg-brand text-lg font-bold text-white shadow-[0_4px_0_0_var(--color-brand-dark)]"
        >
          Nice!
        </button>
      </div>
    </div>
  );
}

export function LifeGame() {
  const hud = useLifeStore((s) => s.hud);
  const touch = useTouchLayout();
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = useCallback(() => setSheet(null), []);
  const talk = useCallback((id: string) => setSheet({ kind: "talk", id }), []);

  // Desktop shortcuts: E to do the activity here, T to talk to the nearest classmate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const client = getLifeClient();
      if (!client) return;
      if (e.code === "KeyE" || e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        client.doActivity();
      } else if (e.code === "KeyT") {
        const near = client.nearestClassmate();
        if (near) talk(near.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, talk]);

  return (
    <div className="fixed inset-0 touch-none overflow-hidden overscroll-none bg-[#8fcf7a] select-none">
      <GameCanvas fullBleed world="life" />
      {touch && <Joystick />}
      {hud && <Hud hud={hud} onOpen={setSheet} />}
      <Toasts />
      {hud && <Actions hud={hud} onTalk={talk} touch={touch} />}
      {!touch && (
        <p className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-full bg-white/85 px-3 py-1 text-sm font-bold text-ink/70">
          Move: WASD / arrows · Act: E · Talk: T
        </p>
      )}

      {sheet?.kind === "goals" && hud && (
        <BottomSheet title="Today's goals" onClose={close}>
          <GoalsSheet hud={hud} />
        </BottomSheet>
      )}
      {sheet?.kind === "wardrobe" && (
        <BottomSheet title="Wardrobe" onClose={close}>
          <WardrobeSheet />
        </BottomSheet>
      )}
      {sheet?.kind === "people" && (
        <BottomSheet title="Classmates" onClose={close}>
          <PeopleSheet onTalk={talk} />
        </BottomSheet>
      )}
      {sheet?.kind === "talk" && (
        <BottomSheet title="Talk" onClose={close}>
          <TalkSheet targetId={sheet.id} onDone={close} />
        </BottomSheet>
      )}
      {sheet?.kind === "menu" && (
        <BottomSheet title="Menu" onClose={close}>
          <MenuSheet onClose={close} />
        </BottomSheet>
      )}
      <ReportCardModal />
    </div>
  );
}
