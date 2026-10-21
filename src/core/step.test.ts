import { describe, expect, it } from "vitest";
import { POWER_DURATION, SHIELD_CHARGES, SQUAD_Y, TICK } from "./constants";
import { step } from "./step";
import { makeCrate, makePickup, makeState, makeZombie, noInput } from "./testing";
import type { GameState } from "./types";

const run = (state: GameState, ticks: number): GameState => {
  let s = state;
  for (let i = 0; i < ticks; i++) s = step(s, noInput, TICK);
  return s;
};

describe("step", () => {
  it("returns the same state once the game is over", () => {
    const lost = makeState({ status: "lost" });
    expect(step(lost, noInput, TICK)).toBe(lost);
    const won = makeState({ status: "won" });
    expect(step(won, noInput, TICK)).toBe(won);
  });

  it("kills a zombie standing in the line of fire", () => {
    const start = makeState({ squad: { x: 200, count: 1 }, zombies: [makeZombie({ x: 200, y: 300, hp: 1 })] });
    const end = run(start, 60);
    expect(end.zombies).toHaveLength(0);
    expect(end.squad.count).toBe(1);
    expect(end.status).toBe("playing");
  });

  it("wins when the stage scrolls to the finish with the squad alive", () => {
    const start = makeState({ stage: { scrollY: 0, length: 3, spawnCursor: 0, spawns: [] } });
    expect(run(start, 10).status).toBe("won");
  });

  it("loses when zombies overrun the squad", () => {
    const crowd = Array.from({ length: 6 }, () => makeZombie({ x: 200, y: 600 }));
    const start = makeState({ squad: { x: 200, count: 5 }, zombies: crowd });
    expect(run(start, 5).status).toBe("lost");
  });

  it("does not mutate its input", () => {
    const start = makeState({ zombies: [makeZombie({ speed: 50 })] });
    const snapshot = structuredClone(start);
    step(start, noInput, TICK);
    expect(start).toEqual(snapshot);
  });
});

describe("step with power-ups", () => {
  it("opens a crate in the line of fire and leaves a pickup", () => {
    const start = makeState({
      squad: { x: 200, count: 1 },
      crates: [makeCrate({ x: 200, y: 300, hp: 1, power: "tank" })],
    });
    const end = run(start, 60);
    expect(end.crates).toHaveLength(0);
    expect(end.pickups.map((p) => p.power)).toEqual(["tank"]);
  });

  it("grants a power-up when the squad touches a pickup", () => {
    const start = makeState({ squad: { x: 200, count: 5 }, pickups: [makePickup({ y: SQUAD_Y, power: "rapid" })] });
    const next = step(start, noInput, TICK);
    // powerTimer runs before pickups resolve, so the new timer starts full this tick.
    expect(next.power).toEqual({ kind: "rapid", remaining: POWER_DURATION.rapid, charges: 0 });
    expect(next.pickups).toHaveLength(0);
  });

  it("expires a power-up after its duration", () => {
    const start = makeState({ power: { kind: "rapid", remaining: 0.05, charges: 0 } });
    expect(run(start, 5).power).toBeNull();
  });

  it("a shield collected this tick already protects against a zombie arriving this tick", () => {
    const start = makeState({
      squad: { x: 200, count: 5 },
      pickups: [makePickup({ y: SQUAD_Y, power: "shield" })],
      zombies: [makeZombie({ x: 200, y: SQUAD_Y, hp: 99 })],
    });
    const next = step(start, noInput, TICK);
    expect(next.squad.count).toBe(5);
    expect(next.power?.charges).toBe(SHIELD_CHARGES - 1);
  });

  it("a bomb collected this tick clears a zombie before it can hit", () => {
    const start = makeState({
      squad: { x: 200, count: 5 },
      pickups: [makePickup({ y: SQUAD_Y, power: "bomb" })],
      zombies: [makeZombie({ x: 200, y: SQUAD_Y, hp: 5 })],
    });
    const next = step(start, noInput, TICK);
    expect(next.zombies).toHaveLength(0);
    expect(next.squad.count).toBe(5);
  });
});
