import { describe, expect, it } from "vitest";
import { makeBullet, makeCrate, makeState } from "../testing";
import { bulletsVsCrates } from "./bulletsVsCrates";

describe("bulletsVsCrates", () => {
  it("damages a crate and consumes the bullet", () => {
    const next = bulletsVsCrates(
      makeState({ bullets: [makeBullet({ damage: 1 })], crates: [makeCrate({ hp: 3 })] }),
    );
    expect(next.crates[0].hp).toBe(2);
    expect(next.bullets).toHaveLength(0);
    expect(next.pickups).toHaveLength(0);
  });

  it("destroys a crate and leaves a pickup of its power where it was", () => {
    const next = bulletsVsCrates(
      makeState({
        bullets: [makeBullet({ damage: 5, x: 150, y: 310 })],
        crates: [makeCrate({ x: 150, y: 310, hp: 3, power: "tank" })],
      }),
    );
    expect(next.crates).toHaveLength(0);
    expect(next.pickups).toEqual([{ x: 150, y: 310, power: "tank" }]);
  });

  it("lets bullets that miss fly on", () => {
    const next = bulletsVsCrates(makeState({ bullets: [makeBullet({ x: 300 })], crates: [makeCrate()] }));
    expect(next.bullets).toHaveLength(1);
    expect(next.crates[0].hp).toBe(3);
  });

  it("stops piercing bullets at crates", () => {
    const next = bulletsVsCrates(
      makeState({ bullets: [makeBullet({ pierce: true })], crates: [makeCrate()] }),
    );
    expect(next.bullets).toHaveLength(0);
    expect(next.crates[0].hp).toBe(2);
  });

  it("keeps existing pickups", () => {
    const existing = { x: 10, y: 10, power: "bomb" as const };
    const next = bulletsVsCrates(makeState({ pickups: [existing] }));
    expect(next.pickups).toEqual([existing]);
  });
});
