/**
 * Phaser scene for the Student Life world: draws the school, the student and their classmates
 * (each in their own outfit), activity spots and speech bubbles. Game rules live in LifeClient.
 */
import type PhaserType from "phaser";
import { ART_SCALE, drawStudent, STUDENT_HEIGHT, type Look, type StudentFrame, type StudentView } from "../art/students";
import type { Direction } from "../types";
import { activities } from "@/lib/life/activities";
import { friendLevel } from "@/lib/life/friendship";
import { LIFE_WORLD, lifeDecorations, lifeFurniture, lifeSpots, lifeZones } from "@/lib/life/map";
import type { LifeClient } from "@/lib/life/client";

type PhaserModule = typeof PhaserType;
type Container = PhaserType.GameObjects.Container;
type Text = PhaserType.GameObjects.Text;
type Image = PhaserType.GameObjects.Image;
type Graphics = PhaserType.GameObjects.Graphics;

const NAVY = 0x1e3a8a;
const FONT = '"Nunito", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const FEET_Y = 13;
const SCALE = 1.2;
const STEP_MS = 140;
const VIEWS: StudentView[] = ["front", "back", "side"];
const FRAMES: StudentFrame[] = [0, 1, 2];
const MIN_ZOOM = 0.8;
const MIN_TOUCH_ZOOM = 0.85;
const MAX_ZOOM = 1.4;

const hex = (color: string) => parseInt(color.replace("#", ""), 16);

function lookHash(look: Look): string {
  const text = JSON.stringify(look);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `look-${(h >>> 0).toString(36)}`;
}

type PersonView = {
  root: Container;
  sprite: Image;
  lookKey: string;
  name: Text;
  badge: Text;
  heart: Text;
  bubble: Container;
  bubbleBg: Graphics;
  bubbleText: Text;
  lastBubble: string;
  lastX: number;
  lastY: number;
  walkMs: number;
};

export function createLifeScene(Phaser: PhaserModule, getClient: () => LifeClient | null) {
  return class LifeScene extends Phaser.Scene {
    private people = new Map<string, PersonView>();
    private zoom = 0;
    private camCenter: { x: number; y: number } | null = null;
    private isTouch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

    constructor() {
      super("life");
    }

    create(): void {
      this.drawMap();
    }

    update(_time: number, delta: number): void {
      const client = getClient();
      if (!client) return;
      client.frame(performance.now());
      this.syncPeople(client, delta);
      this.syncCamera(client);
    }

    // -- Textures ---------------------------------------------------------

    private ensureLook(look: Look): string {
      const key = lookHash(look);
      if (!this.textures.exists(`${key}-front-0`)) {
        for (const view of VIEWS) for (const frame of FRAMES) this.textures.addCanvas(`${key}-${view}-${frame}`, drawStudent(look, view, frame));
      }
      return key;
    }

    // -- Map --------------------------------------------------------------

    private drawMap(): void {
      const g = this.add.graphics().setDepth(0);
      g.fillStyle(0x8fcf7a, 1).fillRect(0, 0, LIFE_WORLD.width, LIFE_WORLD.height);
      g.fillStyle(0x7fc06a, 1);
      for (let i = 0; i < 110; i++) g.fillCircle((i * 137) % LIFE_WORLD.width, (i * 251) % LIFE_WORLD.height, 3 + (i % 3));

      const ordered = [...lifeZones].sort((a, b) => Number(Boolean(b.isLink)) - Number(Boolean(a.isLink)));
      for (const z of ordered) g.fillStyle(NAVY, 1).fillRoundedRect(z.x - 5, z.y - 5, z.width + 10, z.height + 10, 10);
      for (const z of ordered) g.fillStyle(hex(z.floor), 1).fillRect(z.x, z.y, z.width, z.height);

      const zone = (key: string) => lifeZones.find((z) => z.key === key)!;
      // Floor details.
      const lib = zone("library");
      g.lineStyle(1, 0xd6c19c, 1);
      for (let y = lib.y + 20; y < lib.y + lib.height; y += 20) g.lineBetween(lib.x, y, lib.x + lib.width, y);
      const cls = zone("classroom");
      g.lineStyle(1, 0xe2c286, 1);
      for (let y = cls.y + 18; y < cls.y + cls.height; y += 18) g.lineBetween(cls.x, y, cls.x + cls.width, y);
      const asm = zone("assembly");
      g.lineStyle(1, 0xbcd6a6, 1);
      for (let x = asm.x; x < asm.x + asm.width; x += 40) g.lineBetween(x, asm.y, x, asm.y + asm.height);
      for (let y = asm.y; y < asm.y + asm.height; y += 40) g.lineBetween(asm.x, y, asm.x + asm.width, y);
      const field = zone("field");
      for (let x = field.x; x < field.x + field.width; x += 60) {
        g.fillStyle(0x84c765, 1).fillRect(x, field.y, 30, field.height);
      }
      const corridor = zone("corridor");
      g.lineStyle(1, 0xc3c9d6, 1);
      for (let x = corridor.x; x < corridor.x + corridor.width; x += 25) g.lineBetween(x, corridor.y, x, corridor.y + corridor.height);

      for (const d of lifeDecorations) {
        if (d.kind === "pitch") {
          g.lineStyle(3, 0xffffff, 0.9).strokeRect(d.x, d.y, d.width, d.height);
          g.lineBetween(d.x + d.width / 2, d.y, d.x + d.width / 2, d.y + d.height);
          g.strokeCircle(d.x + d.width / 2, d.y + d.height / 2, 40);
        } else if (d.kind === "goal") {
          g.lineStyle(4, 0xffffff, 1).strokeRect(d.x, d.y, d.width, d.height);
        } else if (d.kind === "flag") {
          g.fillStyle(0x16a34a, 1).fillRect(d.x, d.y, d.width / 3, d.height);
          g.fillStyle(0xffffff, 1).fillRect(d.x + d.width / 3, d.y, d.width / 3, d.height);
          g.fillStyle(0x16a34a, 1).fillRect(d.x + (2 * d.width) / 3, d.y, d.width / 3, d.height);
        } else {
          g.fillStyle(hex(d.color), 1).fillRoundedRect(d.x, d.y, d.width, d.height, 4);
        }
      }

      for (const o of lifeFurniture) {
        const fg = this.add.graphics().setDepth(1);
        fg.fillStyle(hex(o.color), 1).fillRoundedRect(o.x, o.y, o.width, o.height, 5);
        fg.lineStyle(2, NAVY, 0.7).strokeRoundedRect(o.x, o.y, o.width, o.height, 5);
        if (o.emoji) this.add.text(o.x + o.width / 2, o.y + o.height / 2, o.emoji, { fontSize: "16px" }).setOrigin(0.5).setDepth(1);
      }

      for (const z of lifeZones) {
        if (!z.label) continue;
        this.add
          .text(z.x + 10, z.y + 6, z.label, { fontFamily: FONT, fontSize: "17px", fontStyle: "bold", color: "#1e3a8a" })
          .setDepth(1);
      }

      // Activity spots: a small sign so students know where to go.
      for (const spot of lifeSpots) {
        const def = activities[spot.activity];
        if (!def) continue;
        const sign = this.add.container(spot.x, spot.y - 34).setDepth(2);
        const bg = this.add.graphics();
        bg.fillStyle(0xffffff, 0.92).fillRoundedRect(-14, -14, 28, 28, 8);
        bg.lineStyle(2, NAVY, 0.6).strokeRoundedRect(-14, -14, 28, 28, 8);
        sign.add([bg, this.add.text(0, 0, def.emoji, { fontSize: "16px" }).setOrigin(0.5)]);
        this.tweens.add({ targets: sign, y: spot.y - 38, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }

    // -- People -----------------------------------------------------------

    private makePerson(name: string, look: Look, isMe: boolean): PersonView {
      const lookKey = this.ensureLook(look);
      const top = FEET_Y - STUDENT_HEIGHT * SCALE;
      const parts: PhaserType.GameObjects.GameObject[] = [];
      if (isMe) parts.push(this.add.ellipse(0, FEET_Y - 1, 34, 13, 0xfacc15, 0.75).setStrokeStyle(2, 0xca8a04));
      parts.push(this.add.ellipse(0, FEET_Y - 1, 24, 7, 0x000000, 0.2));
      const sprite = this.add.image(0, FEET_Y, `${lookKey}-front-0`).setOrigin(0.5, 1).setScale(SCALE / ART_SCALE);
      const nameText = this.add
        .text(0, top - 2, name, {
          fontFamily: FONT,
          fontSize: "12px",
          fontStyle: "bold",
          color: isMe ? "#facc15" : "#ffffff",
          stroke: "#1e3a8a",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 1);
      const heart = this.add.text(0, top - 16, "", { fontSize: "11px" }).setOrigin(0.5, 1);
      const badge = this.add.text(16, top + 8, "", { fontSize: "16px" }).setOrigin(0.5);
      const bubbleBg = this.add.graphics();
      const bubbleText = this.add
        .text(0, 0, "", { fontFamily: FONT, fontSize: "12px", fontStyle: "bold", color: "#1f2937" })
        .setOrigin(0.5);
      const bubble = this.add.container(0, top - 36, [bubbleBg, bubbleText]).setVisible(false);
      parts.push(sprite, nameText, heart, badge, bubble);
      const root = this.add.container(0, 0, parts).setDepth(3);
      return { root, sprite, lookKey, name: nameText, badge, heart, bubble, bubbleBg, bubbleText, lastBubble: "", lastX: 0, lastY: 0, walkMs: 0 };
    }

    private syncPerson(
      view: PersonView,
      p: { x: number; y: number; facing: Direction; look: Look; activity: string | null },
      bubble: string,
      friendship: number | null,
      deltaMs: number,
      isMe: boolean,
    ): void {
      const lookKey = lookHash(p.look);
      if (lookKey !== view.lookKey) view.lookKey = this.ensureLook(p.look);
      view.root.setPosition(p.x, p.y);
      view.root.setDepth(3 + p.y / 10000 + (isMe ? 0.00001 : 0));

      const moving = Math.hypot(p.x - view.lastX, p.y - view.lastY) > 0.15;
      view.lastX = p.x;
      view.lastY = p.y;
      view.walkMs = moving ? view.walkMs + deltaMs : 0;
      const frame: StudentFrame = moving ? (Math.floor(view.walkMs / STEP_MS) % 2 === 0 ? 1 : 2) : 0;
      const pose: StudentView = p.facing === "up" ? "back" : p.facing === "down" ? "front" : "side";
      view.sprite.setTexture(`${view.lookKey}-${pose}-${frame}`).setFlipX(p.facing === "left");

      view.badge.setText(p.activity ? (activities[p.activity]?.emoji ?? "") : "");
      view.heart.setText(friendship !== null && friendship >= 10 ? "❤️".repeat(friendLevel(friendship).hearts - 1) : "");

      if (bubble !== view.lastBubble) {
        view.lastBubble = bubble;
        view.bubble.setVisible(Boolean(bubble));
        if (bubble) {
          view.bubbleText.setText(bubble);
          const w = view.bubbleText.width + 14;
          const h = view.bubbleText.height + 8;
          view.bubbleBg.clear();
          view.bubbleBg.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 8);
          view.bubbleBg.lineStyle(2, NAVY, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
          view.bubbleBg.fillStyle(0xffffff, 1).fillTriangle(-5, h / 2 - 1, 5, h / 2 - 1, 0, h / 2 + 6);
        }
      }
    }

    private syncPeople(client: LifeClient, deltaMs: number): void {
      const now = Date.now();
      const bubbleFor = (id: string) => {
        const b = client.bubbles.get(id);
        return b && b.until > now ? b.text : "";
      };
      const seen = new Set<string>();

      const meId = client.studentId;
      seen.add(meId);
      let me = this.people.get(meId);
      if (!me) {
        me = this.makePerson(client.name, client.sim.profile.look, true);
        this.people.set(meId, me);
      }
      this.syncPerson(
        me,
        { x: client.sim.x, y: client.sim.y, facing: client.sim.facing, look: client.sim.profile.look, activity: client.sim.activity?.key ?? null },
        bubbleFor(meId),
        null,
        deltaMs,
        true,
      );

      for (const c of client.classmates.values()) {
        seen.add(c.id);
        let view = this.people.get(c.id);
        if (!view) {
          view = this.makePerson(c.name, c.look, false);
          this.people.set(c.id, view);
        }
        this.syncPerson(
          view,
          { x: c.display.x, y: c.display.y, facing: c.facing, look: c.look, activity: c.activity },
          bubbleFor(c.id),
          client.friendships[c.id] ?? 0,
          deltaMs,
          false,
        );
      }

      for (const [id, view] of this.people) {
        if (!seen.has(id)) {
          view.root.destroy();
          this.people.delete(id);
        }
      }
    }

    // -- Camera -----------------------------------------------------------

    private syncCamera(client: LifeClient): void {
      const { width, height } = this.scale.gameSize;
      if (!width || !height) return;
      const minZoom = this.isTouch ? Math.min(1.15, Math.max(MIN_TOUCH_ZOOM, (height / LIFE_WORLD.height) * 0.9)) : MIN_ZOOM;
      const zoom = Math.min(MAX_ZOOM, Math.max(Math.min(width / LIFE_WORLD.width, height / LIFE_WORLD.height), minZoom));
      const viewW = width / zoom;
      const viewH = height / zoom;
      const clamp = (v: number, view: number, size: number) =>
        view >= size ? size / 2 : Math.min(size - view / 2, Math.max(view / 2, v));
      const target = { x: clamp(client.sim.x, viewW, LIFE_WORLD.width), y: clamp(client.sim.y, viewH, LIFE_WORLD.height) };
      if (!this.camCenter || zoom !== this.zoom) this.camCenter = target;
      else {
        this.camCenter.x += (target.x - this.camCenter.x) * 0.15;
        this.camCenter.y += (target.y - this.camCenter.y) * 0.15;
      }
      this.zoom = zoom;
      this.cameras.main.setZoom(zoom).centerOn(this.camCenter.x, this.camCenter.y);
    }
  };
}
