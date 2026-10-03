"use client";

import { useState } from "react";
import { getLifeClient } from "@/lib/life/client";
import { CATEGORY_LABELS, isOwned, isWorn, wardrobe, type WardrobeCategory } from "@/lib/life/wardrobe";
import { cn } from "@/lib/utils";
import { useLifeStore } from "@/store/lifeStore";
import { LookPreview } from "./LookPreview";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as WardrobeCategory[];

/** Change outfit. Free items can be worn straight away; others are bought once with coins. */
export function WardrobeSheet() {
  const look = useLifeStore((s) => s.look);
  const owned = useLifeStore((s) => s.owned);
  const coins = useLifeStore((s) => s.hud?.coins ?? 0);
  const [category, setCategory] = useState<WardrobeCategory>("shirt");
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!look) return null;

  const items = wardrobe.filter((i) => i.category === category);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 rounded-2xl bg-sky/60 p-3">
        <LookPreview look={look} height={110} />
        <div>
          <p className="text-base font-bold text-ink/70">Your coins</p>
          <p className="text-3xl font-black text-brand">🪙 {coins}</p>
          <p className="text-sm text-ink/60">Earn coins from lessons, assembly and daily goals.</p>
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Wardrobe sections">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={c === category}
            onClick={() => {
              setCategory(c);
              setConfirm(null);
            }}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-4 text-sm font-bold",
              c === category ? "bg-brand text-white" : "bg-ink/5 text-ink",
            )}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((item) => {
          const has = isOwned(item, owned);
          const worn = isWorn(item, look);
          const isColor = item.swatch.startsWith("#");
          const asking = confirm === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={worn}
                onClick={() => {
                  if (!has && !asking) return setConfirm(item.id);
                  setConfirm(null);
                  getLifeClient()?.wear(item);
                }}
                className={cn(
                  "flex h-full w-full flex-col items-center gap-1 rounded-2xl border-[3px] bg-white p-2 text-center active:scale-95",
                  worn ? "border-leaf" : asking ? "border-sun" : "border-ink/10",
                )}
              >
                <span
                  className="grid h-11 w-11 place-items-center rounded-full border-2 border-ink/15 text-2xl"
                  style={isColor ? { backgroundColor: item.swatch } : undefined}
                  aria-hidden
                >
                  {isColor ? "" : item.swatch}
                </span>
                <span className="text-sm font-bold leading-tight text-ink">{item.label}</span>
                <span className={cn("text-xs font-bold", worn ? "text-leaf-dark" : has ? "text-ink/50" : "text-brand")}>
                  {worn
                    ? item.category === "extras"
                      ? "On · tap to remove"
                      : "Wearing"
                    : has
                      ? item.category === "extras"
                        ? "Owned · tap to wear"
                        : "Owned"
                      : asking
                        ? item.price > coins
                          ? `Need ${item.price} 🪙`
                          : `Tap to buy · ${item.price} 🪙`
                        : `🪙 ${item.price}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
