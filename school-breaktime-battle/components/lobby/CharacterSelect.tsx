"use client";

import { characters } from "@/lib/game/characters";
import type { CharacterKey } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { CharacterAvatar } from "./CharacterAvatar";

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
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Characters">
      {characters.map((c) => {
        const isSelected = c.key === selected;
        return (
          <li key={c.key}>
            <div
              className={cn(
                "flex h-full flex-col gap-3 rounded-2xl border-[3px] bg-white p-4 transition",
                isSelected ? "border-leaf bg-leaf/5 shadow-[0_4px_0_0_var(--color-leaf-dark)]" : "border-brand/10",
              )}
            >
              <div className="flex items-center gap-3">
                <CharacterAvatar characterKey={c.key} size="lg" />
                <div>
                  <h3 className="text-lg font-extrabold text-ink">{c.name}</h3>
                  <p className="text-base leading-snug text-ink/70">{c.description}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(c.key)}
                aria-pressed={isSelected}
                className={cn(
                  "mt-auto min-h-11 rounded-xl text-base font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/70 disabled:opacity-60",
                  isSelected ? "bg-leaf text-white" : "bg-brand/10 text-brand hover:bg-brand/20",
                )}
              >
                {isSelected ? "✓ Selected" : `Select ${c.name}`}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
