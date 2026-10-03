"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { LoadingCard, RoomEndedCard } from "@/components/layout/RoomNotice";
import { LifeGame } from "@/components/life/LifeGame";
import { LifeClient } from "@/lib/life/client";
import { useLifeStore } from "@/store/lifeStore";

export default function LifeWorldPage() {
  const { classCode } = useParams<{ classCode: string }>();
  const router = useRouter();
  const status = useLifeStore((s) => s.status);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    LifeClient.resume(classCode)
      .then((client) => {
        if (!client && !cancelled) router.replace(`/life?code=${encodeURIComponent(classCode.toUpperCase())}`);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not open your school.");
      });
    return () => {
      cancelled = true;
    };
  }, [classCode, router]);

  if (status === "signed_out") {
    return (
      <PageShell>
        <RoomEndedCard message="You signed in on another device, so this one was signed out." retryHref="/life" retryLabel="Sign in again" />
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell>
        <RoomEndedCard message={error} retryHref="/life" retryLabel="Back to School Life" />
      </PageShell>
    );
  }
  if (status !== "playing") {
    return (
      <PageShell>
        <LoadingCard text="Walking to school…" />
      </PageShell>
    );
  }
  return <LifeGame />;
}
