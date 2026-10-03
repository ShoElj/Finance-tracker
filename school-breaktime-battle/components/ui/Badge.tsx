import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "blue" | "yellow" | "green" | "red" | "gray";

const tones: Record<Tone, string> = {
  blue: "bg-brand/10 text-brand",
  yellow: "bg-sun/30 text-ink",
  green: "bg-leaf/15 text-leaf-dark",
  red: "bg-danger/10 text-danger",
  gray: "bg-ink/5 text-ink/70",
};

export function Badge({ tone = "blue", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold", tones[tone], className)}
      {...props}
    />
  );
}
