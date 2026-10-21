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

describe("bulletsVsZombies with pierce and splash", () => {
  it("lets a piercing bullet fly on and damage each zombie only once", () => {
    const zombies = [makeZombie({ id: 1, hp: 5, y: 100 }), makeZombie({ id: 2, hp: 5, y: 105 })];
    const first = bulletsVsZombies(
      makeState({ bullets: [makeBullet({ y: 100, pierce: true, damage: 2 })], zombies }),
    );
    expect(first.bullets).toHaveLength(1);
    expect(first.bullets[0].hit).toEqual([1, 2]);
    expect(first.zombies.map((z) => z.hp)).toEqual([3, 3]);

    const second = bulletsVsZombies(first);
    expect(second.zombies.map((z) => z.hp)).toEqual([3, 3]);
  });

  it("does not mutate the piercing bullet's hit list in place", () => {
    const bullet = makeBullet({ y: 100, pierce: true });
    bulletsVsZombies(makeState({ bullets: [bullet], zombies: [makeZombie({ id: 1, hp: 5, y: 100 })] }));
    expect(bullet.hit).toEqual([]);
  });

  it("damages every zombie within the splash radius and consumes the shell", () => {
    const next = bulletsVsZombies(
      makeState({
        bullets: [makeBullet({ y: 100, damage: 4, splash: 40 })],
        zombies: [
          makeZombie({ id: 1, x: 200, y: 100, hp: 10 }),
          makeZombie({ id: 2, x: 230, y: 100, hp: 10 }), // inside the radius
          makeZombie({ id: 3, x: 300, y: 100, hp: 10 }), // outside the radius
        ],
      }),
    );
    expect(next.bullets).toHaveLength(0);
    expect(next.zombies.map((z) => [z.id, z.hp])).toEqual([[1, 6], [2, 6], [3, 10]]);
  });

  it("removes zombies a splash kills", () => {
    const next = bulletsVsZombies(
      makeState({
        bullets: [makeBullet({ y: 100, damage: 4, splash: 40 })],
        zombies: [makeZombie({ id: 1, hp: 3, y: 100 }), makeZombie({ id: 2, x: 220, hp: 3, y: 100 })],
      }),
    );
    expect(next.zombies).toHaveLength(0);
  });

  it("always damages the zombie a splash shell hits, even outside the splash radius", () => {
    // A splash smaller than the zombie box must never make a shell vanish without hurting its target.
    const next = bulletsVsZombies(
      makeState({
        bullets: [makeBullet({ x: 200, y: 100, damage: 4, splash: 5 })],
        zombies: [makeZombie({ id: 1, x: 212, y: 112, hp: 10 })], // box corner, distance ~17 > 5
      }),
    );
    expect(next.bullets).toHaveLength(0);
    expect(next.zombies.map((z) => [z.id, z.hp])).toEqual([[1, 6]]);
  });

  it("damages the hit zombie once and other zombies inside the splash radius once", () => {
    const next = bulletsVsZombies(
      makeState({
        bullets: [makeBullet({ x: 200, y: 100, damage: 4, splash: 5 })],
        zombies: [
          makeZombie({ id: 1, x: 212, y: 112, hp: 10 }), // primary, at box corner
          makeZombie({ id: 2, x: 202, y: 100, hp: 10 }), // distance 2, inside the radius
        ],
      }),
    );
    expect(next.bullets).toHaveLength(0);
    expect(next.zombies.map((z) => [z.id, z.hp])).toEqual([[1, 6], [2, 6]]);
  });

  it("lets a splash shell fly on when it misses every zombie", () => {
    const next = bulletsVsZombies(
      makeState({ bullets: [makeBullet({ x: 300, y: 100, splash: 40 })], zombies: [makeZombie()] }),
    );
    expect(next.bullets).toHaveLength(1);
  });
});
