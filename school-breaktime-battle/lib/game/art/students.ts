/**
 * Cartoon students drawn with the 2D canvas API, so they need no image files. The same
 * drawings are used as Phaser textures in the game and as avatars in the React UI.
 */
import type { CharacterKey } from "../types";

export type HairStyle = "short" | "puffs" | "braids" | "afro";
export type Accessory = "headband" | "badge" | "glasses" | "stripes" | "sash";

export type Look = {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  bottom: string;
  skirt: boolean;
  /** Long trousers instead of bare legs. */
  trousers: boolean;
  shoes: string;
  accessories: Accessory[];
};

export type LookKey = CharacterKey | "prefect";
export type StudentView = "front" | "back" | "side";
/** 0 = standing, 1 and 2 = the two walking steps. */
export type StudentFrame = 0 | 1 | 2;

export const STUDENT_WIDTH = 32;
export const STUDENT_HEIGHT = 44;
/** Drawings are rendered at 3× so they stay crisp when the camera zooms in. */
export const ART_SCALE = 3;

const OUTLINE = "#1e293b";
const HAIR = "#1c1209";

export const looks: Record<LookKey, Look> = {
  fast_runner: {
    skin: "#8d5524",
    hair: HAIR,
    hairStyle: "short",
    shirt: "#ef4444",
    bottom: "#1e3a8a",
    skirt: false,
    trousers: false,
    shoes: "#f8fafc",
    accessories: ["headband"],
  },
  snack_lover: {
    skin: "#a0662f",
    hair: HAIR,
    hairStyle: "puffs",
    shirt: "#f97316",
    bottom: "#1e3a8a",
    skirt: true,
    trousers: false,
    shoes: "#3f2a1d",
    accessories: [],
  },
  class_captain: {
    skin: "#6b3e1f",
    hair: HAIR,
    hairStyle: "short",
    shirt: "#2563eb",
    bottom: "#b08d57",
    skirt: false,
    trousers: false,
    shoes: "#111827",
    accessories: ["badge"],
  },
  bookworm: {
    skin: "#c68642",
    hair: HAIR,
    hairStyle: "braids",
    shirt: "#9333ea",
    bottom: "#7f1d1d",
    skirt: true,
    trousers: false,
    shoes: "#111827",
    accessories: ["glasses"],
  },
  football_boy: {
    skin: "#7a4a26",
    hair: HAIR,
    hairStyle: "short",
    shirt: "#16a34a",
    bottom: "#f8fafc",
    skirt: false,
    trousers: false,
    shoes: "#111827",
    accessories: ["stripes"],
  },
  quiet_genius: {
    skin: "#8d5524",
    hair: HAIR,
    hairStyle: "afro",
    shirt: "#0891b2",
    bottom: "#1e3a8a",
    skirt: true,
    trousers: false,
    shoes: "#3f2a1d",
    accessories: ["glasses"],
  },
  prefect: {
    skin: "#5c3317",
    hair: HAIR,
    hairStyle: "short",
    shirt: "#f8fafc",
    bottom: "#1e3a8a",
    skirt: false,
    trousers: true,
    shoes: "#111827",
    accessories: ["sash"],
  },
};

type Ctx = CanvasRenderingContext2D;

function shape(ctx: Ctx, fill: string, draw: () => void, stroke = true): void {
  ctx.beginPath();
  draw();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => () => ctx.roundRect(x, y, w, h, r);
const circle = (ctx: Ctx, x: number, y: number, r: number) => () => ctx.arc(x, y, r, 0, Math.PI * 2);
const ellipse = (ctx: Ctx, x: number, y: number, rx: number, ry: number) => () =>
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);

/** A limb that swings from a pivot (hip or shoulder). */
function limb(ctx: Ctx, pivotX: number, pivotY: number, angle: number, draw: () => void): void {
  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(angle);
  draw();
  ctx.restore();
}

function leg(ctx: Ctx, look: Look, length: number, shoeForward: boolean): void {
  // Drawn relative to the hip, pointing down.
  shape(ctx, look.trousers ? look.bottom : look.skin, rect(ctx, -2, 0, 4, length, 1.2));
  if (!look.trousers) shape(ctx, "#f8fafc", rect(ctx, -2, length - 3, 4, 2, 0.5), false);
  shape(ctx, look.shoes, ellipse(ctx, shoeForward ? 1 : 0, length + 0.6, shoeForward ? 3.2 : 2.6, 1.7));
}

function bottomFront(ctx: Ctx, look: Look, cx: number, halfWidth: number): void {
  if (look.skirt) {
    shape(ctx, look.bottom, () => {
      ctx.moveTo(cx - halfWidth, 27);
      ctx.lineTo(cx + halfWidth, 27);
      ctx.lineTo(cx + halfWidth + 2, 34);
      ctx.lineTo(cx - halfWidth - 2, 34);
      ctx.closePath();
    });
  } else {
    shape(ctx, look.bottom, rect(ctx, cx - halfWidth, 26.5, halfWidth * 2, look.trousers ? 6 : 6.5, 1.5));
  }
}

function hairBack(ctx: Ctx, look: Look, cx: number, view: StudentView): void {
  if (look.hairStyle === "afro") shape(ctx, look.hair, circle(ctx, cx - (view === "side" ? 1 : 0), 9, 10));
  if (look.hairStyle === "puffs") {
    if (view === "side") shape(ctx, look.hair, circle(ctx, cx - 6, 4.5, 3.8));
    else {
      shape(ctx, look.hair, circle(ctx, cx - 7.5, 4.5, 3.8));
      shape(ctx, look.hair, circle(ctx, cx + 7.5, 4.5, 3.8));
    }
  }
  if (look.hairStyle === "braids" && view !== "back") {
    if (view === "side") shape(ctx, look.hair, rect(ctx, cx - 7.5, 9, 2.8, 13, 1.4));
    else {
      shape(ctx, look.hair, rect(ctx, cx - 8.6, 9, 2.8, 13, 1.4));
      shape(ctx, look.hair, rect(ctx, cx + 5.8, 9, 2.8, 13, 1.4));
    }
  }
}

function hairCap(ctx: Ctx, look: Look, cx: number, view: StudentView): void {
  if (view === "back") {
    // The back of the head is all hair, leaving a little neck showing.
    shape(ctx, look.hair, () => ctx.ellipse(cx, 9.6, 7.9, 7.4, 0, 0, Math.PI * 2));
    if (look.hairStyle === "braids") {
      shape(ctx, look.hair, rect(ctx, cx - 5.5, 12, 2.8, 12, 1.4));
      shape(ctx, look.hair, rect(ctx, cx + 2.7, 12, 2.8, 12, 1.4));
    }
    return;
  }
  if (view === "side") {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, 10.5, 7.9, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(cx - 9, 1);
    ctx.lineTo(cx + 9, 1);
    ctx.lineTo(cx + 9, 6.6);
    ctx.quadraticCurveTo(cx + 1, 5.4, cx - 1.8, 9.2);
    ctx.lineTo(cx - 2.4, 19);
    ctx.lineTo(cx - 9, 19);
    ctx.closePath();
    ctx.fillStyle = look.hair;
    ctx.fill();
    ctx.restore();
    return;
  }
  shape(ctx, look.hair, () => {
    ctx.moveTo(cx - 7.8, 10);
    ctx.quadraticCurveTo(cx - 8.2, 2.2, cx, 2.4);
    ctx.quadraticCurveTo(cx + 8.2, 2.2, cx + 7.8, 10);
    ctx.quadraticCurveTo(cx + 6, 6.2, cx, 6.3);
    ctx.quadraticCurveTo(cx - 6, 6.2, cx - 7.8, 10);
    ctx.closePath();
  });
}

function face(ctx: Ctx, look: Look, cx: number, view: StudentView): void {
  ctx.fillStyle = OUTLINE;
  ctx.strokeStyle = OUTLINE;
  ctx.lineCap = "round";
  if (view === "front") {
    for (const ex of [cx - 3, cx + 3]) {
      ctx.beginPath();
      ctx.ellipse(ex, 11.2, 1.05, 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(cx, 12.8, 2.3, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    if (look.accessories.includes("glasses")) {
      ctx.lineWidth = 0.7;
      for (const ex of [cx - 3, cx + 3]) {
        ctx.beginPath();
        ctx.arc(ex, 11.2, 2.3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - 0.7, 11.2);
      ctx.lineTo(cx + 0.7, 11.2);
      ctx.stroke();
    }
  } else if (view === "side") {
    ctx.beginPath();
    ctx.ellipse(cx + 4, 11, 1, 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx + 3.6, 14.3);
    ctx.lineTo(cx + 5.6, 14);
    ctx.stroke();
    if (look.accessories.includes("glasses")) {
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(cx + 4.3, 11, 2.2, 0, Math.PI * 2);
      ctx.moveTo(cx + 2.1, 10.6);
      ctx.lineTo(cx - 1.5, 10.2);
      ctx.stroke();
    }
  }
  if (look.accessories.includes("headband")) {
    ctx.fillStyle = "#f8fafc";
    if (view === "side") ctx.fillRect(cx - 7.6, 5.6, 15, 1.8);
    else ctx.fillRect(cx - 7.4, 5.4, 14.8, 1.8);
  }
}

function torsoDetails(ctx: Ctx, look: Look, cx: number, view: StudentView): void {
  if (view === "front") {
    // White collar points.
    ctx.fillStyle = "#f8fafc";
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx, 17.4);
      ctx.lineTo(cx + dir * 3.6, 17.4);
      ctx.lineTo(cx + dir * 1.2, 20.6);
      ctx.closePath();
      ctx.fill();
    }
    if (look.accessories.includes("badge")) {
      shape(ctx, "#facc15", circle(ctx, cx + 3.6, 21.6, 1.6));
    }
  }
  if (look.accessories.includes("stripes")) {
    ctx.fillStyle = "#f8fafc";
    const x = view === "side" ? cx - 0.8 : cx - 4;
    ctx.fillRect(x, 18, 1.6, 10);
    if (view !== "side") ctx.fillRect(cx + 2.4, 18, 1.6, 10);
  }
  if (look.accessories.includes("sash")) {
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2.6;
    ctx.lineCap = "butt";
    ctx.beginPath();
    if (view === "side") {
      ctx.moveTo(cx - 3, 17.5);
      ctx.lineTo(cx + 3, 28);
    } else {
      ctx.moveTo(cx - 5.5, 17.6);
      ctx.lineTo(cx + 5.8, 28.2);
    }
    ctx.stroke();
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
}

function drawFrontOrBack(ctx: Ctx, look: Look, view: "front" | "back", frame: StudentFrame): void {
  const cx = 16;
  const leftLift = frame === 1 ? 1.6 : 0;
  const rightLift = frame === 2 ? 1.6 : 0;
  const armSwing = frame === 0 ? 0 : frame === 1 ? 0.18 : -0.18;

  hairBack(ctx, look, cx, view);
  // Legs.
  limb(ctx, cx - 3, 31, 0, () => leg(ctx, look, 8 - leftLift, false));
  limb(ctx, cx + 3, 31, 0, () => leg(ctx, look, 8 - rightLift, false));
  bottomFront(ctx, look, cx, look.trousers ? 6 : 6);
  // Arms.
  for (const [side, swing] of [
    [-1, armSwing],
    [1, -armSwing],
  ] as const) {
    limb(ctx, cx + side * 6.6, 18.5, side * 0.12 + swing, () => {
      shape(ctx, look.shirt, rect(ctx, -1.8, 0, 3.6, 5.5, 1.4));
      shape(ctx, look.skin, rect(ctx, -1.5, 5, 3, 4.6, 1.3));
    });
  }
  // Body and head.
  shape(ctx, look.shirt, rect(ctx, cx - 6.5, 16.5, 13, 11.5, 3));
  torsoDetails(ctx, look, cx, view);
  shape(ctx, look.skin, rect(ctx, cx - 1.6, 14.5, 3.2, 3, 0.5), false);
  if (view === "front") {
    shape(ctx, look.skin, circle(ctx, cx - 7.6, 11, 1.5));
    shape(ctx, look.skin, circle(ctx, cx + 7.6, 11, 1.5));
  }
  shape(ctx, look.skin, circle(ctx, cx, 10.5, 7.6));
  hairCap(ctx, look, cx, view);
  face(ctx, look, cx, view);
}

function drawSide(ctx: Ctx, look: Look, frame: StudentFrame): void {
  const cx = 16;
  const stride = frame === 0 ? 0 : frame === 1 ? 0.5 : -0.5;

  hairBack(ctx, look, cx, "side");
  // Far leg and arm first, slightly darker by drawing them behind the body.
  limb(ctx, cx, 31, -stride, () => leg(ctx, look, 8, true));
  limb(ctx, cx, 18.5, stride * 0.9, () => {
    shape(ctx, look.shirt, rect(ctx, -1.8, 0, 3.6, 5.5, 1.4));
    shape(ctx, look.skin, rect(ctx, -1.5, 5, 3, 4.6, 1.3));
  });
  limb(ctx, cx, 31, stride, () => leg(ctx, look, 8, true));
  if (look.skirt) {
    shape(ctx, look.bottom, () => {
      ctx.moveTo(cx - 4.5, 27);
      ctx.lineTo(cx + 4.5, 27);
      ctx.lineTo(cx + 6, 34);
      ctx.lineTo(cx - 6, 34);
      ctx.closePath();
    });
  } else {
    shape(ctx, look.bottom, rect(ctx, cx - 4.5, 26.5, 9, 6.5, 1.5));
  }
  shape(ctx, look.shirt, rect(ctx, cx - 4.8, 16.5, 9.6, 11.5, 3));
  torsoDetails(ctx, look, cx, "side");
  limb(ctx, cx, 18.5, -stride * 0.9, () => {
    shape(ctx, look.shirt, rect(ctx, -1.8, 0, 3.6, 5.5, 1.4));
    shape(ctx, look.skin, rect(ctx, -1.5, 5, 3, 4.6, 1.3));
  });
  shape(ctx, look.skin, rect(ctx, cx - 1.6, 14.5, 3.2, 3, 0.5), false);
  shape(ctx, look.skin, circle(ctx, cx, 10.5, 7.6));
  shape(ctx, look.skin, circle(ctx, cx + 7.4, 12.2, 1.2), false);
  hairCap(ctx, look, cx, "side");
  shape(ctx, look.skin, circle(ctx, cx - 2.6, 11.4, 1.5));
  face(ctx, look, cx, "side");
}

/** Draws one pose of a student, facing down (front), up (back) or right (side). */
export function drawStudent(look: Look, view: StudentView, frame: StudentFrame): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = STUDENT_WIDTH * ART_SCALE;
  canvas.height = STUDENT_HEIGHT * ART_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(ART_SCALE, ART_SCALE);
  ctx.lineJoin = "round";
  if (view === "side") drawSide(ctx, look, frame);
  else drawFrontOrBack(ctx, look, view, frame);
  return canvas;
}

export function studentTextureKey(key: LookKey, view: StudentView, frame: StudentFrame): string {
  return `student-${key}-${view}-${frame}`;
}

const portraits = new Map<LookKey, HTMLCanvasElement>();

/** Head-and-shoulders portrait (front view) for avatars. Browser only. */
export function studentPortrait(key: LookKey): HTMLCanvasElement {
  let portrait = portraits.get(key);
  if (!portrait) {
    portrait = drawStudent(looks[key], "front", 0);
    portraits.set(key, portrait);
  }
  return portrait;
}
