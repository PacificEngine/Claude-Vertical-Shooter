import type { ActivePowerKind, PowerKind } from "./types";

export const WORLD_WIDTH = 400;
export const WORLD_HEIGHT = 700;
export const SQUAD_Y = 620;
export const SQUAD_SPEED = 300; // units per second toward the target
export const SQUAD_HALF_WIDTH = 20;
export const SQUAD_REACH = 10; // zombies this close above SQUAD_Y hit the squad
export const INITIAL_SQUAD = 6;
export const SCROLL_SPEED = 60; // units per second
export const BULLET_SPEED = 600;
export const BULLET_MARGIN = 20; // bullets are culled this far above the screen
export const FIRE_INTERVAL = 0.25; // seconds
export const BASE_DAMAGE = 1;
export const MAX_VISIBLE = 30;
export const MAX_BULLETS = 500;
export const MAX_ZOMBIES = 200;
export const SPAWN_Y = -20;
export const ZOMBIE_STAGGER = 16; // vertical gap between wave zombies
export const ZOMBIE_RADIUS = 12;
export const GATE_HEIGHT = 30;
export const SOLDIER_SPACING = 14;
export const KEY_SPEED = 300; // keyboard nudge, units per second
export const TICK = 1 / 60;
export const MAX_FRAME_SECONDS = 0.25;

export const POWER_KINDS: readonly PowerKind[] = ["tank", "spread", "shield", "rapid", "pierce", "bomb"];
export const POWER_DURATION: Record<ActivePowerKind, number> = {
  tank: 8, spread: 10, shield: 10, rapid: 8, pierce: 8,
};
export const SHIELD_CHARGES = 5;
export const BOMB_DAMAGE = 10;
export const TANK_DAMAGE_MULT = 2;
export const TANK_RATE_MULT = 3; // tank fires this many times slower
export const TANK_SPLASH = 40;
export const RAPID_RATE_MULT = 0.5; // rapid fires twice as often
export const SPREAD_VX = 160; // about 15 degrees at BULLET_SPEED
export const CRATE_SIZE = 28;
export const PICKUP_SIZE = 24;
