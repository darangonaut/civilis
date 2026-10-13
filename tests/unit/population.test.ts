import { describe, expect, it } from 'vitest';
import type { CivilisEngine } from '@/engine/core/engine';
import { build, createTestCity, setCity } from '../helpers/fixtures';

const population = (engine: CivilisEngine) => engine.getState().city.population;

/** Mesto s domami pri ceste (y = 3) — kapacita 10 na dom. */
function cityWithHouses(houses: number, options: Parameters<typeof createTestCity>[0] = {}) {
  const engine = createTestCity({ resources: { food: 1000 }, ...options });
  for (let i = 0; i < houses; i++) build(engine, 'house', { x: 2 + i, y: 3 });
  return engine;
}

describe('spokojnosť', () => {
  it('zložky: potraviny, bývanie, voda, vzdelanie', () => {
    const engine = cityWithHouses(2, { population: 10 });
    engine.tick();
    // 10 z 20 miest obsadených = 50 % voľných ≥ 10 % → bývanie 100.
    expect(population(engine).happinessFactors).toEqual({
      food: 100,
      housing: 100,
      water: 0,
      education: 0,
    });
  });

  it('studňa pokryje domy vo svojom dosahu (podiel kapacity)', () => {
    const engine = cityWithHouses(0, { width: 24, population: 10 });
    build(engine, 'house', { x: 2, y: 3 });
    build(engine, 'house', { x: 20, y: 3 });
    build(engine, 'well', { x: 2, y: 5 });
    engine.tick();
    expect(population(engine).happinessFactors.water).toBe(50);
  });

  it('škola poskytuje vzdelanie len s pracovníkmi', () => {
    const engine = cityWithHouses(1, { population: 1 });
    build(engine, 'school', { x: 4, y: 3 });
    engine.tick();
    expect(population(engine).happinessFactors.education).toBe(0);
    setCity(engine, { population: 6 });
    engine.tick();
    expect(population(engine).happinessFactors.education).toBe(100);
  });

  it('plne obsadené bývanie dá zložku 0, pri 5 % voľných 50', () => {
    const engine = cityWithHouses(2, { population: 20 });
    engine.tick();
    expect(population(engine).happinessFactors.housing).toBe(0);
    setCity(engine, { population: 19 });
    engine.tick();
    expect(population(engine).happinessFactors.housing).toBe(50);
  });

  it('hlad zníži zložku potravín pomerne', () => {
    const engine = cityWithHouses(2, { population: 10, resources: { food: 1.25 } });
    engine.tick();
    expect(population(engine).happinessFactors.food).toBe(50);
    expect(engine.takeEvents()).toContainEqual({ type: 'food_shortage' });
  });

  it('spokojnosť sa k cieľu posúva najviac o 5 bodov denne', () => {
    // Bez studne a školy: cieľ = 40 + 25 = 65.
    const engine = cityWithHouses(2, { population: 10 });
    setCity(engine, { happiness: 50 });
    engine.tick();
    expect(population(engine).happiness).toBe(55);
    engine.tick();
    engine.tick();
    expect(population(engine).happiness).toBe(65);
    engine.tick();
    expect(population(engine).happiness).toBe(65);
  });
});

describe('populácia', () => {
  it('pri spokojnosti ≥ 60, voľnom bývaní a jedle rastie', () => {
    const engine = cityWithHouses(4, { population: 10 });
    setCity(engine, { happiness: 80 });
    engine.tick();
    expect(population(engine).total).toBe(11);
    expect(engine.takeEvents()).toContainEqual({ type: 'population_changed', delta: 1 });
  });

  it('rast je 5 % populácie a neprekročí kapacitu bývania', () => {
    const engine = cityWithHouses(5, { population: 45 });
    setCity(engine, { happiness: 100 });
    engine.tick();
    expect(population(engine).total).toBe(47);
    for (let i = 0; i < 10; i++) engine.tick();
    expect(population(engine).total).toBe(50);
  });

  it('bez jedla nerastie', () => {
    const engine = cityWithHouses(4, { population: 10, resources: { food: 0 } });
    setCity(engine, { happiness: 80 });
    engine.tick();
    expect(population(engine).total).toBe(10);
  });

  it('pri spokojnosti 40–59 stagnuje', () => {
    const engine = cityWithHouses(4, { population: 10 });
    setCity(engine, { happiness: 50, resources: { food: 0 } });
    engine.tick();
    expect(population(engine).total).toBe(10);
  });

  it('pri spokojnosti pod 40 klesá, ale nikdy pod 5', () => {
    const engine = cityWithHouses(10, { population: 100, resources: { food: 0 } });
    setCity(engine, { happiness: 10 });
    engine.tick();
    expect(population(engine).total).toBe(97);
    for (let i = 0; i < 300; i++) engine.tick();
    expect(population(engine).total).toBe(5);
  });

  it('obyvatelia bez bývania odchádzajú', () => {
    const engine = cityWithHouses(1, { population: 30 });
    setCity(engine, { happiness: 80 });
    engine.tick();
    expect(population(engine).total).toBe(20);
    engine.tick();
    expect(population(engine).total).toBe(15);
  });

  it('rast populácie zvýši počet pracovníkov', () => {
    const engine = cityWithHouses(4, { population: 10 });
    setCity(engine, { happiness: 80 });
    for (let i = 0; i < 3; i++) engine.tick();
    expect(population(engine).total).toBe(13);
    expect(population(engine).availableWorkers).toBe(6);
  });
});
