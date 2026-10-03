"use client";

import { useEffect, useRef, useState } from "react";
import { bindKeyboard, playerInput } from "@/lib/game/input";
import { getActiveClient } from "@/lib/room/room-client";

type ScaleInternals = { parent: HTMLElement | null; getParentBounds: () => boolean };

/**
 * When the page is navigating away, the container can be hidden (0×0) for a frame before
 * React unmounts it. Resizing WebGL to 0×0 throws, so skip size checks while it is empty.
 */
function ignoreZeroSizedParent(game: import("phaser").Game): void {
  const scale = game.scale as unknown as ScaleInternals;
  const original = scale.getParentBounds.bind(game.scale);
  scale.getParentBounds = () => {
    const rect = scale.parent?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return false;
    return original();
  };
}

/** Mounts the Phaser game. Phaser is loaded on the client only. */
export function GameCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => bindKeyboard(playerInput), []);

  useEffect(() => {
    let cancelled = false;
    let game: import("phaser").Game | null = null;
    (async () => {
      try {
        const mod = await import("phaser");
        const Phaser = (mod as unknown as { default?: typeof mod }).default ?? mod;
        const { createSchoolScene } = await import("@/lib/game/phaser/createSchoolScene");
        if (cancelled || !ref.current) return;
        const Scene = createSchoolScene(Phaser, () => getActiveClient()?.runtime ?? null);
        game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: ref.current,
          backgroundColor: "#8fcf7a",
          // The canvas fills its container; the scene's camera decides how much of the map to show.
          scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
          scene: [Scene],
          input: { keyboard: false, mouse: false, touch: false, gamepad: false },
          audio: { noAudio: true },
          banner: false,
          render: { antialias: true, powerPreference: "low-power" },
        });
        ignoreZeroSizedParent(game);
        setLoading(false);
      } catch (e) {
        console.error("Failed to start the game canvas", e);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (game) {
        // Phaser destroys on its next tick; stop it resizing to the now-removed (0×0) container first.
        (game.scale as unknown as ScaleInternals).parent = null;
        game.destroy(true);
      }
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div
        ref={ref}
        className="h-full w-full overflow-hidden rounded-2xl"
        role="img"
        aria-label="School map: classroom on the left, corridor in the middle, canteen on the right, water tap below and open space above."
      />
      {loading && !failed && (
        <div className="absolute inset-0 grid place-items-center rounded-2xl bg-[#8fcf7a] text-lg font-bold text-brand" role="status">
          Loading the school…
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white p-4 text-center font-bold text-danger" role="alert">
          The game could not load on this device. Try refreshing the page.
        </div>
      )}
    </div>
  );
}
