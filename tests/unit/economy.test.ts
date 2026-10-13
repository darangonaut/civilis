import { describe, expect, it } from 'vitest';
import { analyzeCity } from '@/engine/economy/analysis';
import type { GameEngine, ResourceId, TerrainType } from '@/types';
import { build, createTestCity, setCity } from '../helpers/fixtures';
import { def, economyTestData as testData } from '../helpers/gameData';

const status = (engine: GameEngine, id: string) =>
  analyzeCity(engine.getState(), testData).statuses.get(id)!;
const problems = (engine: GameEngine, id: string) => status(engine, id).problems.map((p) => p.code);
const resource = (engine: GameEngine, id: ResourceId) =>
  engine.getState().city.economy.resources[id];

/** Úrodná pôda na riadku y = 3, inak tráva. */
const fertileRow = (_x: number, y: number): TerrainType => (y === 3 ? 'fertile' : 'grass');

describe('ekonomika (test B)', () => {
  it('plne obsadená farma na úrodnej pôde vyrobí presne 8 potravín', () => {
    const engine = createTestCity({
      terrain: fertileRow,
      population: 10,
      resources: { food: 50, tools: 10 },
    });
    build(engine, 'farm', { x: 3, y: 3 });
    engine.tick();
    const economy = engine.getState().city.economy;
    expect(economy.dailyProduction.food).toBe(8);
    // 10 obyvateľov zje 2,5 potravín.
    expect(resource(engine, 'food')).toBe(50 + 8 - 2.5);
  });

  it('farma s časťou pracovníkov vyrobí pomerne menej', () => {
    // 2 obyvatelia = 1 pracovník.
    const engine = createTestCity({ terrain: fertileRow, population: 2, resources: { tools: 10 } });
    const farm = build(engine, 'farm', { x: 3, y: 3 });
    expect(status(engine, farm).workersAssigned).toBe(1);
    expect(problems(engine, farm)).toContain('understaffed');
    engine.tick();
    expect(engine.getState().city.economy.dailyProduction.food).toBeCloseTo(
      8 / def('farm').workersRequired,
    );
  });

  it('farma bez pracovníkov nevyrába', () => {
    const engine = createTestCity({ terrain: fertileRow, population: 1, resources: { tools: 10 } });
    const farm = build(engine, 'farm', { x: 3, y: 3 });
    expect(problems(engine, farm)).toContain('no_workers');
    engine.tick();
    expect(engine.getState().city.economy.dailyProduction.food).toBeUndefined();
  });

  it('farma na tráve vyrába na 50 %', () => {
    const engine = createTestCity({ population: 10, resources: { tools: 10 } });
    const farm = build(engine, 'farm', { x: 3, y: 3 });
    expect(problems(engine, farm)).toContain('poor_terrain');
    engine.tick();
    expect(engine.getState().city.economy.dailyProduction.food).toBe(4);
  });

  it('budova bez cesty nevyrába a hlási „Chýba cesta“', () => {
    const engine = createTestCity({
      terrain: fertileRow,
      population: 10,
      resources: { tools: 10 },
    });
    // y = 5 nesusedí s cestou na y = 2.
    const farm = build(engine, 'farm', { x: 3, y: 5 });
    const s = status(engine, farm);
    expect(s.connected).toBe(false);
    expect(s.workersAssigned).toBe(0);
    expect(problems(engine, farm)).toEqual(['no_road']);
  });

  it('dielňa pri nedostatku dreva vyrába pomerne menej', () => {
    const engine = createTestCity({ population: 10, resources: { wood: 1, stone: 10 } });
    const workshop = build(engine, 'workshop', { x: 3, y: 3 });
    expect(status(engine, workshop).problems).toEqual([
      { code: 'missing_input', resource: 'wood' },
    ]);
    engine.tick();
    const economy = engine.getState().city.economy;
    expect(economy.dailyProduction.tools).toBe(1);
    expect(economy.dailyConsumption.wood).toBe(1);
    expect(economy.dailyConsumption.stone).toBe(0.5);
    expect(resource(engine, 'wood')).toBe(0);
  });

  it('vstupy dostane najprv budova s vyššou prioritou', () => {
    const engine = createTestCity({ population: 20, resources: { wood: 2, stone: 1 } });
    const first = build(engine, 'workshop', { x: 3, y: 3 });
    const second = build(engine, 'workshop', { x: 5, y: 3 });
    engine.execute({ type: 'SET_BUILDING_PRIORITY', instanceId: second, priority: 3 });
    expect(status(engine, second).efficiency).toBe(1);
    expect(status(engine, first).efficiency).toBe(0);
    expect(problems(engine, first)).toContain('missing_input');
  });

  it('pracovníkov dostane najprv budova s vyššou prioritou, pri zhode staršia', () => {
    const required = def('farm').workersRequired;
    // Pracovníkov je o jedného viac, ako potrebuje jedna farma.
    const engine = createTestCity({
      terrain: fertileRow,
      population: (required + 1) * 2,
      resources: { tools: 10 },
    });
    const a = build(engine, 'farm', { x: 3, y: 3 });
    const b = build(engine, 'farm', { x: 5, y: 3 });
    expect(status(engine, a).workersAssigned).toBe(required);
    expect(status(engine, b).workersAssigned).toBe(1);
    engine.execute({ type: 'SET_BUILDING_PRIORITY', instanceId: b, priority: 3 });
    expect(status(engine, b).workersAssigned).toBe(required);
    expect(status(engine, a).workersAssigned).toBe(1);
    expect(engine.getState().city.population.employedWorkers).toBe(required + 1);
  });

  it('kapacita skladu obmedzuje suroviny, vedomosti nie', () => {
    const engine = createTestCity({
      terrain: (x, y) => (y === 3 && x === 3 ? 'forest' : 'grass'),
      population: 20,
      resources: { wood: 299, knowledge: 1000, tools: 10 },
    });
    build(engine, 'lumberjack', { x: 3, y: 3 });
    build(engine, 'school', { x: 5, y: 3 });
    expect(engine.getState().city.economy.storageCapacity).toBe(300);
    engine.tick();
    expect(resource(engine, 'wood')).toBe(300);
    expect(resource(engine, 'knowledge')).toBe(1003);
    engine.tick();
    expect(resource(engine, 'wood')).toBe(300);
  });

  it('bez nástrojov výrobné budovy bežia na 50 % a nástroje sa spotrebúvajú', () => {
    const engine = createTestCity({
      terrain: (x, y) => (y === 3 && x === 3 ? 'forest' : 'grass'),
      population: 10,
      resources: { tools: def('lumberjack').workersRequired * def('lumberjack').toolUsePerWorker },
    });
    const lumberjack = build(engine, 'lumberjack', { x: 3, y: 3 });
    build(engine, 'house', { x: 5, y: 3 }); // aby obyvatelia neodišli
    const toolsPerDay = def('lumberjack').workersRequired * def('lumberjack').toolUsePerWorker;
    engine.tick();
    expect(engine.getState().city.economy.dailyConsumption.tools).toBeCloseTo(toolsPerDay);
    expect(engine.getState().city.economy.dailyProduction.wood).toBe(6);
    expect(problems(engine, lumberjack)).toContain('no_tools');
    engine.tick();
    expect(engine.getState().city.economy.dailyProduction.wood).toBe(3);
  });

  it('údržba sa odpočíta, trhovisko zarába a spotrebuje potraviny', () => {
    const engine = createTestCity({ population: 10, resources: { food: 100 }, money: 100 });
    build(engine, 'market', { x: 3, y: 3 });
    engine.tick();
    const economy = engine.getState().city.economy;
    const maintenance = def('warehouse').maintenanceCost + def('market').maintenanceCost;
    expect(economy.dailyExpenses).toBe(maintenance);
    expect(economy.dailyIncome).toBe(8);
    expect(economy.money).toBe(100 + 8 - maintenance);
    expect(economy.dailyConsumption.food).toBe(2 + 2.5);
  });

  it('bez peňazí na údržbu budovy bežia na 50 %, pokladnica neklesne pod nulu', () => {
    const engine = createTestCity({
      terrain: fertileRow,
      population: 10,
      resources: { tools: 10 },
      money: 0,
    });
    const farm = build(engine, 'farm', { x: 3, y: 3 });
    expect(problems(engine, farm)).toContain('no_funds');
    engine.tick();
    expect(engine.getState().city.economy.dailyProduction.food).toBe(4);
    expect(engine.getState().city.economy.money).toBe(0);
  });

  it('technológie zvyšujú produkciu aditívne a znižujú údržbu', () => {
    const engine = createTestCity({
      terrain: (x, y) => (y === 3 && x === 3 ? 'forest' : 'grass'),
      population: 10,
      resources: { tools: 10 },
    });
    build(engine, 'lumberjack', { x: 3, y: 3 });
    setCity(engine, {
      completedTechnologyIds: ['woodworking', 'labor_organization', 'city_administration'],
    });
    engine.tick();
    const economy = engine.getState().city.economy;
    expect(economy.dailyProduction.wood).toBeCloseTo(6 * 1.3);
    // Mestská správa: −20 % údržby skladu a drevorubača.
    expect(economy.dailyExpenses).toBeCloseTo(
      (def('warehouse').maintenanceCost + def('lumberjack').maintenanceCost) * 0.8,
    );
  });

  it('potraviny pri hlade klesnú na nulu, nie pod ňu', () => {
    const engine = createTestCity({ population: 100, resources: { food: 3 } });
    engine.tick();
    expect(resource(engine, 'food')).toBe(0);
    expect(engine.getState().city.economy.dailyConsumption.food).toBe(3);
  });
});

describe('cestná sieť', () => {
  it('dom pripojený k ceste pridá bývanie, nepripojený nie', () => {
    const engine = createTestCity({ population: 10 });
    const connected = build(engine, 'house', { x: 3, y: 3 });
    const isolated = build(engine, 'house', { x: 3, y: 6 });
    expect(status(engine, connected).connected).toBe(true);
    expect(status(engine, isolated).connected).toBe(false);
    expect(engine.getState().city.population.housingCapacity).toBe(10);
  });

  it('cesta oddelená od siete budovy nepripojí, spojením sa pripoja', () => {
    const engine = createTestCity({ population: 10 });
    const house = build(engine, 'house', { x: 3, y: 6 });
    build(engine, 'road', { x: 3, y: 5 });
    expect(status(engine, house).connected).toBe(false);
    build(engine, 'road', { x: 3, y: 4 });
    expect(status(engine, house).connected).toBe(false);
    build(engine, 'road', { x: 3, y: 3 });
    expect(status(engine, house).connected).toBe(true);
  });

  it('studňa nepotrebuje cestu', () => {
    const engine = createTestCity({ population: 10 });
    const well = build(engine, 'well', { x: 8, y: 6 });
    expect(status(engine, well).connected).toBe(true);
    expect(problems(engine, well)).toEqual([]);
  });

  it('zbúranie cesty odpojí budovy za ňou', () => {
    const engine = createTestCity({ population: 10 });
    const road = build(engine, 'road', { x: 3, y: 3 });
    const house = build(engine, 'house', { x: 3, y: 4 });
    expect(status(engine, house).connected).toBe(true);
    engine.execute({ type: 'DEMOLISH_BUILDING', instanceId: road });
    expect(status(engine, house).connected).toBe(false);
  });
});

describe('suroviny nikdy nie sú záporné', () => {
  it('ani po 300 dňoch v meste s nedostatkom všetkého', () => {
    const engine = createTestCity({
      terrain: (x, y) => (y === 3 ? (x % 3 === 0 ? 'forest' : 'fertile') : 'grass'),
      population: 40,
      resources: { food: 5, wood: 3, stone: 1, tools: 0.5 },
      money: 3,
    });
    for (const [id, x] of [
      ['lumberjack', 3],
      ['farm', 4],
      ['farm', 5],
      ['lumberjack', 6],
      ['workshop', 7],
      ['workshop', 8],
      ['market', 10],
      ['school', 11],
    ] as const) {
      build(engine, id, { x, y: id === 'workshop' || id === 'market' || id === 'school' ? 1 : 3 });
    }
    for (let day = 0; day < 300; day++) {
      engine.tick();
      const { resources, money } = engine.getState().city.economy;
      for (const value of Object.values(resources)) expect(value).toBeGreaterThanOrEqual(0);
      expect(money).toBeGreaterThanOrEqual(0);
    }
  });
});
