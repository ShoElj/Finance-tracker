import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function DemoBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <div role="status" className="bg-sun px-4 py-2 text-center text-sm font-bold text-ink sm:text-base">
      Demo mode active. Realtime rooms require Supabase configuration.
      <span className="hidden font-semibold sm:inline"> You can still play vs bots, or open another tab to join your room.</span>
    </div>
  );
}

export function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
      <Link href="/" className="flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60">
        <span aria-hidden className="grid h-10 w-10 place-items-center rounded-2xl bg-brand text-xl shadow-[0_3px_0_0_var(--color-brand-dark)]">
          🔔
        </span>
        <span className="text-lg font-black leading-tight text-brand sm:text-xl">
          School Breaktime <span className="text-leaf-dark">Battle</span>
        </span>
      </Link>
      {right}
    </header>
  );
}
