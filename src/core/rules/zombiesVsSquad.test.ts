import { describe, expect, it } from "vitest";
import { SQUAD_Y, WORLD_HEIGHT } from "../constants";
import { makeState, makeZombie } from "../testing";
import { zombiesVsSquad } from "./zombiesVsSquad";

const squad = (count: number) => ({ x: 200, count });

describe("zombiesVsSquad", () => {
  it("costs a soldier and removes the zombie that reaches the squad", () => {
    const next = zombiesVsSquad(makeState({ squad: squad(5), zombies: [makeZombie({ y: SQUAD_Y })] }));
    expect(next.squad.count).toBe(4);
    expect(next.zombies).toHaveLength(0);
  });

  it("costs one soldier per zombie", () => {
    const next = zombiesVsSquad(
      makeState({ squad: squad(5), zombies: [makeZombie({ y: SQUAD_Y }), makeZombie({ y: SQUAD_Y, x: 210 })] }),
    );
    expect(next.squad.count).toBe(3);
  });

  it("never drops the squad below zero", () => {
    const next = zombiesVsSquad(makeState({ squad: squad(1), zombies: [makeZombie({ y: SQUAD_Y }), makeZombie({ y: SQUAD_Y })] }));
    expect(next.squad.count).toBe(0);
  });

  it("leaves zombies that are still far away", () => {
    const next = zombiesVsSquad(makeState({ squad: squad(5), zombies: [makeZombie({ y: SQUAD_Y - 100 })] }));
    expect(next.squad.count).toBe(5);
    expect(next.zombies).toHaveLength(1);
  });

  it("lets zombies that pass beside the squad continue", () => {
    const next = zombiesVsSquad(makeState({ squad: squad(5), zombies: [makeZombie({ x: 300, y: SQUAD_Y })] }));
    expect(next.squad.count).toBe(5);
    expect(next.zombies).toHaveLength(1);
  });

  it("silently removes zombies that left the bottom of the screen", () => {
    const next = zombiesVsSquad(
      makeState({ squad: squad(5), zombies: [makeZombie({ x: 0, y: WORLD_HEIGHT + 50 })] }),
    );
    expect(next.squad.count).toBe(5);
    expect(next.zombies).toHaveLength(0);
  });
});

const shield = (charges: number) => ({ kind: "shield" as const, remaining: 5, charges });

describe("zombiesVsSquad with a shield", () => {
  it("absorbs a contact without losing a soldier and spends a charge", () => {
    const next = zombiesVsSquad(
      makeState({ squad: squad(5), power: shield(3), zombies: [makeZombie({ y: SQUAD_Y })] }),
    );
    expect(next.squad.count).toBe(5);
    expect(next.zombies).toHaveLength(0);
    expect(next.power).toEqual(shield(2));
  });

  it("ends when the last charge is spent", () => {
    const next = zombiesVsSquad(
      makeState({ squad: squad(5), power: shield(1), zombies: [makeZombie({ y: SQUAD_Y })] }),
    );
    expect(next.squad.count).toBe(5);
    expect(next.power).toBeNull();
  });

  it("lets overflow zombies cost soldiers", () => {
    const next = zombiesVsSquad(
      makeState({
        squad: squad(5),
        power: shield(1),
        zombies: [makeZombie({ y: SQUAD_Y }), makeZombie({ y: SQUAD_Y }), makeZombie({ y: SQUAD_Y })],
      }),
    );
    expect(next.squad.count).toBe(3);
    expect(next.power).toBeNull();
  });

  it("leaves the shield alone when nothing reaches the squad", () => {
    const next = zombiesVsSquad(makeState({ squad: squad(5), power: shield(3), zombies: [makeZombie({ y: 100 })] }));
    expect(next.power).toEqual(shield(3));
  });

  it("ignores other power-ups", () => {
    const power = { kind: "tank" as const, remaining: 5, charges: 0 };
    const next = zombiesVsSquad(makeState({ squad: squad(5), power, zombies: [makeZombie({ y: SQUAD_Y })] }));
    expect(next.squad.count).toBe(4);
    expect(next.power).toBe(power);
  });
});
