/**
 * Sound effects. Files are loaded from /public/sounds; when a file is missing or audio is
 * blocked, a short synthesized tone plays instead so the game never breaks.
 */
export type SoundName =
  | "break-bell"
  | "snack-collect"
  | "powerup"
  | "caught"
  | "final-bell"
  | "winner"
  | "button-click";

const FALLBACK_TONES: Record<SoundName, { freq: number[]; ms: number; type: OscillatorType }> = {
  "break-bell": { freq: [880, 660, 880, 660], ms: 110, type: "triangle" },
  "snack-collect": { freq: [660, 990], ms: 60, type: "square" },
  powerup: { freq: [520, 780, 1040], ms: 70, type: "triangle" },
  caught: { freq: [300, 200], ms: 120, type: "sawtooth" },
  "final-bell": { freq: [880, 660, 880, 660, 880], ms: 120, type: "triangle" },
  winner: { freq: [523, 659, 784, 1046], ms: 120, type: "triangle" },
  "button-click": { freq: [700], ms: 30, type: "sine" },
};

/**
 * Sound files that exist in /public/sounds. Add a name here after dropping in its .mp3;
 * anything not listed uses the built-in tone (and avoids a 404 request).
 */
const AVAILABLE_FILES: SoundName[] = [];

let muted = false;
let audioCtx: AudioContext | null = null;
const missing = new Set<SoundName>();
const cache = new Map<SoundName, HTMLAudioElement>();

export function setMuted(value: boolean): void {
  muted = value;
  try {
    window.localStorage.setItem("sbb-muted", value ? "1" : "0");
  } catch {
    // ignore
  }
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    muted = window.localStorage.getItem("sbb-muted") === "1";
  } catch {
    // ignore
  }
  return muted;
}

function playTone(name: SoundName): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    const { freq, ms, type } = FALLBACK_TONES[name];
    freq.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + (i * ms) / 1000;
      osc.type = type;
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + ms / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + ms / 1000 + 0.02);
    });
  } catch {
    // Audio unavailable: stay silent.
  }
}

export function playSound(name: SoundName): void {
  if (typeof window === "undefined" || muted) return;
  if (!AVAILABLE_FILES.includes(name) || missing.has(name)) return playTone(name);
  let audio = cache.get(name);
  if (!audio) {
    audio = new Audio(`/sounds/${name}.mp3`);
    audio.volume = 0.5;
    audio.addEventListener("error", () => missing.add(name), { once: true });
    cache.set(name, audio);
  }
  const clip = audio.cloneNode(true) as HTMLAudioElement;
  clip.volume = audio.volume;
  clip.play().catch(() => {
    missing.add(name);
    playTone(name);
  });
}
