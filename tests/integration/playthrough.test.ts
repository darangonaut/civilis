import { describe, expect, it } from 'vitest';
import { createGameEngine } from '@/engine/core/engine';
import { createNewGame } from '@/engine/core/newGame';
import { playthrough } from '../helpers/bot';
import { testData } from '../helpers/gameData';

/**
 * Test F — hrateľnosť. Simulovaný hráč (2 stavebné akcie denne, iba herné príkazy) musí
 * splniť míľniky v poradí. Rýchla verzia overuje prvé tri éry na viacerých mapách; celú hru
 * (8 ér, ~2 300–2 800 dní) spúšťa `npm run test:full`.
 */
function play(seed: number, eraCount: number, maxDays: number) {
  const eraIds = testData.eras.slice(0, eraCount).map((e) => e.id);
  const milestones = testData.milestones.filter((m) => eraIds.includes(m.era));
  const engine = createGameEngine(
    testData,
    createNewGame(testData, { seed, gameId: 'f', now: 'x' }),
  );
  const result = playthrough(engine, testData, maxDays, milestones.at(-1)!.id);
  const days = milestones.map((m) => result.completedAt[m.id]);
  expect(
    days.every((d) => d !== undefined),
    JSON.stringify(result.completedAt),
  ).toBe(true);
  expect([...days].sort((a, b) => a! - b!)).toEqual(days);
  expect(days[0]).toBeGreaterThan(15);
  return days as number[];
}

describe('hrateľnosť (test F)', () => {
  it.each([1, 7, 42, 1234])(
    'na mape %i sa dajú prejsť prvé tri éry',
    (seed) => {
      const days = play(seed, 3, 1200);
      expect(days.at(-1)).toBeLessThan(1200);
    },
    60_000,
  );

  it.skipIf(!import.meta.env.CIVILIS_FULL)(
    'na mape 7 sa dá prejsť všetkých 8 ér',
    () => {
      const days = play(7, testData.eras.length, 4000);
      expect(days.at(-1)).toBeLessThan(4000);
    },
    900_000,
  );
});
