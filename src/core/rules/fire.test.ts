import { describe, expect, it } from "vitest";
import { BASE_DAMAGE, FIRE_INTERVAL, MAX_BULLETS, MAX_VISIBLE, SQUAD_Y } from "../constants";
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

  it("never exceeds MAX_BULLETS", () => {
    const existing = Array.from({ length: MAX_BULLETS - 1 }, () => makeBullet());
    const next = fireRule(makeState({ squad: squad(3), bullets: existing }), 0.1);
    expect(next.bullets).toHaveLength(MAX_BULLETS);
  });
});
