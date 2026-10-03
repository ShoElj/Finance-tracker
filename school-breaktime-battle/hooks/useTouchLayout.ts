"use client";

import { useSyncExternalStore } from "react";

/** Phones, tablets and narrow windows get the full-screen touch layout. */
const QUERY = "(pointer: coarse), (max-width: 1023px)";

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useTouchLayout(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
