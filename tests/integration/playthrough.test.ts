import { describe, expect, it } from 'vitest';
import { createGameEngine } from '@/engine/core/engine';
import { createNewGame } from '@/engine/core/newGame';
import { playthrough } from '../helpers/bot';
import { testData } from '../helpers/gameData';

const SEEDS = [1, 2, 3, 7, 42, 99, 1234];
/** Horná hranica dní pre bota s jednou stavebnou akciou denne (bot dnes potrebuje ~330–370). */
const MAX_DAYS = 500;

describe('hrateľnosť (test F)', () => {
  it.each(SEEDS)(
    'na mape so seedom %i sa dajú splniť všetky míľniky bez vývojárskych nástrojov',
    (seed) => {
      const engine = createGameEngine(
        testData,
        createNewGame(testData, { seed, gameId: 'f', now: 'x' }),
      );
      const result = playthrough(engine, testData, MAX_DAYS);

      expect(Object.keys(result.completedAt)).toEqual(testData.milestones.map((m) => m.id));
      // Míľniky sa plnia v poradí a v rozumnom tempe.
      const days = testData.milestones.map((m) => result.completedAt[m.id]!);
      expect([...days].sort((a, b) => a - b)).toEqual(days);
      expect(days[0]).toBeGreaterThan(15);
      expect(days.at(-1)).toBeLessThanOrEqual(MAX_DAYS);
    },
  );
});
