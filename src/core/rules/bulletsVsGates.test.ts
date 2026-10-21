import { describe, expect, it } from "vitest";
import { MAX_BULLETS } from "../constants";
import { makeBullet, makeGate, makeState } from "../testing";
import { bulletsVsGates } from "./bulletsVsGates";

describe("bulletsVsGates", () => {
  it("steps a mul gate and spawns value-1 copies", () => {
    const next = bulletsVsGates(makeState({ bullets: [makeBullet()], gates: [makeGate({ op: "mul", value: 2 })] }));
    expect(next.gates[0].value).toBe(3);
    expect(next.bullets).toHaveLength(3);
    expect(next.bullets.every((b) => b.passedGates.includes(1))).toBe(true);
  });

  it("adds the stepped value to bullet damage for an add gate", () => {
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet({ damage: 1 })], gates: [makeGate({ op: "add", value: 5 })] }),
    );
    expect(next.gates[0].value).toBe(6);
    expect(next.bullets[0].damage).toBe(7);
  });

  it("removes a bullet whose damage a sub gate reduces to zero or less, but still raises the gate", () => {
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet({ damage: 1 })], gates: [makeGate({ op: "sub", value: -100 })] }),
    );
    expect(next.gates[0].value).toBe(-99);
    expect(next.bullets).toHaveLength(0);
  });

  it("lets a strong bullet survive a sub gate with reduced damage", () => {
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet({ damage: 5 })], gates: [makeGate({ op: "sub", value: -3 })] }),
    );
    expect(next.gates[0].value).toBe(-2);
    expect(next.bullets[0].damage).toBe(3);
  });

  it("caps a sub gate's value at 0 so it becomes harmless", () => {
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet({ damage: 1 })], gates: [makeGate({ op: "sub", value: -1 })] }),
    );
    expect(next.gates[0].value).toBe(0);
    expect(next.bullets[0].damage).toBe(1);
    const again = bulletsVsGates(
      makeState({ bullets: [makeBullet({ damage: 1 })], gates: [makeGate({ op: "sub", value: 0 })] }),
    );
    expect(again.gates[0].value).toBe(0);
    expect(again.bullets[0].damage).toBe(1);
  });

  it("ignores bullets outside the gate", () => {
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet({ x: 300 }), makeBullet({ y: 100 })], gates: [makeGate()] }),
    );
    expect(next.gates[0].value).toBe(2);
    expect(next.bullets).toHaveLength(2);
  });

  it("affects each gate only once per bullet", () => {
    const next = bulletsVsGates(makeState({ bullets: [makeBullet({ passedGates: [1] })], gates: [makeGate()] }));
    expect(next.gates[0].value).toBe(2);
    expect(next.bullets).toHaveLength(1);
  });

  it("ignores squad gates", () => {
    const next = bulletsVsGates(makeState({ bullets: [makeBullet()], gates: [makeGate({ kind: "squad" })] }));
    expect(next.gates[0].value).toBe(2);
    expect(next.bullets).toHaveLength(1);
  });

  it("multiplies damage instead of copying when the bullet cap would be exceeded", () => {
    const filler = Array.from({ length: MAX_BULLETS - 1 }, () => makeBullet({ y: 0 }));
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet(), ...filler], gates: [makeGate({ op: "mul", value: 2 })] }),
    );
    expect(next.bullets).toHaveLength(MAX_BULLETS);
    expect(next.bullets[0].damage).toBe(3);
  });

  it("processes bullets in order so a second bullet sees the raised value", () => {
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet(), makeBullet()], gates: [makeGate({ op: "mul", value: 2 })] }),
    );
    expect(next.gates[0].value).toBe(4);
    expect(next.bullets).toHaveLength(2 + 2 + 3);
  });

  it("gives mul copies their own hit lists", () => {
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet({ hit: [7] })], gates: [makeGate({ op: "mul", value: 2 })] }),
    );
    expect(next.bullets).toHaveLength(3);
    expect(next.bullets[0].hit).toEqual([7]);
    expect(next.bullets[0].hit).not.toBe(next.bullets[1].hit);
  });
});
