import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-3xl border-2 border-brand/10 bg-white p-5 shadow-[0_6px_0_0_rgba(30,58,138,0.12)] sm:p-6", className)}
      {...props}
    />
  );
}
