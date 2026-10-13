import { describe, expect, it } from 'vitest';
import { createGameEngine } from '@/engine/core/engine';
import { createNewGame } from '@/engine/core/newGame';
import { validatePlacement } from '@/engine/core/commands';
import { createRng } from '@/engine/core/random';
import type { GameCommand, GameEngine } from '@/types';
import { testData } from '../helpers/gameData';

const BUILDINGS = [
  'road',
  'road',
  'road',
  'house',
  'farm',
  'lumberjack',
  'quarry',
  'well',
  'workshop',
  'market',
];

/**
 * Pseudonáhodný, ale reprodukovateľný „hráč“: každých pár dní skúsi postaviť budovu
 * v okolí štartu. Rovnaký seed hráča = rovnaká sekvencia príkazov.
 */
function playScriptedGame(seed: number, days: number): GameEngine {
  const state = createNewGame(testData, { seed, gameId: 'det', now: '2026-01-01T00:00:00.000Z' });
  const engine = createGameEngine(testData, state);
  const rng = createRng(seed * 31 + 7);
  for (let day = 0; day < days; day++) {
    if (day % 3 === 0) {
      const buildingId = BUILDINGS[Math.floor(rng() * BUILDINGS.length)]!;
      const position = { x: 26 + Math.floor(rng() * 12), y: 26 + Math.floor(rng() * 12) };
      const command: GameCommand = { type: 'PLACE_BUILDING', buildingId, position };
      if (validatePlacement(engine.getState(), testData, buildingId, position).success)
        engine.execute(command);
    }
    engine.tick();
  }
  return engine;
}

describe('deterministická simulácia (test A)', () => {
  it('rovnaký seed a príkazy dajú po 1 000 krokoch identický stav', () => {
    const a = playScriptedGame(42, 1000).serialize();
    const b = playScriptedGame(42, 1000).serialize();
    expect(a.simulation.day).toBe(1000);
    expect(a.city.buildings.length).toBeGreaterThan(5);
    expect(a).toEqual(b);
  });

  it('iný seed dá iný výsledok', () => {
    const a = playScriptedGame(1, 100).serialize();
    const b = playScriptedGame(2, 100).serialize();
    expect(a).not.toEqual(b);
  });
});
