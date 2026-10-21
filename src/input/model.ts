import { KEY_SPEED, WORLD_WIDTH } from "../core/constants";
import { clamp } from "../core/math";
import type { Input } from "../core/types";

const LEFT_KEYS = new Set(["arrowleft", "a"]);
const RIGHT_KEYS = new Set(["arrowright", "d"]);

// Pointer sets an absolute target; held keys nudge that same target, so
// whichever source acted last naturally wins.
export class InputModel {
  private targetX = WORLD_WIDTH / 2;
  private readonly held = new Set<string>();

  setPointer(worldX: number): void {
    this.targetX = clamp(worldX, 0, WORLD_WIDTH);
  }

  keyDown(key: string): void {
    this.held.add(key.toLowerCase());
  }

  keyUp(key: string): void {
    this.held.delete(key.toLowerCase());
  }

  // No keyup arrives when the window loses focus, so held keys must be dropped explicitly.
  releaseAll(): void {
    this.held.clear();
  }

  update(dt: number): Input {
    const left = [...this.held].some((k) => LEFT_KEYS.has(k)) ? 1 : 0;
    const right = [...this.held].some((k) => RIGHT_KEYS.has(k)) ? 1 : 0;
    this.targetX = clamp(this.targetX + (right - left) * KEY_SPEED * dt, 0, WORLD_WIDTH);
    return { targetX: this.targetX };
  }
}
