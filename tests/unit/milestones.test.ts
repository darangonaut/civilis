import { describe, expect, it } from 'vitest';
import type { CivilisEngine } from '@/engine/core/engine';
import { build, createTestCity, setCity } from '../helpers/fixtures';

const milestones = (engine: CivilisEngine) => engine.getState().milestones;
const fertileRow = (_x: number, y: number) => (y === 3 ? ('fertile' as const) : ('grass' as const));

/** Mesto, ktoré splní podmienky prvého míľnika okrem počtu obyvateľov. */
function firstMilestoneCity() {
  const engine = createTestCity({
    width: 24,
    terrain: (x, y) => (y === 3 && x === 10 ? 'forest' : fertileRow(x, y)),
    population: 10,
    resources: { food: 1000, tools: 100 },
    money: 100,
  });
  for (let x = 2; x < 6; x++) build(engine, 'house', { x, y: 1 });
  build(engine, 'farm', { x: 8, y: 3 });
  build(engine, 'lumberjack', { x: 10, y: 3 });
  return engine;
}

describe('civilizačné míľniky (test E)', () => {
  it('míľnik sa splní až po splnení všetkých podmienok', () => {
    const engine = firstMilestoneCity();
    // Spokojnosť 50 = stagnácia, populácia za deň nedorastie na 20.
    setCity(engine, { population: 19, happiness: 50 });
    engine.tick();
    expect(engine.getState().city.population.total).toBe(19);
    expect(milestones(engine).completedIds).toEqual([]);

    setCity(engine, { population: 20 });
    engine.tick();
    expect(milestones(engine).completedIds).toEqual(['settlement_founded']);
    expect(engine.takeEvents()).toContainEqual({
      type: 'milestone_completed',
      milestoneId: 'settlement_founded',
    });
  });

  it('chýbajúca budova bráni splneniu', () => {
    const engine = createTestCity({ population: 20, resources: { food: 1000 } });
    for (let x = 2; x < 6; x++) build(engine, 'house', { x, y: 1 });
    engine.tick();
    expect(milestones(engine).completedIds).toEqual([]);
  });

  it('odmena sa pripíše presne raz', () => {
    const engine = firstMilestoneCity();
    setCity(engine, { population: 20, money: 1000 });
    engine.tick();
    const economy = engine.getState().city.economy;
    // 1000 − údržba (sklad 1 + farma 1 + drevorubač 1) + odmena 100.
    expect(economy.money).toBe(1000 - 3 + 100);
    for (let i = 0; i < 5; i++) engine.tick();
    expect(engine.getState().city.economy.money).toBe(1097 - 5 * 3);
    expect(milestones(engine).completedIds).toEqual(['settlement_founded']);
  });

  it('míľniky sa plnia v poradí — tretí sa nesplní pred druhým', () => {
    const engine = createTestCity({ population: 20, resources: { food: 1000 } });
    build(engine, 'school', { x: 3, y: 3 });
    setCity(engine, { completedTechnologyIds: ['woodworking', 'irrigation', 'masonry'] });
    engine.tick();
    expect(milestones(engine).completedIds).toEqual([]);
  });

  it('dlhodobá podmienka vyžaduje po sebe idúce dni a pri prerušení sa nuluje', () => {
    // Druhý míľnik: 40 obyvateľov, kladná bilancia potravín 10 dní, spokojnosť ≥ 60.
    const engine = createTestCity({
      terrain: fertileRow,
      population: 40,
      resources: { food: 200, tools: 100 },
      money: 1000,
    });
    for (let x = 2; x < 8; x++) build(engine, 'house', { x, y: 1 });
    for (let x = 2; x < 8; x++) build(engine, 'farm', { x, y: 3 });
    for (let x = 8; x < 12; x++) build(engine, 'well', { x, y: 1 });
    const state = engine.serialize();
    state.milestones.completedIds = ['settlement_founded'];
    state.city.population.happiness = 80;
    engine.load(state);

    const key = 'self_sufficient_village:1';
    for (let i = 0; i < 9; i++) engine.tick();
    expect(milestones(engine).progressDays[key]).toBe(9);
    expect(milestones(engine).completedIds).toEqual(['settlement_founded']);

    // Hlad: bilancia potravín záporná → počítadlo sa vynuluje.
    const hungry = engine.serialize();
    hungry.city.population.total = 400;
    engine.load(hungry);
    engine.tick();
    expect(milestones(engine).progressDays[key]).toBe(0);

    const fed = engine.serialize();
    fed.city.population.total = 40;
    fed.city.population.happiness = 80;
    engine.load(fed);
    for (let i = 0; i < 9; i++) engine.tick();
    expect(milestones(engine).completedIds).toEqual(['settlement_founded']);
    engine.tick();
    expect(milestones(engine).completedIds).toEqual([
      'settlement_founded',
      'self_sufficient_village',
    ]);
    // Odmena: 20 dreva a 20 kameňa.
    expect(engine.getState().city.economy.resources.wood).toBe(20);
    expect(engine.getState().city.economy.resources.stone).toBe(20);
    expect(milestones(engine).progressDays[key]).toBeUndefined();
  });

  it('po poslednom míľniku sa už nič nevyhodnocuje', () => {
    const engine = createTestCity({ population: 10 });
    const state = engine.serialize();
    state.milestones.completedIds = [
      'settlement_founded',
      'self_sufficient_village',
      'educated_society',
      'prosperous_town',
      'birth_of_civilization',
    ];
    engine.load(state);
    engine.tick();
    expect(engine.takeEvents().filter((e) => e.type === 'milestone_completed')).toEqual([]);
  });
});

describe('priebeh podmienok pre UI', () => {
  it('vracia aktuálnu hodnotu, cieľ a dni', async () => {
    const { conditionProgress } = await import('@/engine/milestones/milestones');
    const { testData } = await import('../helpers/gameData');
    const engine = createTestCity({ population: 12 });
    const state = engine.getState();
    const [population] = testData.milestones[0]!.conditions;
    expect(conditionProgress(state, testData, 'settlement_founded', 0, population!)).toEqual({
      current: 12,
      target: 20,
      metToday: false,
      days: 0,
      requiredDays: 1,
    });

    const snapshot = engine.serialize();
    snapshot.milestones.progressDays['self_sufficient_village:1'] = 4;
    const balance = testData.milestones[1]!.conditions[1]!;
    expect(
      conditionProgress(snapshot, testData, 'self_sufficient_village', 1, balance),
    ).toMatchObject({
      days: 4,
      requiredDays: 10,
    });
  });
});
