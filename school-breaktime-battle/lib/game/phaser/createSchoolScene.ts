/**
 * Phaser scene that draws the school and mirrors the GameRuntime every frame.
 * Phaser is imported dynamically on the client, so the scene class is created by a factory.
 */
import type PhaserType from "phaser";
import {
  ART_SCALE,
  drawStudent,
  looks,
  STUDENT_HEIGHT,
  STUDENT_WIDTH,
  studentTextureKey,
  type LookKey,
  type StudentFrame,
  type StudentView,
} from "../art/students";
import { getSnackDefinition, powerUps as powerUpDefs, TUNING } from "../constants";
import { obstacles, returnZone, WORLD, zones } from "../map";
import type { GameRuntime } from "../runtime";
import type { Direction } from "../types";

type PhaserModule = typeof PhaserType;
type Container = PhaserType.GameObjects.Container;
type Text = PhaserType.GameObjects.Text;
type Graphics = PhaserType.GameObjects.Graphics;

const NAVY = 0x1e3a8a;
/** Below this scale the map text gets too small to read, so the camera follows the player. */
const MIN_READABLE_ZOOM = 0.62;
/** Phones get a closer camera so students are big enough to follow with a thumb on the screen. */
const MIN_TOUCH_ZOOM = 0.85;
const MAX_ZOOM = 1.4;
/** Feet sit just below the player's collision centre, so the body rises above it. */
const FEET_Y = 13;
const PLAYER_SCALE = 1.2;
const PREFECT_SCALE = 1.3;
const STEP_MS = 140;
const VIEWS: StudentView[] = ["front", "back", "side"];
const FRAMES: StudentFrame[] = [0, 1, 2];
const FONT = '"Nunito", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

type Image = PhaserType.GameObjects.Image;
type Ellipse = PhaserType.GameObjects.Ellipse;

/** A drawn person plus what is needed to animate their walk. */
type Walker = { sprite: Image; lastX: number; lastY: number; walkMs: number };

type PlayerView = {
  root: Container;
  walker: Walker;
  shield: Ellipse;
  frozen: Text;
  isMe: boolean;
  name: Text;
  score: Text;
  bubble: Container;
  bubbleBg: Graphics;
  bubbleText: Text;
  lastScore: number;
  lastBubble: string;
};

const hex = (color: string) => parseInt(color.replace("#", ""), 16);

export function createSchoolScene(Phaser: PhaserModule, getRuntime: () => GameRuntime | null) {
  return class SchoolScene extends Phaser.Scene {
    private players = new Map<string, PlayerView>();
    private items = new Map<string, Container>();
    private prefects = new Map<string, { root: Container; walker: Walker }>();
    private floats = new Map<number, Text>();
    private zoom = 1;
    private camCenter: { x: number; y: number } | null = null;
    private isTouch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

    constructor() {
      super("school");
    }

    create(): void {
      this.createStudentTextures();
      this.drawMap();
    }

    update(_time: number, delta: number): void {
      const runtime = getRuntime();
      if (!runtime) return;
      runtime.frame(performance.now());
      this.syncItems(runtime);
      this.syncPrefects(runtime, delta);
      this.syncPlayers(runtime, delta);
      this.syncFloats(runtime);
      this.syncCamera(runtime);
    }

    /**
     * Shows the whole school when it fits at a readable size; on small screens zooms to a
     * minimum size and follows the local player instead.
     */
    private syncCamera(runtime: GameRuntime): void {
      const { width, height } = this.scale.gameSize;
      if (!width || !height) return;
      // Tall phone screens zoom in further so the map isn't a thin strip with grass above and below.
      const minZoom = this.isTouch
        ? Math.min(1.15, Math.max(MIN_TOUCH_ZOOM, (height / WORLD.height) * 0.8))
        : MIN_READABLE_ZOOM;
      const zoom = Math.min(MAX_ZOOM, Math.max(Math.min(width / WORLD.width, height / WORLD.height), minZoom));
      const viewW = width / zoom;
      const viewH = height / zoom;
      const focus = runtime.display.get(runtime.myId) ?? { x: WORLD.width / 2, y: WORLD.height / 2 };
      const clamp = (v: number, view: number, size: number) =>
        view >= size ? size / 2 : Math.min(size - view / 2, Math.max(view / 2, v));
      const target = { x: clamp(focus.x, viewW, WORLD.width), y: clamp(focus.y, viewH, WORLD.height) };
      if (!this.camCenter || zoom !== this.zoom) this.camCenter = target;
      else {
        this.camCenter.x += (target.x - this.camCenter.x) * 0.15;
        this.camCenter.y += (target.y - this.camCenter.y) * 0.15;
      }
      this.zoom = zoom;
      this.cameras.main.setZoom(zoom).centerOn(this.camCenter.x, this.camCenter.y);
    }

    // -- Static map -------------------------------------------------------

    private label(x: number, y: number, text: string, size: number, color = "#1e3a8a", originX = 0): Text {
      return this.add
        .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: "bold", color })
        .setOrigin(originX, 0)
        .setDepth(1);
    }

    private drawMap(): void {
      const g = this.add.graphics().setDepth(0);
      g.fillStyle(0x8fcf7a, 1).fillRect(0, 0, WORLD.width, WORLD.height);
      // Grass tufts for texture.
      g.fillStyle(0x7fc06a, 1);
      for (let i = 0; i < 70; i++) {
        const x = (i * 137) % WORLD.width;
        const y = (i * 251) % WORLD.height;
        g.fillCircle(x, y, 3 + (i % 3));
      }

      const ordered = Object.values(zones).sort((a, b) => Number(Boolean(b.isLink)) - Number(Boolean(a.isLink)));
      // Walls: a thick navy outline under every floor so rooms read as buildings.
      for (const z of ordered) g.fillStyle(NAVY, 1).fillRoundedRect(z.x - 5, z.y - 5, z.width + 10, z.height + 10, 10);
      for (const z of ordered) g.fillStyle(hex(z.floor), 1).fillRect(z.x, z.y, z.width, z.height);

      // Floor patterns.
      const c = zones.corridor;
      g.lineStyle(1, 0xc3c9d6, 1);
      for (let x = c.x; x < c.x + c.width; x += 25) g.lineBetween(x, c.y, x, c.y + c.height);
      const cl = zones.classroom;
      g.lineStyle(1, 0xe2c286, 1);
      for (let y = cl.y + 18; y < cl.y + cl.height; y += 18) g.lineBetween(cl.x, y, cl.x + cl.width, y);
      const ct = zones.canteen;
      g.lineStyle(1, 0xf2d3a8, 1);
      for (let x = ct.x; x < ct.x + ct.width; x += 30) g.lineBetween(x, ct.y, x, ct.y + ct.height);
      for (let y = ct.y; y < ct.y + ct.height; y += 30) g.lineBetween(ct.x, y, ct.x + ct.width, y);

      // Blackboard on the classroom wall.
      g.fillStyle(0x14532d, 1).fillRect(cl.x + 2, cl.y + 40, 8, 100);
      // Return-to-class target.
      g.lineStyle(3, 0xfacc15, 1).strokeRoundedRect(returnZone.x + 6, returnZone.y + 6, returnZone.width - 12, returnZone.height - 12, 12);

      // Staff room is out of bounds.
      const st = zones.staffRoom;
      g.lineStyle(4, 0xef4444, 1).strokeRect(st.x + 2, st.y + 2, st.width - 4, st.height - 4);

      for (const z of Object.values(zones)) {
        if (!z.label) continue;
        this.label(z.x + 10, z.y + 6, z.label, 17);
      }
      this.label(cl.x + cl.width / 2, cl.y + cl.height - 26, "Return here before the bell!", 12, "#92400e", 0.5);
      this.label(st.x + st.width / 2, st.y + 30, "No students!", 12, "#b91c1c", 0.5);
      this.label(zones.waterTap.x + zones.waterTap.width - 8, zones.waterTap.y + 6, "🚰", 18, "#1e3a8a", 1);

      for (const o of obstacles) {
        const og = this.add.graphics().setDepth(1);
        if (o.kind === "slow") {
          og.fillStyle(hex(o.color), 0.55).fillRoundedRect(o.x, o.y, o.width, o.height, 12);
          og.lineStyle(2, hex(o.color), 1).strokeRoundedRect(o.x, o.y, o.width, o.height, 12);
        } else {
          og.fillStyle(hex(o.color), 1).fillRoundedRect(o.x, o.y, o.width, o.height, 5);
          og.lineStyle(2, NAVY, 0.8).strokeRoundedRect(o.x, o.y, o.width, o.height, 5);
        }
        if (o.emoji) {
          this.add
            .text(o.x + o.width / 2, o.y + o.height / 2, o.emoji, { fontSize: o.kind === "slow" ? "20px" : "16px" })
            .setOrigin(0.5)
            .setDepth(1);
        }
        if (o.kind === "slow") {
          this.add
            .text(o.x + o.width / 2, o.y + o.height + 2, o.label, {
              fontFamily: FONT,
              fontSize: "11px",
              fontStyle: "bold",
              color: "#1e3a8a",
            })
            .setOrigin(0.5, 0)
            .setDepth(1);
        }
      }
    }

    // -- Dynamic objects --------------------------------------------------

    private syncItems(runtime: GameRuntime): void {
      const seen = new Set<string>();
      const now = performance.now();
      for (const s of runtime.state.snacks) {
        seen.add(s.id);
        let view = this.items.get(s.id);
        if (!view) {
          const def = getSnackDefinition(s.type);
          const special = s.rarity === "special";
          const ring = this.add.circle(0, 0, TUNING.itemRadius + 2, 0xffffff, 1).setStrokeStyle(2, hex(def.color));
          const icon = this.add.text(0, 0, def.emoji, { fontSize: special ? "22px" : "18px" }).setOrigin(0.5);
          view = this.add.container(s.x, s.y, [ring, icon]).setDepth(2);
          if (special) ring.setStrokeStyle(4, 0xfacc15);
          this.items.set(s.id, view);
        }
        if (s.rarity === "special") view.setScale(1 + Math.sin(now / 300) * 0.08);
      }
      for (const p of runtime.state.powerUps) {
        seen.add(p.id);
        if (this.items.has(p.id)) continue;
        const def = powerUpDefs[p.type];
        const bg = this.add.rectangle(0, 0, 28, 28, hex(def.color), 1).setStrokeStyle(3, NAVY);
        const icon = this.add.text(0, 0, def.emoji, { fontSize: "17px" }).setOrigin(0.5);
        this.items.set(p.id, this.add.container(p.x, p.y, [bg, icon]).setDepth(2));
      }
      for (const [id, view] of this.items) {
        if (!seen.has(id)) {
          view.destroy();
          this.items.delete(id);
        }
      }
    }

    // -- People ------------------------------------------------------------

    /** Turns the canvas drawings into textures once per scene. */
    private createStudentTextures(): void {
      for (const key of Object.keys(looks) as LookKey[]) {
        for (const view of VIEWS) {
          for (const frame of FRAMES) {
            const texture = studentTextureKey(key, view, frame);
            if (!this.textures.exists(texture)) this.textures.addCanvas(texture, drawStudent(looks[key], view, frame));
          }
        }
      }
    }

    /** Picks the pose for a person: which way they face and which walking step to show. */
    private animate(walker: Walker, key: LookKey, x: number, y: number, facing: Direction, deltaMs: number): void {
      const moving = Math.hypot(x - walker.lastX, y - walker.lastY) > 0.15;
      walker.lastX = x;
      walker.lastY = y;
      walker.walkMs = moving ? walker.walkMs + deltaMs : 0;
      const frame: StudentFrame = moving ? (Math.floor(walker.walkMs / STEP_MS) % 2 === 0 ? 1 : 2) : 0;
      const view: StudentView = facing === "up" ? "back" : facing === "down" ? "front" : "side";
      walker.sprite.setTexture(studentTextureKey(key, view, frame));
      walker.sprite.setFlipX(facing === "left");
    }

    private makeWalker(key: LookKey, x: number, y: number, scale = 1): Walker {
      const sprite = this.add
        .image(0, FEET_Y, studentTextureKey(key, "front", 0))
        .setOrigin(0.5, 1)
        .setScale(scale / ART_SCALE);
      return { sprite, lastX: x, lastY: y, walkMs: 0 };
    }

    private syncPrefects(runtime: GameRuntime, deltaMs: number): void {
      for (const pf of runtime.state.prefects) {
        let view = this.prefects.get(pf.id);
        const d = runtime.prefectDisplay.get(pf.id) ?? pf;
        if (!view) {
          const shadow = this.add.ellipse(0, FEET_Y - 1, 26, 8, 0x000000, 0.2);
          const walker = this.makeWalker("prefect", d.x, d.y, PREFECT_SCALE);
          const tag = this.add
            .text(0, FEET_Y - STUDENT_HEIGHT * PREFECT_SCALE - 2, "Prefect", {
              fontFamily: FONT,
              fontSize: "12px",
              fontStyle: "bold",
              color: "#ffffff",
              backgroundColor: "#b91c1c",
              padding: { x: 4, y: 1 },
            })
            .setOrigin(0.5, 1);
          const root = this.add.container(d.x, d.y, [shadow, walker.sprite, tag]).setDepth(3);
          view = { root, walker };
          this.prefects.set(pf.id, view);
        }
        view.root.setPosition(d.x, d.y);
        view.root.setDepth(3 + d.y / 10000);
        this.animate(view.walker, "prefect", d.x, d.y, pf.direction, deltaMs);
      }
    }

    private createPlayerView(runtime: GameRuntime, id: string): PlayerView {
      const p = runtime.state.players[id];
      const isMe = id === runtime.myId;
      const top = FEET_Y - STUDENT_HEIGHT * PLAYER_SCALE;

      const you = isMe ? this.add.ellipse(0, FEET_Y - 1, 34, 13, 0xfacc15, 0.75).setStrokeStyle(2, 0xca8a04) : null;
      const shadow = this.add.ellipse(0, FEET_Y - 1, 24, 7, 0x000000, 0.2);
      const walker = this.makeWalker(p.characterKey, p.x, p.y, PLAYER_SCALE);
      const shield = this.add
        .ellipse(0, (top + FEET_Y) / 2, STUDENT_WIDTH * PLAYER_SCALE + 10, STUDENT_HEIGHT * PLAYER_SCALE + 8)
        .setStrokeStyle(3, 0x3b82f6)
        .setVisible(false);
      const frozen = this.add.text(12, top + 2, "❄️", { fontSize: "16px" }).setOrigin(0.5).setVisible(false);
      const name = this.add
        .text(0, top - 2, p.name, {
          fontFamily: FONT,
          fontSize: "12px",
          fontStyle: "bold",
          color: isMe ? "#facc15" : "#ffffff",
          stroke: "#1e3a8a",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 1);
      const score = this.add
        .text(0, FEET_Y + 2, "0", {
          fontFamily: FONT,
          fontSize: "11px",
          fontStyle: "bold",
          color: "#1e3a8a",
          backgroundColor: "#ffffffcc",
          padding: { x: 3, y: 0 },
        })
        .setOrigin(0.5, 0);
      const bubbleBg = this.add.graphics();
      const bubbleText = this.add
        .text(0, 0, "", { fontFamily: FONT, fontSize: "12px", fontStyle: "bold", color: "#1f2937" })
        .setOrigin(0.5);
      const bubble = this.add.container(0, top - 28, [bubbleBg, bubbleText]).setVisible(false);

      const parts = [...(you ? [you] : []), shadow, walker.sprite, shield, frozen, name, score, bubble];
      const root = this.add.container(p.x, p.y, parts).setDepth(3);
      return { root, walker, shield, frozen, name, score, bubble, bubbleBg, bubbleText, lastScore: -1, lastBubble: "", isMe };
    }

    private syncPlayers(runtime: GameRuntime, deltaMs: number): void {
      const now = Date.now();
      for (const [id, p] of Object.entries(runtime.state.players)) {
        let view = this.players.get(id);
        if (!view) {
          view = this.createPlayerView(runtime, id);
          this.players.set(id, view);
        }
        const d = runtime.display.get(id) ?? p;
        view.root.setPosition(d.x, d.y);
        // People lower on screen are drawn in front; the local player wins ties.
        view.root.setDepth(3 + d.y / 10000 + (view.isMe ? 0.00001 : 0));
        this.animate(view.walker, p.characterKey, d.x, d.y, p.facing, p.frozenMs > 0 ? 0 : deltaMs);
        view.shield.setVisible(p.hasShield);
        view.frozen.setVisible(p.frozenMs > 0);
        if (p.frozenMs > 0) view.walker.sprite.setTint(0x9cc9ff);
        else view.walker.sprite.clearTint();
        view.root.setAlpha(p.immuneMs > 0 && p.frozenMs <= 0 ? 0.6 : 1);
        if (p.score !== view.lastScore) {
          view.lastScore = p.score;
          view.score.setText(String(p.score));
        }
        const reaction = runtime.reactions.get(id);
        const text = reaction && reaction.until > now ? reaction.text : "";
        if (text !== view.lastBubble) {
          view.lastBubble = text;
          view.bubble.setVisible(Boolean(text));
          if (text) {
            view.bubbleText.setText(text);
            const w = view.bubbleText.width + 14;
            const h = view.bubbleText.height + 8;
            view.bubbleBg.clear();
            view.bubbleBg.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 8);
            view.bubbleBg.lineStyle(2, NAVY, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
            view.bubbleBg.fillStyle(0xffffff, 1).fillTriangle(-5, h / 2 - 1, 5, h / 2 - 1, 0, h / 2 + 6);
          }
        }
      }
      for (const [id, view] of this.players) {
        if (!runtime.state.players[id]) {
          view.root.destroy();
          this.players.delete(id);
        }
      }
    }

    private syncFloats(runtime: GameRuntime): void {
      const now = performance.now();
      const alive = new Set<number>();
      for (const f of runtime.floating) {
        alive.add(f.id);
        let t = this.floats.get(f.id);
        if (!t) {
          t = this.add
            .text(f.x, f.y, f.text, {
              fontFamily: FONT,
              fontSize: "15px",
              fontStyle: "bold",
              color: f.color,
              stroke: "#ffffff",
              strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(6);
          this.floats.set(f.id, t);
        }
        const age = (now - f.born) / 1200;
        t.setPosition(f.x, f.y - 16 - age * 30);
        t.setAlpha(Math.max(0, 1 - age * age));
      }
      for (const [id, t] of this.floats) {
        if (!alive.has(id)) {
          t.destroy();
          this.floats.delete(id);
        }
      }
    }
  };
}
