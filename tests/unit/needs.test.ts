import { describe, expect, it } from 'vitest';
import { effectiveDefinition } from '@/engine/core/levels';
import { build, createTestCity, setCity } from '../helpers/fixtures';
import { def, economyTestData } from '../helpers/gameData';

const balance = economyTestData.balance;

/** Mesto s jedným mrakodrapom (úroveň 8 potrebuje látky, uhlie, elektrinu a nástroje). */
function cityWithSkyscraper(resources: Record<string, number>) {
  const engine = createTestCity({ population: 80, resources: { food: 1000, ...resources } });
  const id = build(engine, 'house', { x: 3, y: 3 });
  const state = engine.serialize();
  state.city.buildings.find((b) => b.id === id)!.level = 8;
  engine.load(state);
  return { engine, id };
}

describe('potreby obyvateľov', () => {
  it('lepšie domy majú potreby, ktoré sa dedia na ďalšie úrovne', () => {
    const house = def('house');
    expect(effectiveDefinition(house, 1).needs).toBeUndefined();
    expect(effectiveDefinition(house, 8).needs).toMatchObject({ electricity: expect.any(Number) });
    expect(effectiveDefinition(house, 7).needs).toMatchObject({ coal: expect.any(Number) });
    expect(effectiveDefinition(house, 10).needs).toMatchObject({
      cloth: expect.any(Number),
      tools: expect.any(Number),
    });
  });

  it('obyvatelia spotrebujú tovar zo skladu a pri dostatku je zložka tovar 100', () => {
    const { engine } = cityWithSkyscraper({ cloth: 100, coal: 100, electricity: 100, tools: 100 });
    engine.tick();
    const state = engine.getState();
    expect(state.city.economy.resources.electricity).toBeLessThan(100);
    expect(state.city.economy.dailyConsumption.electricity).toBeGreaterThan(0);
    expect(state.city.population.happinessFactors.goods).toBe(100);
  });

  it('bez tovaru klesá zložka tovar a dom po čase klesne o úroveň', () => {
    const { engine, id } = cityWithSkyscraper({});
    engine.tick();
    expect(engine.getState().city.population.happinessFactors.goods).toBe(0);
    const building = () => engine.getState().city.buildings.find((b) => b.id === id)!;
    expect(building().neglect).toBe(1);
    const limit = balance.needs.downgradeDays + balance.needs.downgradeSpread;
    for (let i = 0; i < limit; i++) {
      setCity(engine, { population: 80, resources: { food: 1000 } });
      engine.tick();
    }
    expect(building().level).toBe(7);
  });
});

describe('znečistenie', () => {
  it('pracujúca dielňa pri dome zníži zložku prostredia, park ju vyčistí', () => {
    const engine = createTestCity({
      width: 20,
      population: 15,
      resources: { wood: 500, stone: 500, food: 1000 },
    });
    build(engine, 'house', { x: 3, y: 3 });
    build(engine, 'house', { x: 12, y: 3 });
    build(engine, 'workshop', { x: 4, y: 3 });
    engine.tick();
    expect(engine.getState().city.population.happinessFactors.environment).toBe(50);
    build(engine, 'park', { x: 3, y: 4 });
    engine.tick();
    expect(engine.getState().city.population.happinessFactors.environment).toBe(100);
  });
});
