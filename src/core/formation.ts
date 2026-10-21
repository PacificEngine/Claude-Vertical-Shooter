import { SOLDIER_SPACING } from "./constants";

export function soldierOffsets(visible: number): { dx: number; dy: number }[] {
  const columns = Math.ceil(Math.sqrt(visible));
  return Array.from({ length: visible }, (_, i) => {
    const row = Math.floor(i / columns);
    const column = i % columns;
    const inRow = Math.min(columns, visible - row * columns);
    return { dx: (column - (inRow - 1) / 2) * SOLDIER_SPACING, dy: row * SOLDIER_SPACING };
  });
}
