"use client";

import { useState } from "react";
import { REACTION_COOLDOWN_MS, REACTIONS, type Reaction } from "@/lib/game/constants";
import { getActiveClient } from "@/lib/room/room-client";

/** Preset safe reactions only — there is no free chat. */
export function ReactionPanel({ className }: { className?: string }) {
  const [cooling, setCooling] = useState(false);

  function send(reaction: Reaction) {
    if (cooling) return;
    if (getActiveClient()?.sendReaction(reaction)) {
      setCooling(true);
      setTimeout(() => setCooling(false), REACTION_COOLDOWN_MS);
    }
  }

  return (
    <div className={className} role="group" aria-label="Quick reactions">
      <div className="flex flex-wrap justify-center gap-2">
        {REACTIONS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={cooling}
            onClick={() => send(r)}
            className="min-h-10 shrink-0 rounded-full bg-white px-3 text-sm font-bold text-brand ring-2 ring-brand/15 transition hover:bg-sun/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun disabled:opacity-50 sm:min-h-11 sm:px-4 sm:text-base"
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
