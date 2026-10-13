import { describe, expect, it } from 'vitest';
import { createGameEngine } from '@/engine/core/engine';
import type { GameState, Tile } from '@/types';
import { zeroResources } from '../helpers/fixtures';
import { testData } from '../helpers/gameData';
import { createNewGame } from '@/engine/core/newGame';

/**
 * 64 × 64 mapa s 500 budovami: každý druhý riadok cesta, medzi nimi výrobné budovy a domy.
 * Budovy sa vkladajú priamo do stavu, aby test meral iba tick.
 */
function buildDenseCity(): GameState {
  const state = createNewGame(testData, {
    seed: 1,
    gameId: 'perf',
    now: '2026-01-01T00:00:00.000Z',
  });
  const { width } = state.world;
  state.world.tiles = state.world.tiles.map((): Tile => ({ terrain: 'fertile', fertility: 90 }));
  state.city.buildings = [];
  let n = 0;
  const place = (definitionId: string, x: number, y: number) => {
    const id = `b${++n}`;
    state.city.buildings.push({
      id,
      definitionId,
      position: { x, y },
      enabled: true,
      priority: 2,
      level: 1,
    });
    state.world.tiles[y * width + x]!.buildingId = id;
  };
  place('warehouse', 0, 0);
  const kinds = ['house', 'farm', 'house', 'workshop', 'house', 'market', 'school'];
  for (let y = 1; n < 500 && y < 64; y += 2) {
    for (let x = 0; x < 64 && n < 500; x++) place('road', x, y);
    for (let x = 0; x < 64 && n < 500; x++) place(kinds[(x + y) % kinds.length]!, x, y + 1);
  }
  state.city.population.total = 2000;
  state.city.economy.resources = {
    ...zeroResources(),
    food: 200,
    wood: 200,
    stone: 200,
    tools: 200,
  };
  state.city.economy.money = 1e6;
  return state;
}

describe('výkon', () => {
  it('tick s 500 budovami na mape 64 × 64 trvá menej ako 20 ms', () => {
    const state = buildDenseCity();
    expect(state.city.buildings).toHaveLength(500);
    const engine = createGameEngine(testData, state);
    for (let i = 0; i < 10; i++) engine.tick(); // zahriatie JIT
    const ticks = 100;
    const start = performance.now();
    for (let i = 0; i < ticks; i++) engine.tick();
    const average = (performance.now() - start) / ticks;
    console.info(`Priemerný tick: ${average.toFixed(2)} ms`);
    expect(average).toBeLessThan(20);
  });
});
