import { POWER_KINDS, WORLD_WIDTH } from "./constants";
import type { Stage } from "./types";

export function validateStage(stage: Stage): void {
  if (stage.length <= 0) throw new Error("Stage length must be positive");

  stage.spawns.forEach((spawn, i) => {
    const fail = (reason: string): never => {
      throw new Error(`Spawn ${i}: ${reason}`);
    };

    if (i > 0 && spawn.at < stage.spawns[i - 1].at) fail("not sorted by at");
    if (spawn.at < 0 || spawn.at > stage.length) {
      fail(`at ${spawn.at} is outside [0, ${stage.length}]`);
    }

    switch (spawn.type) {
      case "zombie":
        if (spawn.hp <= 0) fail("hp must be positive");
        if (spawn.speed <= 0) fail("speed must be positive");
        if (spawn.x < 0 || spawn.x > WORLD_WIDTH) fail("x is outside the lane");
        break;
      case "zombieWave":
        if (!Number.isInteger(spawn.count) || spawn.count <= 0) fail("count must be a positive integer");
        if (spawn.hp <= 0) fail("hp must be positive");
        if (spawn.speed <= 0) fail("speed must be positive");
        if (spawn.spread[0] > spawn.spread[1] || spawn.spread[0] < 0 || spawn.spread[1] > WORLD_WIDTH) {
          fail("spread must be an ordered range inside the lane");
        }
        break;
      case "gate":
        if (spawn.width <= 0) fail("width must be positive");
        if (spawn.x - spawn.width / 2 < 0 || spawn.x + spawn.width / 2 > WORLD_WIDTH) {
          fail("gate extends outside the lane");
        }
        if (!Number.isInteger(spawn.value)) fail("value must be an integer");
        if (spawn.op === "mul" && spawn.value < 1) fail("mul value must be at least 1");
        if (spawn.op === "sub" && spawn.value >= 0) fail("sub value must be negative");
        break;
      case "crate":
        if (spawn.hp <= 0) fail("hp must be positive");
        if (spawn.x < 0 || spawn.x > WORLD_WIDTH) fail("x is outside the lane");
        if (!POWER_KINDS.includes(spawn.power)) fail(`unknown power "${spawn.power}"`);
        break;
    }
  });
}
