// mulberry32: a tiny seeded PRNG. The whole generator state is one number,
// so it can live inside GameState and keep runs replayable.
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}
