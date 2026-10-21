import {
  GATE_HEIGHT, MAX_VISIBLE, SQUAD_Y, WORLD_HEIGHT, WORLD_WIDTH, ZOMBIE_RADIUS,
} from "../core/constants";
import { soldierOffsets } from "../core/formation";
import type { GameState, Gate } from "../core/types";

export type Viewport = { width: number; height: number };

export function gateLabel(gate: Pick<Gate, "op" | "value">): string {
  switch (gate.op) {
    case "add": return `+${gate.value}`;
    case "sub": return `${gate.value}`;
    case "mul": return `x${gate.value}`;
  }
}

const GATE_COLORS = { bullet: "rgba(255, 190, 60, 0.45)", squad: "rgba(80, 170, 255, 0.45)" };

export function draw(ctx: CanvasRenderingContext2D, state: GameState, viewport: Viewport): void {
  const scale = Math.min(viewport.width / WORLD_WIDTH, viewport.height / WORLD_HEIGHT);

  ctx.save();
  ctx.fillStyle = "#14161c";
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  ctx.translate((viewport.width - WORLD_WIDTH * scale) / 2, (viewport.height - WORLD_HEIGHT * scale) / 2);
  ctx.scale(scale, scale);

  drawFinishLine(ctx, state);
  drawGates(ctx, state);
  drawZombies(ctx, state);
  drawBullets(ctx, state);
  drawSquad(ctx, state);
  if (state.status !== "playing") drawOverlay(ctx, state);

  ctx.restore();
}

function drawFinishLine(ctx: CanvasRenderingContext2D, state: GameState): void {
  const y = SQUAD_Y - (state.stage.length - state.stage.scrollY);
  if (y < 0 || y > WORLD_HEIGHT) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, y - 2, WORLD_WIDTH, 4);
}

function drawGates(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 20px sans-serif";
  for (const gate of state.gates) {
    ctx.fillStyle = GATE_COLORS[gate.kind];
    ctx.fillRect(gate.x - gate.width / 2, gate.y - GATE_HEIGHT / 2, gate.width, GATE_HEIGHT);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(gateLabel(gate), gate.x, gate.y);
  }
}

function drawZombies(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = "#58a04a";
  for (const z of state.zombies) {
    ctx.fillRect(z.x - ZOMBIE_RADIUS, z.y - ZOMBIE_RADIUS, ZOMBIE_RADIUS * 2, ZOMBIE_RADIUS * 2);
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = "#ffe066";
  for (const b of state.bullets) ctx.fillRect(b.x - 1.5, b.y - 5, 3, 10);
}

function drawSquad(ctx: CanvasRenderingContext2D, state: GameState): void {
  const visible = Math.min(state.squad.count, MAX_VISIBLE);
  ctx.fillStyle = "#e8e8f0";
  for (const { dx, dy } of soldierOffsets(visible)) {
    ctx.beginPath();
    ctx.arc(state.squad.x + dx, SQUAD_Y + dy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${state.squad.count}`, state.squad.x, SQUAD_Y - 24);
}

function drawOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText(state.status === "won" ? "YOU WIN" : "GAME OVER", WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 20);
  ctx.font = "18px sans-serif";
  ctx.fillText("Tap or press any key to restart", WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 24);
}
