"use client";

import { useEffect, useRef } from "react";
import { ART_SCALE, studentPortrait } from "@/lib/game/art/students";
import { getCharacter } from "@/lib/game/characters";
import type { CharacterKey } from "@/lib/game/types";
import { cn } from "@/lib/utils";

const SIZES = { sm: 32, md: 44, lg: 64 } as const;
/** Head and shoulders: the top part of the full-body drawing, in drawing units. */
const CROP = { x: 2, y: 0, size: 28 };

export function CharacterAvatar({ characterKey, size = "md" }: { characterKey: CharacterKey | null; size?: "sm" | "md" | "lg" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const px = SIZES[size];

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!characterKey) return;
    const portrait = studentPortrait(characterKey);
    const s = ART_SCALE;
    ctx.drawImage(portrait, CROP.x * s, CROP.y * s, CROP.size * s, CROP.size * s, 0, canvas.height * 0.06, canvas.width, canvas.height);
  }, [characterKey, px]);

  const c = characterKey ? getCharacter(characterKey) : null;
  return (
    <span
      aria-hidden
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-brand/80"
      style={{ width: px, height: px, backgroundColor: c ? `${c.color}33` : "#e5e7eb" }}
    >
      {c ? (
        <canvas ref={ref} width={px * 2} height={px * 2} className="h-full w-full" />
      ) : (
        <span className={cn(size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-base")}>❔</span>
      )}
    </span>
  );
}

