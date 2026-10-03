"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { getActiveClient } from "@/lib/room/room-client";
import type { ConnectionState } from "@/store/gameStore";

const homeLink =
  "inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand px-6 text-base font-bold text-white shadow-[0_4px_0_0_var(--color-brand-dark)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/70";

/** Full-page message when the room cannot be shown (closed, removed, failed to reconnect). */
export function RoomEndedCard({ message }: { message: string }) {
  return (
    <Card className="animate-pop mx-auto mt-6 max-w-lg text-center">
      <p className="text-5xl" aria-hidden>
        🔕
      </p>
      <h1 className="mt-3 text-2xl font-black text-brand">{message}</h1>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/" className={homeLink}>
          Back to Home
        </Link>
        <Link href="/join" className={`${homeLink} bg-sun text-ink shadow-[0_4px_0_0_var(--color-sun-dark)]`}>
          Join another room
        </Link>
      </div>
    </Card>
  );
}

/** Banner for temporary connection problems. */
export function ConnectionBanner({ connection, notice }: { connection: ConnectionState; notice: string | null }) {
  const router = useRouter();
  if (connection === "reconnecting") {
    return (
      <div role="status" className="mb-4 rounded-2xl bg-sun/40 px-4 py-3 text-base font-bold text-ink">
        {notice ?? "Connection lost. Trying to reconnect."}
      </div>
    );
  }
  if (connection === "host_lost") {
    return (
      <div role="alert" className="mb-4 flex flex-col gap-3 rounded-2xl bg-danger/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base font-bold text-danger">Host disconnected. Waiting for the host to come back…</p>
        <button
          type="button"
          className="min-h-11 rounded-xl bg-white px-4 font-bold text-danger ring-2 ring-danger/30"
          onClick={() => {
            getActiveClient()?.leave();
            router.push("/");
          }}
        >
          Leave Room
        </button>
      </div>
    );
  }
  return null;
}

export function LoadingCard({ text }: { text: string }) {
  return (
    <Card className="mx-auto mt-6 flex max-w-lg items-center justify-center gap-3 text-lg font-bold text-brand" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-brand border-t-transparent" aria-hidden />
      {text}
    </Card>
  );
}
