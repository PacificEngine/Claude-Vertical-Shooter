import { MAX_FRAME_SECONDS, TICK, WORLD_HEIGHT, WORLD_WIDTH } from "./core/constants";
import { createInitialState } from "./core/state";
import { step } from "./core/step";
import { InputModel } from "./input/model";
import { draw } from "./render/canvas";
import { stage1 } from "./stages/stage1";

const RESTART_DELAY_MS = 400;
const PIXEL_RATIO = 2;

const canvas = document.getElementById("game") as HTMLCanvasElement;
canvas.width = WORLD_WIDTH * PIXEL_RATIO;
canvas.height = WORLD_HEIGHT * PIXEL_RATIO;
const context = canvas.getContext("2d");
if (!context) throw new Error("2D canvas is not supported in this browser");
const ctx: CanvasRenderingContext2D = context;
const viewport = { width: canvas.width, height: canvas.height };

const seedParam = new URLSearchParams(location.search).get("seed");
const newGame = () => createInitialState(stage1, seedParam ? Number(seedParam) : Date.now() >>> 0);

let state = newGame();
let endedAt: number | null = null;
const input = new InputModel();

const toWorldX = (clientX: number): number => {
  const rect = canvas.getBoundingClientRect();
  return ((clientX - rect.left) / rect.width) * WORLD_WIDTH;
};

function tryRestart(): void {
  if (state.status !== "playing" && endedAt !== null && performance.now() - endedAt > RESTART_DELAY_MS) {
    state = newGame();
    endedAt = null;
  }
}

canvas.addEventListener("pointermove", (e) => input.setPointer(toWorldX(e.clientX)));
canvas.addEventListener("pointerdown", (e) => {
  input.setPointer(toWorldX(e.clientX));
  tryRestart();
});
window.addEventListener("keydown", (e) => {
  input.keyDown(e.key);
  if (!e.repeat) tryRestart(); // a held key must not skip the result screen
});
window.addEventListener("keyup", (e) => input.keyUp(e.key));
window.addEventListener("blur", () => input.releaseAll());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) input.releaseAll();
});

let last = performance.now();
let accumulator = 0;

function frame(now: number): void {
  accumulator += Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
  last = now;
  while (accumulator >= TICK) {
    state = step(state, input.update(TICK), TICK);
    accumulator -= TICK;
  }
  if (state.status !== "playing" && endedAt === null) endedAt = now;
  draw(ctx, state, viewport);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Test hook used by e2e tests (run against the dev server); stripped from production builds.
if (import.meta.env.DEV) {
  (window as unknown as { __game: unknown }).__game = {
    state: () => state,
    fastForward(ticks: number, targetX: number) {
      for (let i = 0; i < ticks; i++) state = step(state, { targetX }, TICK);
    },
  };
}
