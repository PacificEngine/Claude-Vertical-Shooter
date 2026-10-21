import { describe, expect, it } from "vitest";
import { BOMB_DAMAGE, POWER_DURATION, SHIELD_CHARGES, SQUAD_Y } from "../constants";
import { makePickup, makeState, makeZombie } from "../testing";
import type { Pickup } from "../types";
import { pickupsVsSquad } from "./pickupsVsSquad";

const collect = (pickup: Partial<Pickup>, extra = {}) =>
  pickupsVsSquad(makeState({ squad: { x: 200, count: 5 }, pickups: [makePickup({ y: SQUAD_Y, ...pickup })], ...extra }));

describe("pickupsVsSquad", () => {
  it("activates a timed power-up and consumes the pickup", () => {
    const next = collect({ power: "rapid" });
    expect(next.power).toEqual({ kind: "rapid", remaining: POWER_DURATION.rapid, charges: 0 });
    expect(next.pickups).toHaveLength(0);
  });

  it("gives the shield its charges", () => {
    expect(collect({ power: "shield" }).power).toEqual({
      kind: "shield", remaining: POWER_DURATION.shield, charges: SHIELD_CHARGES,
    });
  });

  it("replaces the active power-up and restarts the timer", () => {
    const next = collect({ power: "tank" }, { power: { kind: "rapid", remaining: 1, charges: 0 } });
    expect(next.power).toEqual({ kind: "tank", remaining: POWER_DURATION.tank, charges: 0 });
  });

  it("bomb damages on-screen zombies, removes the dead and keeps the active power", () => {
    const active = { kind: "rapid" as const, remaining: 3, charges: 0 };
    const next = collect(
      { power: "bomb" },
      {
        power: active,
        zombies: [
          makeZombie({ id: 1, y: 100, hp: BOMB_DAMAGE }),
          makeZombie({ id: 2, y: 100, hp: BOMB_DAMAGE + 5 }),
          makeZombie({ id: 3, y: -20, hp: 1 }),
        ],
      },
    );
    expect(next.zombies.map((z) => [z.id, z.hp])).toEqual([[2, 5], [3, 1]]);
    expect(next.power).toBe(active);
    expect(next.pickups).toHaveLength(0);
  });

  it("ignores pickups out of reach", () => {
    const farSideways = collect({ power: "rapid", x: 300 });
    expect(farSideways.power).toBeNull();
    expect(farSideways.pickups).toHaveLength(1);
    const farAbove = collect({ power: "rapid", y: SQUAD_Y - 200 });
    expect(farAbove.power).toBeNull();
    expect(farAbove.pickups).toHaveLength(1);
  });
});
