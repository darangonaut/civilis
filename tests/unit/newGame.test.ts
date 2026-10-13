import { describe, expect, it } from 'vitest';
import { createNewGame } from '@/engine/core/newGame';
import { getTile } from '@/engine/world/grid';
import { testData } from '../helpers/gameData';

const newGame = (seed = 42) =>
  createNewGame(testData, { seed, gameId: 'test', now: '2026-01-01T00:00:00.000Z' });

describe('nová hra', () => {
  it('má počiatočný stav zo špecifikácie 2.1', () => {
    const state = newGame();
    expect(state.city.population.total).toBe(10);
    expect(state.city.population.housingCapacity).toBe(10);
    expect(state.city.population.availableWorkers).toBe(5);
    expect(state.city.population.happiness).toBe(70);
    expect(state.city.economy.resources).toEqual({
      food: 100,
      wood: 80,
      stone: 30,
      tools: 10,
      knowledge: 0,
      bricks: 0,
      iron: 0,
    });
    expect(state.city.economy.money).toBe(500);
    expect(state.simulation.day).toBe(0);
    expect(state.world.width).toBe(64);
  });

  it('obsahuje dom, sklad a prístupovú cestu', () => {
    const state = newGame();
    const count = (id: string) => state.city.buildings.filter((b) => b.definitionId === id).length;
    expect(count('house')).toBe(1);
    expect(count('warehouse')).toBe(1);
    expect(count('road')).toBeGreaterThan(0);
    expect(state.city.economy.storageCapacity).toBe(300);
  });

  it('políčka odkazujú na budovy, ktoré na nich stoja', () => {
    const state = newGame();
    for (const building of state.city.buildings) {
      expect(getTile(state.world, building.position.x, building.position.y)!.buildingId).toBe(
        building.id,
      );
    }
    const occupied = state.world.tiles.filter((t) => t.buildingId !== undefined);
    expect(occupied).toHaveLength(state.city.buildings.length);
  });

  it('dom a sklad susedia s cestou', () => {
    const state = newGame();
    const roads = state.city.buildings.filter((b) => b.definitionId === 'road');
    for (const building of state.city.buildings.filter((b) => b.definitionId !== 'road')) {
      const adjacent = roads.some(
        (r) =>
          Math.abs(r.position.x - building.position.x) +
            Math.abs(r.position.y - building.position.y) ===
          1,
      );
      expect(adjacent, building.definitionId).toBe(true);
    }
  });

  it('je deterministická pre rovnaký seed', () => {
    expect(newGame(7)).toEqual(newGame(7));
  });
});
