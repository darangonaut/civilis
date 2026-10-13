import { describe, expect, it } from 'vitest';
import { createRng, hash2, randomInt } from '@/engine/core/random';

describe('seeded PRNG', () => {
  it('rovnaký seed dá rovnakú sekvenciu', () => {
    const a = createRng(123);
    const b = createRng(123);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('rôzne seedy dajú rôzne sekvencie', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it('vracia hodnoty v [0, 1) a randomInt v rozsahu', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = randomInt(rng, -3, 3);
      expect(n).toBeGreaterThanOrEqual(-3);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it('hash2 je deterministický a závisí od všetkých vstupov', () => {
    expect(hash2(3, 4, 5)).toBe(hash2(3, 4, 5));
    expect(hash2(3, 4, 5)).not.toBe(hash2(4, 3, 5));
    expect(hash2(3, 4, 5)).not.toBe(hash2(3, 4, 6));
  });
});
