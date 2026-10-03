import Link from "next/link";
import { SchoolIllustration } from "@/components/landing/SchoolIllustration";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/Card";

const linkButton =
  "inline-flex min-h-14 items-center justify-center rounded-2xl px-7 text-lg font-bold transition active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/70";

const steps = [
  { icon: "🍪", title: "Grab snacks", text: "Race to the canteen for puff puff, meat pie and more." },
  { icon: "🧑‍✈️", title: "Dodge prefects", text: "Getting caught costs 20 points and freezes you." },
  { icon: "🔔", title: "Beat the bell", text: "Be back in class when the bell rings for +25." },
];

export default function LandingPage() {
  return (
    <PageShell wide>
      <section className="grid items-center gap-8 py-4 md:grid-cols-2 md:gap-12 md:py-10">
        <div className="flex flex-col gap-6">
          <span className="w-fit rounded-full bg-leaf/15 px-4 py-1.5 text-sm font-extrabold uppercase tracking-wide text-leaf-dark">
            Canteen Rush · 2–8 players
          </span>
          <h1 className="text-4xl font-black leading-tight text-brand sm:text-5xl">
            Break time has started.
            <span className="block text-ink">Can you win before the bell rings?</span>
          </h1>
          <p className="text-lg leading-relaxed text-ink/80 sm:text-xl">
            Join your classmates in a fast school-themed multiplayer game. Race to the canteen, collect snacks, avoid
            prefects, and return to class before time runs out.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/create" className={`${linkButton} bg-brand text-white shadow-[0_4px_0_0_var(--color-brand-dark)] hover:bg-brand-light`}>
              Create Game Room
            </Link>
            <Link href="/join" className={`${linkButton} bg-sun text-ink shadow-[0_4px_0_0_var(--color-sun-dark)] hover:brightness-105`}>
              Join With Code
            </Link>
          </div>
          <Link
            href="/create?practice=1"
            className="w-fit rounded-lg text-base font-bold text-brand underline decoration-sun decoration-4 underline-offset-4 hover:text-brand-light focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60"
          >
            Practice alone against bots →
          </Link>
        </div>
        <Card className="p-3 sm:p-4">
          <SchoolIllustration />
        </Card>
      </section>

      <section aria-labelledby="school-life" className="mt-2 mb-8">
        <Card className="flex flex-col gap-4 bg-gradient-to-r from-leaf/10 to-sky sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="rounded-full bg-leaf px-3 py-1 text-xs font-extrabold tracking-wide text-white uppercase">New</span>
            <h2 id="school-life" className="mt-2 text-2xl font-black text-brand">
              Student Life
            </h2>
            <p className="text-base text-ink/75">
              Start a school with your friends and live the student life: lessons, canteen, football, friendships, outfits and a report card.
            </p>
          </div>
          <Link href="/life" className={`${linkButton} shrink-0 bg-leaf text-white shadow-[0_4px_0_0_var(--color-leaf-dark)]`}>
            Go to Student Life
          </Link>
        </Card>
      </section>

      <section aria-labelledby="how-to-play" className="mt-4">
        <h2 id="how-to-play" className="mb-4 text-2xl font-black text-brand">
          How to play
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.title}>
              <Card className="flex h-full items-start gap-4">
                <span aria-hidden className="text-4xl">
                  {s.icon}
                </span>
                <div>
                  <h3 className="text-lg font-extrabold text-ink">{s.title}</h3>
                  <p className="text-base text-ink/75">{s.text}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
