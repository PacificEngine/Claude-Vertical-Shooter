import { describe, expect, it } from "vitest";
import {
  BASE_DAMAGE, FIRE_INTERVAL, MAX_BULLETS, MAX_VISIBLE, RAPID_RATE_MULT, SPREAD_VX, SQUAD_Y,
  TANK_DAMAGE_MULT, TANK_RATE_MULT, TANK_SPLASH,
} from "../constants";
import { makeBullet, makeState } from "../testing";
import { fireRule } from "./fire";

const squad = (count: number) => ({ x: 200, count });

describe("fireRule", () => {
  it("does not fire while the timer is still running", () => {
    const next = fireRule(makeState({ fireTimer: 0.2 }), 0.1);
    expect(next.bullets).toHaveLength(0);
    expect(next.fireTimer).toBeCloseTo(0.1);
  });

  it("fires one bullet per visible soldier from the formation positions", () => {
    const next = fireRule(makeState({ squad: squad(3), fireTimer: 0 }), 0.1);
    expect(next.bullets.map((b) => [b.x, b.y])).toEqual([
      [193, SQUAD_Y],
      [207, SQUAD_Y],
      [200, SQUAD_Y + 14],
    ]);
    expect(next.bullets.every((b) => b.damage === BASE_DAMAGE && b.passedGates.length === 0)).toBe(true);
    expect(next.fireTimer).toBeCloseTo(-0.1 + FIRE_INTERVAL);
  });

  it("scales damage for soldiers beyond MAX_VISIBLE", () => {
    const next = fireRule(makeState({ squad: squad(MAX_VISIBLE * 2) }), 0.1);
    expect(next.bullets).toHaveLength(MAX_VISIBLE);
    expect(next.bullets.every((b) => b.damage === BASE_DAMAGE * 2)).toBe(true);
  });

  it("fires nothing with an empty squad but resets the timer", () => {
    const next = fireRule(makeState({ squad: squad(0) }), 0.1);
    expect(next.bullets).toHaveLength(0);
    expect(next.fireTimer).toBeGreaterThan(0);
  });

  it("fires plain bullets with neutral power-up fields", () => {
    const next = fireRule(makeState({ squad: squad(1) }), 0.1);
    expect(next.bullets[0]).toMatchObject({ vx: 0, pierce: false, hit: [], splash: 0 });
  });

  it("never exceeds MAX_BULLETS", () => {
    const existing = Array.from({ length: MAX_BULLETS - 1 }, () => makeBullet());
    const next = fireRule(makeState({ squad: squad(3), bullets: existing }), 0.1);
    expect(next.bullets).toHaveLength(MAX_BULLETS);
  });
});

const withPower = (kind: "rapid" | "spread" | "pierce" | "tank" | "shield", count = 3) =>
  makeState({ squad: squad(count), power: { kind, remaining: 5, charges: 0 } });

describe("fireRule with a power-up", () => {
  it("rapid fire refills the timer with a shorter interval", () => {
    const next = fireRule(withPower("rapid"), 0.1);
    expect(next.bullets).toHaveLength(3);
    expect(next.fireTimer).toBeCloseTo(-0.1 + FIRE_INTERVAL * RAPID_RATE_MULT);
  });

  it("spread fires three bullets per soldier fanning out sideways", () => {
    const next = fireRule(withPower("spread"), 0.1);
    expect(next.bullets).toHaveLength(9);
    expect(next.bullets.map((b) => b.vx).sort((a, b) => a - b)).toEqual([
      -SPREAD_VX, -SPREAD_VX, -SPREAD_VX, 0, 0, 0, SPREAD_VX, SPREAD_VX, SPREAD_VX,
    ]);
    expect(next.bullets.every((b) => b.damage === BASE_DAMAGE)).toBe(true);
  });

  it("spread respects MAX_BULLETS", () => {
    const existing = Array.from({ length: MAX_BULLETS - 2 }, () => makeBullet());
    const next = fireRule({ ...withPower("spread"), bullets: existing }, 0.1);
    expect(next.bullets).toHaveLength(MAX_BULLETS);
  });

  it("pierce marks every bullet as piercing", () => {
    const next = fireRule(withPower("pierce"), 0.1);
    expect(next.bullets).toHaveLength(3);
    expect(next.bullets.every((b) => b.pierce)).toBe(true);
  });

  it("tank fires one heavy slow splash shell from the squad centre", () => {
    const next = fireRule(withPower("tank", 10), 0.1);
    expect(next.bullets).toHaveLength(1);
    expect(next.bullets[0]).toMatchObject({
      x: 200, y: SQUAD_Y, damage: BASE_DAMAGE * 10 * TANK_DAMAGE_MULT, splash: TANK_SPLASH, pierce: false,
    });
    expect(next.fireTimer).toBeCloseTo(-0.1 + FIRE_INTERVAL * TANK_RATE_MULT);
  });

  it("tank damage is not capped by MAX_VISIBLE", () => {
    const next = fireRule(withPower("tank", MAX_VISIBLE * 3), 0.1);
    expect(next.bullets[0].damage).toBe(BASE_DAMAGE * MAX_VISIBLE * 3 * TANK_DAMAGE_MULT);
  });

  it("shield does not change firing", () => {
    const next = fireRule(withPower("shield"), 0.1);
    expect(next.bullets).toHaveLength(3);
    expect(next.fireTimer).toBeCloseTo(-0.1 + FIRE_INTERVAL);
  });

  it("an empty squad under tank still resets the timer to the tank interval", () => {
    const next = fireRule(withPower("tank", 0), 0.1);
    expect(next.bullets).toHaveLength(0);
    expect(next.fireTimer).toBe(FIRE_INTERVAL * TANK_RATE_MULT);
  });
});
