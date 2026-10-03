"use client";

import { useState } from "react";
import { isMuted, setMuted } from "@/lib/sound";

export function useMuted(): [boolean, () => void] {
  const [muted, setState] = useState(() => isMuted());
  return [
    muted,
    () => {
      setMuted(!muted);
      setState(!muted);
    },
  ];
}
