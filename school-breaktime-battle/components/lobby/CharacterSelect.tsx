"use client";

import { characters } from "@/lib/game/characters";
import type { CharacterKey } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { CharacterAvatar } from "./CharacterAvatar";

/** Character tiles. The whole tile is the button, so it is an easy tap target on phones. */
export function CharacterSelect({
  selected,
  onSelect,
  disabled = false,
}: {
  selected: CharacterKey | null;
  onSelect: (key: CharacterKey) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:gap-3" aria-label="Characters">
      {characters.map((c) => {
        const isSelected = c.key === selected;
        return (
          <li key={c.key}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(c.key)}
              aria-pressed={isSelected}
              aria-label={`Select ${c.name}`}
              aria-describedby={`character-${c.key}-ability`}
              className={cn(
                "relative flex h-full w-full flex-col items-center gap-2 rounded-2xl border-[3px] bg-white p-3 text-center transition active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/70 disabled:opacity-60",
                "sm:flex-row sm:items-center sm:gap-3 sm:p-4 sm:text-left",
                isSelected ? "border-leaf bg-leaf/5 shadow-[0_4px_0_0_var(--color-leaf-dark)]" : "border-brand/10 hover:border-brand/30",
              )}
            >
              {isSelected && (
                <span className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-leaf text-sm font-black text-white" aria-hidden>
                  ✓
                </span>
              )}
              <CharacterAvatar characterKey={c.key} size="lg" />
              <span className="min-w-0">
                <span className="block text-base font-extrabold text-ink">{c.name}</span>
                <span id={`character-${c.key}-ability`} className="block text-sm leading-snug text-ink/70">
                  {c.description}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
