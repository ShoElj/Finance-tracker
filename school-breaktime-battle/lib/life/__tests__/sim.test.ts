import { describe, expect, it } from "vitest";
import { DAY_MS, getSchoolTime } from "../clock";
import { isWalkable } from "@/lib/game/collision";
import { LIFE_SPAWN, lifeGeometry, lifeSpots } from "../map";
import {
  buyOrWear,
  createSim,
  gradeLetter,
  newProfile,
  receiveSocial,
  sendSocial,
  startActivity,
  stepLife,
  type LifeEvent,
  type LifeSim,
} from "../sim";
import { randomStarterLook, sanitizeLook, wardrobe } from "../wardrobe";

const DAY = 1000;
/** A moment `sec` seconds into school day DAY. */
const at = (sec: number) => DAY * DAY_MS + sec * 1000;
const still = { dx: 0, dy: 0 };

function sim(now: number): LifeSim {
  return createSim("me", newProfile("me", randomStarterLook(() => 0.3), now), now);
}

function runFor(s: LifeSim, ms: number, start: number, step = 100): LifeEvent[] {
  const events: LifeEvent[] = [];
  for (let t = 0; t < ms; t += step) events.push(...stepLife(s, step, start + t, still));
  return events;
}

describe("school clock", () => {
  it("follows the schedule", () => {
    expect(getSchoolTime(at(10)).period.kind).toBe("assembly");
    expect(getSchoolTime(at(100)).period.kind).toBe("lesson");
    expect(getSchoolTime(at(200)).period.kind).toBe("break");
    expect(getSchoolTime(at(560)).period.kind).toBe("home");
    expect(getSchoolTime(at(0)).clockLabel).toBe("7:30 AM");
    expect(getSchoolTime(at(100)).subject).toBeTruthy();
  });
});

describe("map", () => {
  it("every activity spot and the spawn point can be reached", () => {
    expect(isWalkable(LIFE_SPAWN.x, LIFE_SPAWN.y, 12, lifeGeometry.zones, lifeGeometry.solids, lifeGeometry.world)).toBe(true);
    for (const s of lifeSpots) {
      expect(isWalkable(s.x, s.y, 12, lifeGeometry.zones, lifeGeometry.solids, lifeGeometry.world), s.id).toBe(true);
    }
  });
});

describe("activities", () => {
  it("attending a lesson takes time, then raises grades and pays coins", () => {
    const now = at(60);
    const s = sim(now);
    const lesson = lifeSpots.find((p) => p.id === "lesson")!;
    Object.assign(s, { x: lesson.x, y: lesson.y });
    const coins = s.profile.coins;
    expect(startActivity(s, "lesson", now)).toEqual({ ok: true });
    const events = runFor(s, 21_000, now);
    expect(events.some((e) => e.kind === "activity_done" && e.key === "attend_lesson")).toBe(true);
    expect(s.profile.day.gradePoints).toBeGreaterThan(0);
    expect(s.profile.day.counters.lessons).toBe(1);
    expect(s.profile.coins).toBeGreaterThanOrEqual(coins + 5);
  });

  it("respects opening hours and prices", () => {
    const s = sim(at(60));
    const meal = lifeSpots.find((p) => p.id === "meal")!;
    Object.assign(s, { x: meal.x, y: meal.y });
    expect(startActivity(s, "meal", at(60))).toMatchObject({ ok: false });
    s.profile.coins = 5;
    expect(startActivity(s, "meal", at(200))).toEqual({ ok: false, reason: "You need 10 🪙" });
    s.profile.coins = 20;
    expect(startActivity(s, "meal", at(200))).toEqual({ ok: true });
    expect(s.profile.coins).toBe(10);
  });

  it("walking away cancels and refunds", () => {
    const s = sim(at(200));
    const snack = lifeSpots.find((p) => p.id === "snack")!;
    Object.assign(s, { x: snack.x, y: snack.y + 20 });
    s.profile.coins = 10;
    startActivity(s, "snack", at(200));
    const events = stepLife(s, 100, at(200), { dx: 0, dy: 1 });
    expect(events.some((e) => e.kind === "activity_cancelled")).toBe(true);
    expect(s.profile.coins).toBe(10);
  });

  it("needs drop over time", () => {
    const s = sim(at(50));
    const before = s.profile.day.needs.hunger;
    runFor(s, 60_000, at(50), 1000);
    expect(s.profile.day.needs.hunger).toBeLessThan(before - 5);
  });
});

describe("goals, report card and new days", () => {
  it("completes goals and pays rewards", () => {
    const s = sim(at(60));
    s.profile.day.goals = [{ id: "hi3", done: false }];
    const coins = s.profile.coins;
    for (const id of ["a", "b", "b", "c"]) sendSocial(s, "hi", id, at(60));
    const events = stepLife(s, 10, at(60), still);
    expect(s.profile.day.counters.greetings).toBe(3);
    expect(s.profile.day.goals[0].done || events.some((e) => e.kind === "goal_done")).toBe(true);
    expect(s.profile.coins).toBe(coins + 15);
  });

  it("shows the report card at home time once, then starts a fresh day", () => {
    const s = sim(at(550));
    s.profile.day.gradePoints = 72;
    const home = runFor(s, 6000, at(550), 500).filter((e) => e.kind === "report_card");
    expect(home).toHaveLength(1);
    expect(home[0].kind === "report_card" && home[0].report.grade).toBe("A");
    const next = stepLife(s, 100, (DAY + 1) * DAY_MS + 1000, still);
    expect(next.some((e) => e.kind === "new_day")).toBe(true);
    expect(next.some((e) => e.kind === "report_card")).toBe(false);
    expect(s.profile.day.gradePoints).toBe(0);
    expect(s.profile.day.goals).toHaveLength(3);
  });

  it("grades", () => {
    expect(gradeLetter(75)).toBe("A");
    expect(gradeLetter(55)).toBe("B");
    expect(gradeLetter(5)).toBe("F");
  });
});

describe("friends and wardrobe", () => {
  it("greeting the same classmate twice only builds friendship once a day", () => {
    const s = sim(at(60));
    expect(sendSocial(s, "hi", "ada", at(60))).toMatchObject({ ok: true, friendshipPoints: 2 });
    expect(sendSocial(s, "hi", "ada", at(61))).toMatchObject({ ok: true, friendshipPoints: 0 });
  });

  it("helping needs the library and has a cooldown; the helped student gains grades", () => {
    const s = sim(at(60));
    expect(sendSocial(s, "help", "ada", at(60))).toMatchObject({ ok: false });
    const study = lifeSpots.find((p) => p.id === "study")!;
    Object.assign(s, { x: study.x, y: study.y });
    expect(sendSocial(s, "help", "ada", at(60))).toMatchObject({ ok: true });
    expect(sendSocial(s, "help", "ada", at(70))).toMatchObject({ ok: false });
    const other = sim(at(60));
    receiveSocial(other, "help");
    expect(other.profile.day.gradePoints).toBe(5);
  });

  it("buys an item once, then wears it for free", () => {
    const profile = newProfile("me", randomStarterLook(), at(0));
    const gold = wardrobe.find((i) => i.id === "shirt:#eab308")!;
    profile.coins = 60;
    expect(buyOrWear(profile, gold)).toEqual({ ok: true });
    expect(profile.coins).toBe(10);
    expect(profile.look.shirt).toBe("#eab308");
    expect(buyOrWear(profile, gold)).toEqual({ ok: true });
    expect(profile.coins).toBe(10);
  });

  it("rejects malformed looks from the network", () => {
    expect(sanitizeLook({ skin: "red" })).toBeNull();
    expect(sanitizeLook(randomStarterLook())).not.toBeNull();
  });
});
