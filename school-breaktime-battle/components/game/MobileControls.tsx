"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { playerInput } from "@/lib/game/input";
import { cn } from "@/lib/utils";

const DEAD_ZONE = 0.25;

/**
 * Large touch pad: press anywhere on it and slide toward a direction. Works like a
 * joystick but looks like the familiar up/down/left/right buttons.
 */
export function MobileControls({ className }: { className?: string }) {
  const padRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(
    () => () => {
      playerInput.touch = { dx: 0, dy: 0 };
    },
    [],
  );

  function update(e: PointerEvent<HTMLDivElement>) {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    let dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    let dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len < DEAD_ZONE) {
      dx = 0;
      dy = 0;
    } else if (len > 1) {
      dx /= len;
      dy /= len;
    }
    playerInput.touch = { dx, dy };
    setActive(len < DEAD_ZONE ? null : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  }

  function release() {
    playerInput.touch = { dx: 0, dy: 0 };
    setActive(null);
  }

  const arrow = (dir: string, label: string, pos: string, glyph: string) => (
    <span
      aria-hidden
      className={cn(
        "absolute grid h-[38%] w-[38%] place-items-center rounded-2xl text-2xl font-black shadow-[0_3px_0_0_var(--color-brand-dark)]",
        pos,
        active === dir ? "bg-sun text-ink" : "bg-brand text-white",
      )}
      title={label}
    >
      {glyph}
    </span>
  );

  return (
    <div
      ref={padRef}
      role="group"
      aria-label="Movement pad. Press and slide toward up, down, left or right."
      className={cn("relative aspect-square shrink-0 touch-none select-none rounded-full bg-brand/10", className)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons > 0 || e.pointerType === "touch") update(e);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {arrow("up", "Up", "left-[31%] top-0", "▲")}
      {arrow("down", "Down", "bottom-0 left-[31%]", "▼")}
      {arrow("left", "Left", "left-0 top-[31%]", "◀")}
      {arrow("right", "Right", "right-0 top-[31%]", "▶")}
    </div>
  );
}
