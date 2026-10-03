import type { Accessory, HairStyle, Look } from "@/lib/game/art/students";

export type WardrobeCategory = "skin" | "hairStyle" | "hair" | "shirt" | "bottom" | "bottomStyle" | "shoes" | "extras";

export type WardrobeItem = {
  id: string;
  category: WardrobeCategory;
  label: string;
  price: number;
  /** Colour swatch, or an emoji for styles. */
  swatch: string;
  apply: (look: Look) => Look;
};

const color = (category: WardrobeCategory, field: "skin" | "hair" | "shirt" | "bottom" | "shoes", value: string, label: string, price = 0): WardrobeItem => ({
  id: `${category}:${value}`,
  category,
  label,
  price,
  swatch: value,
  apply: (look) => ({ ...look, [field]: value }),
});

const hairStyle = (style: HairStyle, label: string, swatch: string, price = 0): WardrobeItem => ({
  id: `hairStyle:${style}`,
  category: "hairStyle",
  label,
  price,
  swatch,
  apply: (look) => ({ ...look, hairStyle: style }),
});

const extra = (accessory: Accessory, label: string, swatch: string, price: number): WardrobeItem => ({
  id: `extras:${accessory}`,
  category: "extras",
  label,
  price,
  swatch,
  apply: (look) => ({
    ...look,
    accessories: look.accessories.includes(accessory)
      ? look.accessories.filter((a) => a !== accessory)
      : [...look.accessories, accessory],
  }),
});

export const wardrobe: WardrobeItem[] = [
  color("skin", "skin", "#f1c27d", "Light"),
  color("skin", "skin", "#c68642", "Golden"),
  color("skin", "skin", "#a0662f", "Caramel"),
  color("skin", "skin", "#8d5524", "Brown"),
  color("skin", "skin", "#6b3e1f", "Deep brown"),
  color("skin", "skin", "#4a2a14", "Dark"),
  hairStyle("short", "Low cut", "💈"),
  hairStyle("puffs", "Puffs", "🎀"),
  hairStyle("braids", "Braids", "🪢"),
  hairStyle("afro", "Afro", "☁️", 20),
  color("hair", "hair", "#1c1209", "Black"),
  color("hair", "hair", "#4a2c17", "Brown", 10),
  color("hair", "hair", "#7f1d1d", "Burgundy", 25),
  color("shirt", "shirt", "#f8fafc", "White"),
  color("shirt", "shirt", "#38bdf8", "Sky blue"),
  color("shirt", "shirt", "#16a34a", "Green"),
  color("shirt", "shirt", "#2563eb", "Blue", 10),
  color("shirt", "shirt", "#ef4444", "Red", 15),
  color("shirt", "shirt", "#f97316", "Orange", 15),
  color("shirt", "shirt", "#9333ea", "Purple", 15),
  color("shirt", "shirt", "#0891b2", "Teal", 15),
  color("shirt", "shirt", "#eab308", "Gold", 50),
  color("bottom", "bottom", "#1e3a8a", "Navy"),
  color("bottom", "bottom", "#b08d57", "Khaki"),
  color("bottom", "bottom", "#7f1d1d", "Maroon", 10),
  color("bottom", "bottom", "#111827", "Black", 10),
  {
    id: "bottomStyle:shorts",
    category: "bottomStyle",
    label: "Shorts",
    price: 0,
    swatch: "🩳",
    apply: (look) => ({ ...look, skirt: false, trousers: false }),
  },
  {
    id: "bottomStyle:skirt",
    category: "bottomStyle",
    label: "Skirt",
    price: 0,
    swatch: "👗",
    apply: (look) => ({ ...look, skirt: true, trousers: false }),
  },
  {
    id: "bottomStyle:trousers",
    category: "bottomStyle",
    label: "Trousers",
    price: 0,
    swatch: "👖",
    apply: (look) => ({ ...look, skirt: false, trousers: true }),
  },
  color("shoes", "shoes", "#111827", "Black"),
  color("shoes", "shoes", "#3f2a1d", "Brown"),
  color("shoes", "shoes", "#f8fafc", "White trainers", 15),
  extra("glasses", "Glasses", "👓", 15),
  extra("headband", "Headband", "🎽", 10),
  extra("badge", "Star badge", "⭐", 30),
  extra("stripes", "Jersey stripes", "🦓", 25),
];

export const CATEGORY_LABELS: Record<WardrobeCategory, string> = {
  skin: "Skin",
  hairStyle: "Hairstyle",
  hair: "Hair colour",
  shirt: "Top",
  bottom: "Bottom colour",
  bottomStyle: "Bottom style",
  shoes: "Shoes",
  extras: "Extras",
};

export function isOwned(item: WardrobeItem, owned: string[]): boolean {
  return item.price === 0 || owned.includes(item.id);
}

/** Whether the item is what the student is currently wearing. */
export function isWorn(item: WardrobeItem, look: Look): boolean {
  const [category, value] = item.id.split(":");
  switch (category) {
    case "skin":
      return look.skin === value;
    case "hair":
      return look.hair === value;
    case "shirt":
      return look.shirt === value;
    case "bottom":
      return look.bottom === value;
    case "shoes":
      return look.shoes === value;
    case "hairStyle":
      return look.hairStyle === value;
    case "bottomStyle":
      return value === "skirt" ? look.skirt : value === "trousers" ? look.trousers : !look.skirt && !look.trousers;
    case "extras":
      return look.accessories.includes(value as Accessory);
    default:
      return false;
  }
}

/** A random free outfit for a brand-new student. */
export function randomStarterLook(rng: () => number = Math.random): Look {
  const pick = <T,>(items: T[]) => items[Math.floor(rng() * items.length)];
  const free = (category: WardrobeCategory) => wardrobe.filter((i) => i.category === category && i.price === 0);
  let look: Look = {
    skin: "#8d5524",
    hair: "#1c1209",
    hairStyle: "short",
    shirt: "#f8fafc",
    bottom: "#1e3a8a",
    skirt: false,
    trousers: false,
    shoes: "#111827",
    accessories: [],
  };
  for (const category of ["skin", "hairStyle", "shirt", "bottom", "bottomStyle", "shoes"] as WardrobeCategory[]) {
    look = pick(free(category)).apply(look);
  }
  return look;
}

/** Keeps a look loaded from storage or the network safe to draw. */
export function sanitizeLook(value: unknown): Look | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<Look>;
  const hex = (s: unknown) => typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
  if (!hex(v.skin) || !hex(v.hair) || !hex(v.shirt) || !hex(v.bottom) || !hex(v.shoes)) return null;
  const styles: HairStyle[] = ["short", "puffs", "braids", "afro"];
  const allowed: Accessory[] = ["headband", "badge", "glasses", "stripes"];
  return {
    skin: v.skin!,
    hair: v.hair!,
    shirt: v.shirt!,
    bottom: v.bottom!,
    shoes: v.shoes!,
    hairStyle: styles.includes(v.hairStyle as HairStyle) ? (v.hairStyle as HairStyle) : "short",
    skirt: Boolean(v.skirt),
    trousers: Boolean(v.trousers) && !v.skirt,
    accessories: Array.isArray(v.accessories) ? v.accessories.filter((a): a is Accessory => allowed.includes(a as Accessory)) : [],
  };
}
