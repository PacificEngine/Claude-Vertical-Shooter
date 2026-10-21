import { describe, expect, it } from "vitest";
import { makeBullet, makeState, makeZombie } from "../testing";
import { bulletsVsZombies } from "./bulletsVsZombies";

describe("bulletsVsZombies", () => {
  it("kills a zombie and consumes the bullet", () => {
    const next = bulletsVsZombies(
      makeState({ bullets: [makeBullet({ x: 200, y: 100, damage: 1 })], zombies: [makeZombie({ hp: 1 })] }),
    );
    expect(next.zombies).toHaveLength(0);
    expect(next.bullets).toHaveLength(0);
  });

  it("wounds a zombie that survives", () => {
    const next = bulletsVsZombies(
      makeState({ bullets: [makeBullet({ y: 100, damage: 1 })], zombies: [makeZombie({ hp: 3 })] }),
    );
    expect(next.zombies[0].hp).toBe(2);
    expect(next.bullets).toHaveLength(0);
  });

  it("lets bullets that miss fly on", () => {
    const next = bulletsVsZombies(
      makeState({ bullets: [makeBullet({ x: 300, y: 100 })], zombies: [makeZombie()] }),
    );
    expect(next.bullets).toHaveLength(1);
    expect(next.zombies[0].hp).toBe(1);
  });

  it("applies several bullets to the same zombie", () => {
    const next = bulletsVsZombies(
      makeState({
        bullets: [makeBullet({ y: 100 }), makeBullet({ y: 100 })],
        zombies: [makeZombie({ hp: 2 })],
      }),
    );
    expect(next.zombies).toHaveLength(0);
    expect(next.bullets).toHaveLength(0);
  });

  it("lets a bullet hit only one zombie", () => {
    const next = bulletsVsZombies(
      makeState({
        bullets: [makeBullet({ y: 100 })],
        zombies: [makeZombie({ hp: 1 }), makeZombie({ hp: 1 })],
      }),
    );
    expect(next.zombies).toHaveLength(1);
  });
});
