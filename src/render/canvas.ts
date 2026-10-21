import {
  CRATE_SIZE, GATE_HEIGHT, MAX_VISIBLE, PICKUP_SIZE, POWER_DURATION, SQUAD_Y, WORLD_HEIGHT, WORLD_WIDTH, ZOMBIE_RADIUS,
} from "../core/constants";
import { soldierOffsets } from "../core/formation";
import type { GameState, Gate, PowerKind } from "../core/types";

export type Viewport = { width: number; height: number };

export function gateLabel(gate: Pick<Gate, "op" | "value">): string {
  switch (gate.op) {
    case "add": return `+${gate.value}`;
    case "sub": return `${gate.value}`;
    case "mul": return `x${gate.value}`;
  }
}

const LABELS: Record<PowerKind, string> = {
  tank: "TANK", spread: "SPRD", shield: "SHLD", rapid: "RAPD", pierce: "PRCE", bomb: "BOMB",
};
export const powerLabel = (kind: PowerKind): string => LABELS[kind];

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
  drawCrates(ctx, state);
  drawPickups(ctx, state);
  drawZombies(ctx, state);
  drawBullets(ctx, state);
  drawSquad(ctx, state);
  drawHud(ctx, state);
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

function drawCrates(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 10px sans-serif";
  for (const c of state.crates) {
    ctx.fillStyle = "#8a5a2b";
    ctx.fillRect(c.x - CRATE_SIZE / 2, c.y - CRATE_SIZE / 2, CRATE_SIZE, CRATE_SIZE);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(powerLabel(c.power), c.x, c.y - 5);
    ctx.fillText(`${c.hp}`, c.x, c.y + 7);
  }
}

function drawPickups(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 10px sans-serif";
  for (const p of state.pickups) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#4de08a";
    ctx.fillRect(-PICKUP_SIZE / 3, -PICKUP_SIZE / 3, (PICKUP_SIZE * 2) / 3, (PICKUP_SIZE * 2) / 3);
    ctx.restore();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(powerLabel(p.power), p.x, p.y + PICKUP_SIZE / 2 + 8);
  }
}

function drawZombies(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = "#58a04a";
  for (const z of state.zombies) {
    ctx.fillRect(z.x - ZOMBIE_RADIUS, z.y - ZOMBIE_RADIUS, ZOMBIE_RADIUS * 2, ZOMBIE_RADIUS * 2);
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const b of state.bullets) {
    if (b.splash > 0) {
      ctx.fillStyle = "#ff9a3c";
      ctx.fillRect(b.x - 4, b.y - 8, 8, 16);
    } else {
      ctx.fillStyle = b.pierce ? "#7fe0ff" : "#ffe066";
      ctx.fillRect(b.x - 1.5, b.y - 5, 3, 10);
    }
  }
}

function drawSquad(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.power?.kind === "tank") {
    ctx.fillStyle = "#8fa37a";
    ctx.fillRect(state.squad.x - 22, SQUAD_Y - 8, 44, 24);
    ctx.fillRect(state.squad.x - 4, SQUAD_Y - 30, 8, 26);
  } else {
    const visible = Math.min(state.squad.count, MAX_VISIBLE);
    ctx.fillStyle = "#e8e8f0";
    for (const { dx, dy } of soldierOffsets(visible)) {
      ctx.beginPath();
      ctx.arc(state.squad.x + dx, SQUAD_Y + dy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (state.power?.kind === "shield") {
    ctx.strokeStyle = "#7fe0ff";
    ctx.strokeRect(state.squad.x - 40, SQUAD_Y - 36, 80, 62);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${state.squad.count}`, state.squad.x, SQUAD_Y - 24);
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const power = state.power;
  if (!power) return;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(powerLabel(power.kind), 10, 10);
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.fillRect(10, 30, 100, 6);
  ctx.fillStyle = "#4de08a";
  ctx.fillRect(10, 30, (power.remaining / POWER_DURATION[power.kind]) * 100, 6);
  if (power.kind === "shield") {
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${power.charges} left`, 10, 42);
  }
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
