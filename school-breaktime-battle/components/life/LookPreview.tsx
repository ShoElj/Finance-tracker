"use client";

import { useEffect, useRef } from "react";
import { drawStudent, STUDENT_HEIGHT, STUDENT_WIDTH, type Look } from "@/lib/game/art/students";

/** Full-body drawing of a student in a given outfit. */
export function LookPreview({ look, height = 132, className }: { look: Look; height?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const width = Math.round((height * STUDENT_WIDTH) / STUDENT_HEIGHT);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(drawStudent(look, "front", 0), 0, 0, canvas.width, canvas.height);
  }, [look, width, height]);

  return <canvas ref={ref} width={width * 2} height={height * 2} style={{ width, height }} className={className} aria-hidden />;
}

/** Round head-and-shoulders avatar for a custom outfit. */
export function LookAvatar({ look, size = 40 }: { look: Look | null; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !look) return;
    const art = drawStudent(look, "front", 0);
    const s = art.width / STUDENT_WIDTH;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(art, 2 * s, 0, 28 * s, 28 * s, 0, canvas.height * 0.06, canvas.width, canvas.height);
  }, [look, size]);

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-brand/80 bg-sky"
      style={{ width: size, height: size }}
    >
      {look ? <canvas ref={ref} width={size * 2} height={size * 2} className="h-full w-full" /> : <span>🙂</span>}
    </span>
  );
}
