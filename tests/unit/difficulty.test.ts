import { describe, expect, it } from 'vitest';
import { createGameEngine } from '@/engine/core/engine';
import { buildCostAtLevel, scaleAmount } from '@/engine/core/levels';
import { createNewGame } from '@/engine/core/newGame';
import { maintenanceMultiplier } from '@/engine/economy/modifiers';
import type { DifficultyId } from '@/types';
import { createTestCity, setCity } from '../helpers/fixtures';
import { def, economyTestData, testData } from '../helpers/gameData';

// Očakávania sú literály z tabuľky presetov (Ťažká: ceny ×1,5, jedlo ×1,25, zber ×0, refund ×0,5).
describe('obtiažnosť', () => {
  it('zaokrúhľuje škálované ceny nahor bez chyby plávajúcej čiarky', () => {
    expect(scaleAmount(5, 0.8)).toBe(4);
    expect(scaleAmount(5, 1.5)).toBe(8);
    expect(scaleAmount(10, 1)).toBe(10);
  });

  it('nová hra je bez voľby normálna, inak podľa voľby', () => {
    const options = { seed: 1, gameId: 'g', now: '2026-01-01T00:00:00.000Z' };
    expect(createNewGame(testData, options).difficulty).toBe('normal');
    expect(createNewGame(testData, { ...options, difficulty: 'hard' }).difficulty).toBe('hard');
  });

  it('na Ťažkej stojí dom o polovicu viac a zbúranie vráti 25 %', () => {
    const engine = createTestCity({ difficulty: 'hard', resources: { wood: 100 } });
    expect(
      engine.execute({ type: 'PLACE_BUILDING', buildingId: 'house', position: { x: 3, y: 3 } }),
    ).toEqual({ success: true });
    expect(engine.getState().city.economy.resources.wood).toBe(85);

    const id = engine.getState().city.buildings.at(-1)!.id;
    expect(engine.execute({ type: 'DEMOLISH_BUILDING', instanceId: id })).toEqual({
      success: true,
    });
    expect(engine.getState().city.economy.resources.wood).toBe(88);
  });

  it('na Ťažkej je údržba ×1,5', () => {
    const engine = createTestCity({ difficulty: 'hard' });
    expect(maintenanceMultiplier(engine.getState(), economyTestData)).toBe(1.5);
  });

  it('na Ťažkej nie je základný zber', () => {
    const dailyWood = (difficulty: DifficultyId) => {
      const engine = createGameEngine(testData, createTestCity({ difficulty }).serialize());
      engine.tick();
      return engine.getState().city.economy.dailyProduction.wood;
    };
    expect(dailyWood('hard')).toBeUndefined();
    expect(dailyWood('normal')).toBe(1);
  });

  it('na Ťažkej zje obyvateľ 0,3125 jedla denne', () => {
    const engine = createTestCity({ difficulty: 'hard', population: 10, resources: { food: 100 } });
    engine.tick();
    expect(engine.getState().city.economy.dailyConsumption.food).toBeCloseTo(3.125);
  });

  it('na Ťažkej stojí výskum o polovicu viac', () => {
    // Opracovanie dreva stojí nominálne 20 vedomostí → na Ťažkej 30.
    const engine = createTestCity({ difficulty: 'hard', resources: { knowledge: 20, food: 100 } });
    engine.execute({ type: 'START_RESEARCH', technologyId: 'woodworking' });
    engine.tick();
    expect(engine.getState().research.activeTechnologyId).toBe('woodworking');

    setCity(engine, { resources: { knowledge: 10, food: 100 } });
    engine.tick();
    expect(engine.getState().research.completedTechnologyIds).toContain('woodworking');
  });

  it('stavba rovno na vyššej úrovni stojí ako stavba s postupnými vylepšeniami', () => {
    // Ľahká ×0,75, každá časť zaokrúhlená zvlášť: kameň 15 → 12 a 25 → 19 (spolu 31, nie 30).
    expect(buildCostAtLevel(def('house'), 3, 0.75)).toEqual({ wood: 23, stone: 31, tools: 9 });
  });
});
