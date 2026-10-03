import { getCharacter } from "@/lib/game/characters";
import type { CharacterKey } from "@/lib/game/types";
import { cn } from "@/lib/utils";

export function CharacterAvatar({ characterKey, size = "md" }: { characterKey: CharacterKey | null; size?: "sm" | "md" | "lg" }) {
  const c = characterKey ? getCharacter(characterKey) : null;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-[3px] border-brand/80",
        size === "sm" && "h-8 w-8 text-base",
        size === "md" && "h-11 w-11 text-xl",
        size === "lg" && "h-16 w-16 text-3xl",
      )}
      style={{ backgroundColor: c?.color ?? "#e5e7eb" }}
    >
      {c?.emoji ?? "❔"}
    </span>
  );
}
