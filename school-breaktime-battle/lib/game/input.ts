import type { MovementInput } from "./types";

/** Shared input state written by the keyboard and the on-screen controls. */
export type InputState = {
  keys: { up: boolean; down: boolean; left: boolean; right: boolean };
  /** Analog vector from the touch pad, each axis in [-1, 1]. */
  touch: MovementInput;
};

export function createInputState(): InputState {
  return { keys: { up: false, down: false, left: false, right: false }, touch: { dx: 0, dy: 0 } };
}

/** The one input state for this tab, shared by the keyboard, touch controls and the runtime. */
export const playerInput: InputState = createInputState();

export function resetInput(input: InputState = playerInput): void {
  input.keys = { up: false, down: false, left: false, right: false };
  input.touch = { dx: 0, dy: 0 };
}

export function inputVector(input: InputState): MovementInput {
  const k = input.keys;
  const dx = (k.right ? 1 : 0) - (k.left ? 1 : 0) + input.touch.dx;
  const dy = (k.down ? 1 : 0) - (k.up ? 1 : 0) + input.touch.dy;
  return { dx: Math.max(-1, Math.min(1, dx)), dy: Math.max(-1, Math.min(1, dy)) };
}

const KEY_MAP: Record<string, keyof InputState["keys"]> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

/** Arrow keys / WASD. Returns a cleanup function. */
export function bindKeyboard(input: InputState, target: Window = window): () => void {
  const isTyping = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  };
  const down = (e: KeyboardEvent) => {
    const key = KEY_MAP[e.code];
    if (!key || isTyping(e)) return;
    input.keys[key] = true;
    e.preventDefault();
  };
  const up = (e: KeyboardEvent) => {
    const key = KEY_MAP[e.code];
    if (!key) return;
    input.keys[key] = false;
  };
  const reset = () => resetInput(input);
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  target.addEventListener("blur", reset);
  return () => {
    target.removeEventListener("keydown", down);
    target.removeEventListener("keyup", up);
    target.removeEventListener("blur", reset);
  };
}
