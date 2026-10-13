/**
 * Deterministická náhodnosť. Používa iba celočíselné operácie (Math.imul, bitové posuny),
 * takže výsledky sú rovnaké vo všetkých prehliadačoch.
 */

/** Normalizuje ľubovoľné číslo na uint32 seed. */
export function normalizeSeed(seed: number): number {
  return Math.trunc(seed) >>> 0 || 1;
}

/** Mulberry32 — rýchly 32-bitový PRNG. Vracia čísla v intervale [0, 1). */
export function createRng(seed: number): () => number {
  let state = normalizeSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bezstavový hash dvojice súradníc a seedu do intervalu [0, 1). */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ normalizeSeed(seed);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Celé číslo v intervale [min, max]. */
export function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
