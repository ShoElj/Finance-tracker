"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { playerInput } from "@/lib/game/input";

/** How far the knob can travel from the centre, in CSS pixels. */
const RADIUS = 52;
const DEAD_ZONE = 0.12;
/** Reach full speed a little before the edge so it doesn't feel stiff. */
const SENSITIVITY = 1.25;

/**
 * Floating analog joystick. Touch anywhere in its zone (the left side of the screen) and the
 * stick appears under your thumb. Updates go straight to the DOM and the shared input, so
 * dragging never waits on React.
 */
export function Joystick() {
  const zoneRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const active = useRef<{ id: number; x: number; y: number } | null>(null);
  const [used, setUsed] = useState(false);

  useEffect(
    () => () => {
      playerInput.touch = { dx: 0, dy: 0 };
    },
    [],
  );

  function placeBase(x: number | null, y: number | null) {
    const base = baseRef.current;
    if (!base) return;
    if (x === null || y === null) {
      // Resting position: bottom-left, so players can see where to put their thumb.
      base.style.left = "";
      base.style.top = "";
      base.dataset.active = "false";
    } else {
      base.style.left = `${x - RADIUS - 8}px`;
      base.style.top = `${y - RADIUS - 8}px`;
      base.dataset.active = "true";
    }
  }

  function moveKnob(dx: number, dy: number) {
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (active.current) return;
    const zone = zoneRef.current?.getBoundingClientRect();
    if (!zone) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const x = e.clientX - zone.left;
    const y = e.clientY - zone.top;
    active.current = { id: e.pointerId, x, y };
    placeBase(x, y);
    moveKnob(0, 0);
    if (!used) setUsed(true);
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const a = active.current;
    const zone = zoneRef.current?.getBoundingClientRect();
    if (!a || e.pointerId !== a.id || !zone) return;
    let dx = e.clientX - zone.left - a.x;
    let dy = e.clientY - zone.top - a.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    moveKnob(dx, dy);
    let vx = (dx / RADIUS) * SENSITIVITY;
    let vy = (dy / RADIUS) * SENSITIVITY;
    const mag = Math.hypot(vx, vy);
    if (mag < DEAD_ZONE) {
      vx = 0;
      vy = 0;
    } else if (mag > 1) {
      vx /= mag;
      vy /= mag;
    }
    playerInput.touch = { dx: vx, dy: vy };
  }

  function onUp(e: PointerEvent<HTMLDivElement>) {
    if (!active.current || e.pointerId !== active.current.id) return;
    active.current = null;
    playerInput.touch = { dx: 0, dy: 0 };
    placeBase(null, null);
    moveKnob(0, 0);
  }

  return (
    <div
      ref={zoneRef}
      role="group"
      aria-label="Movement joystick. Touch and drag on the left side of the screen to move."
      className="absolute bottom-0 left-0 z-10 h-[78%] w-[58%] touch-none select-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
    >
      <div
        ref={baseRef}
        data-active="false"
        className="pointer-events-none absolute grid place-items-center rounded-full border-[3px] border-white/80 bg-brand/25 shadow-lg transition-opacity data-[active=false]:bottom-[max(1.25rem,env(safe-area-inset-bottom))] data-[active=false]:left-[max(1.25rem,env(safe-area-inset-left))] data-[active=false]:opacity-70"
        style={{ width: RADIUS * 2 + 16, height: RADIUS * 2 + 16 }}
      >
        <span aria-hidden className="absolute top-1 text-xs font-black text-white/90">▲</span>
        <span aria-hidden className="absolute bottom-1 text-xs font-black text-white/90">▼</span>
        <span aria-hidden className="absolute left-1.5 text-xs font-black text-white/90">◀</span>
        <span aria-hidden className="absolute right-1.5 text-xs font-black text-white/90">▶</span>
        <div
          ref={knobRef}
          className="h-14 w-14 rounded-full border-[3px] border-white bg-sun shadow-[0_4px_10px_rgba(0,0,0,0.3)]"
        />
      </div>
      {!used && (
        <p className="pointer-events-none absolute bottom-[calc(max(1.25rem,env(safe-area-inset-bottom))+128px)] left-[max(1.25rem,env(safe-area-inset-left))] rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-brand shadow">
          Drag here to move
        </p>
      )}
    </div>
  );
}
