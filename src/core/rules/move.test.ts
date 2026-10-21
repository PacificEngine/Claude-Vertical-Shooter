import { describe, expect, it } from "vitest";
import { GATE_HEIGHT, SCROLL_SPEED, WORLD_HEIGHT, WORLD_WIDTH, SQUAD_HALF_WIDTH } from "../constants";
import { makeBullet, makeGate, makeState, makeZombie } from "../testing";
import { moveRule } from "./move";

describe("moveRule", () => {
  it("moves the squad toward the target at SQUAD_SPEED", () => {
    const next = moveRule(makeState(), { targetX: 400 }, 0.1);
    expect(next.squad.x).toBeCloseTo(230);
  });

  it("does not overshoot the target", () => {
    const next = moveRule(makeState(), { targetX: 205 }, 0.1);
    expect(next.squad.x).toBeCloseTo(205);
  });

  it("keeps the squad inside the lane", () => {
    const right = moveRule(makeState({ squad: { x: 370, count: 5 } }), { targetX: 1000 }, 1);
    expect(right.squad.x).toBe(WORLD_WIDTH - SQUAD_HALF_WIDTH);
    const left = moveRule(makeState({ squad: { x: 30, count: 5 } }), { targetX: -50 }, 1);
    expect(left.squad.x).toBe(SQUAD_HALF_WIDTH);
  });

  it("scrolls the stage", () => {
    const next = moveRule(makeState(), { targetX: 200 }, 0.5);
    expect(next.stage.scrollY).toBeCloseTo(SCROLL_SPEED * 0.5);
  });

  it("moves bullets up and culls those above the screen", () => {
    const next = moveRule(
      makeState({ bullets: [makeBullet({ y: 300 }), makeBullet({ y: -15 })] }),
      { targetX: 200 },
      0.1,
    );
    expect(next.bullets).toHaveLength(1);
    expect(next.bullets[0].y).toBeCloseTo(240);
  });

  it("moves zombies down at their own speed", () => {
    const next = moveRule(makeState({ zombies: [makeZombie({ y: 100, speed: 50 })] }), { targetX: 200 }, 0.1);
    expect(next.zombies[0].y).toBeCloseTo(105);
  });

  it("scrolls gates down and culls those below the screen", () => {
    const next = moveRule(
      makeState({ gates: [makeGate({ id: 1, y: 300 }), makeGate({ id: 2, y: WORLD_HEIGHT + GATE_HEIGHT })] }),
      { targetX: 200 },
      0.1,
    );
    expect(next.gates).toHaveLength(1);
    expect(next.gates[0].y).toBeCloseTo(306);
  });
});
