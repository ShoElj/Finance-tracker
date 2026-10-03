"use client";

import { Badge } from "@/components/ui/Badge";
import { characterLabel } from "@/lib/room/room-client";
import type { LobbyPlayer } from "@/lib/realtime/room-events";
import { CharacterAvatar } from "./CharacterAvatar";

export function PlayerList({
  players,
  maxPlayers,
  myId,
  canRemove,
  onRemove,
}: {
  players: LobbyPlayer[];
  maxPlayers: number;
  myId: string;
  canRemove: boolean;
  onRemove: (playerId: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-black text-brand">Players</h2>
        <Badge tone="yellow">
          {players.length} / {maxPlayers}
        </Badge>
      </div>
      <ul className="flex flex-col gap-2" aria-live="polite">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-cream px-3 py-2.5">
            <CharacterAvatar characterKey={p.characterKey} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-extrabold text-ink">
                {p.name}
                {p.id === myId && <span className="text-brand"> (You)</span>}
              </p>
              <p className="text-sm text-ink/65">{characterLabel(p.characterKey)}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {p.isHost && <Badge tone="blue">Host</Badge>}
              {p.isBot && <Badge tone="gray">Bot</Badge>}
              {!p.connected && <Badge tone="red">Inactive</Badge>}
              {canRemove && !p.isHost && (
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  className="min-h-9 rounded-xl px-3 text-sm font-bold text-danger ring-2 ring-danger/30 hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-4"
                  aria-label={`Remove ${p.name}`}
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
