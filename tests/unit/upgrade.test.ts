import { describe, expect, it } from 'vitest';
import type { CivilisEngine } from '@/engine/core/engine';
import { effectiveDefinition } from '@/engine/core/levels';
import { migrateGameState } from '@/persistence/migrations';
import { build, createTestCity, setCity } from '../helpers/fixtures';
import { def, economyTestData } from '../helpers/gameData';

const house = def('house');
const L2 = house.levels![0]!;
const L3 = house.levels![1]!;

function cityWithHouse(resources = { wood: 100, stone: 100, tools: 50, food: 500 }) {
  const engine = createTestCity({ population: 10, resources });
  const id = build(engine, 'house', { x: 3, y: 3 });
  return { engine, id };
}

const upgrade = (engine: CivilisEngine, instanceId: string) =>
  engine.execute({ type: 'UPGRADE_BUILDING', instanceId });
const level = (engine: CivilisEngine, id: string) =>
  engine.getState().city.buildings.find((b) => b.id === id)!.level;

function expectRejected(engine: CivilisEngine, id: string, reason: string) {
  const before = engine.serialize();
  expect(upgrade(engine, id)).toEqual({ success: false, reason });
  expect(engine.serialize()).toEqual(before);
}

describe('úrovne budov', () => {
  it('efektívne parametre sa skladajú z úrovní', () => {
    expect(effectiveDefinition(house, 1).housingCapacity).toBe(10);
    expect(effectiveDefinition(house, 2)).toMatchObject({
      name: L2.name,
      housingCapacity: L2.housingCapacity,
    });
    expect(effectiveDefinition(house, 3)).toMatchObject({
      name: L3.name,
      housingCapacity: L3.housingCapacity,
    });
  });

  it('murovaný dom vyžaduje technológiu, vodu a suroviny', () => {
    const { engine, id } = cityWithHouse();
    expectRejected(engine, id, 'technology_required');

    setCity(engine, { completedTechnologyIds: [L2.requiredTechnologyId!] });
    expectRejected(engine, id, 'service_required');

    build(engine, 'well', { x: 4, y: 5 });
    setCity(engine, { resources: { stone: 1 } });
    expectRejected(engine, id, 'insufficient_resources');

    setCity(engine, { resources: { stone: 100, tools: 50 } });
    expect(upgrade(engine, id)).toEqual({ success: true });
    expect(level(engine, id)).toBe(2);
    const state = engine.getState();
    expect(state.city.economy.resources.stone).toBe(100 - L2.upgradeCost.stone!);
    expect(state.city.economy.resources.tools).toBe(50 - L2.upgradeCost.tools!);
    expect(state.city.population.housingCapacity).toBe(L2.housingCapacity);
  });

  it('meštiansky dom navyše vyžaduje fungujúcu školu v dosahu a potom je na maxime', () => {
    const { engine, id } = cityWithHouse();
    setCity(engine, {
      completedTechnologyIds: [L2.requiredTechnologyId!, L3.requiredTechnologyId!],
      resources: { wood: 100, stone: 100, tools: 50, food: 500 },
    });
    build(engine, 'well', { x: 4, y: 5 });
    expect(upgrade(engine, id).success).toBe(true);
    expectRejected(engine, id, 'service_required');

    build(engine, 'school', { x: 6, y: 3 });
    expect(upgrade(engine, id)).toEqual({ success: true });
    expect(level(engine, id)).toBe(3);
    expect(engine.getState().city.population.housingCapacity).toBe(L3.housingCapacity);
    expectRejected(engine, id, 'max_level');
  });

  it('veľký sklad zvýši kapacitu skladu', () => {
    const engine = createTestCity({ resources: { wood: 100, stone: 100, tools: 50 } });
    const warehouse = engine
      .getState()
      .city.buildings.find((b) => b.definitionId === 'warehouse')!.id;
    const next = def('warehouse').levels![0]!;
    setCity(engine, {
      completedTechnologyIds: ['woodworking', next.requiredTechnologyId!],
      resources: { wood: 100, stone: 100, tools: 50 },
    });
    expect(upgrade(engine, warehouse).success).toBe(true);
    expect(engine.getState().city.economy.storageCapacity).toBe(
      economyTestData.balance.baseStorageCapacity + next.storageCapacity!,
    );
  });

  it('neznáma budova', () => {
    expectRejected(createTestCity(), 'nope', 'unknown_instance');
  });
});

describe('migrácia uložených hier v1 → v2', () => {
  it('doplní budovám úroveň 1', () => {
    const { engine } = cityWithHouse();
    const v1 = structuredClone(engine.serialize()) as unknown as Record<string, unknown>;
    v1.schemaVersion = 1;
    const city = v1.city as { buildings: Record<string, unknown>[] };
    for (const b of city.buildings) delete b.level;
    const migrated = migrateGameState(v1);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.city.buildings.every((b) => b.level === 1)).toBe(true);
  });
});
