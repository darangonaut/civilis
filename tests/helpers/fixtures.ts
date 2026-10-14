import { createGameEngine } from '@/engine/core/engine';
import { SCHEMA_VERSION } from '@/engine/core/constants';
import type { CivilisEngine } from '@/engine/core/engine';
import { RESOURCE_IDS } from '@/types';
import type { GameEngine, GameState, Position, Resources, TerrainType, Tile } from '@/types';
import { economyTestData as testData } from './gameData';

export interface TestCityOptions {
  width?: number;
  height?: number;
  /** Terén podľa súradníc; predvolene tráva. */
  terrain?: (x: number, y: number) => TerrainType;
  population?: number;
  resources?: Partial<Resources>;
  money?: number;
}

/**
 * Malé syntetické mesto pre ekonomické testy: sklad na [1, 1] a cesta po celom riadku y = 2.
 * Budovy umiestnené na y = 3 (alebo y = 1) sú teda pripojené k sieti.
 */
export function createTestCity(options: TestCityOptions = {}): CivilisEngine {
  const width = options.width ?? 16;
  const height = options.height ?? 8;
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const terrain = options.terrain?.(x, y) ?? 'grass';
      tiles.push({ terrain, fertility: terrain === 'fertile' ? 90 : 45 });
    }
  }
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    gameId: 'test',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastSavedAt: '2026-01-01T00:00:00.000Z',
    simulation: { day: 0, speed: 1, seed: 1 },
    world: { seed: 1, width, height, tiles },
    city: {
      name: 'Test',
      population: {
        total: 0,
        housingCapacity: 0,
        availableWorkers: 0,
        employedWorkers: 0,
        happiness: 70,
        happinessFactors: { food: 100, housing: 0, water: 0, education: 0, leisure: 0 },
        growthProgress: 0,
      },
      economy: {
        resources: zeroResources(),
        money: 0,
        storageCapacity: 0,
        dailyIncome: 0,
        dailyExpenses: 0,
        dailyProduction: {},
        dailyConsumption: {},
      },
      buildings: [],
    },
    research: {
      completedTechnologyIds: [],
      activeTechnologyId: null,
      investedKnowledge: 0,
      queue: [],
    },
    milestones: { completedIds: [], progressDays: {} },
    trade: { autoSell: [], earned: 0 },
    achievements: { completedIds: [], finishedDay: null },
    // Testové mestá bez náhodných udalostí (ekonomické testy musia byť presné).
    events: { enabled: false, nextDay: 0, active: [], pending: null },
  };

  const engine = createGameEngine(testData, state);
  build(engine, 'warehouse', { x: 1, y: 1 });
  for (let x = 0; x < width; x++) build(engine, 'road', { x, y: 2 });
  setCity(engine, {
    population: options.population ?? 10,
    resources: options.resources ?? {},
    money: options.money ?? 1000,
  });
  return engine;
}

/** Postaví budovu bez ohľadu na suroviny (pôvodné zásoby zostanú zachované). */
export function build(engine: GameEngine, buildingId: string, position: Position): string {
  const state = engine.serialize();
  const saved = { ...state.city.economy.resources };
  state.city.economy.resources = zeroResources(1e6);
  engine.load(state);
  const result = engine.execute({ type: 'PLACE_BUILDING', buildingId, position });
  if (!result.success) throw new Error(`Nepodarilo sa postaviť ${buildingId}: ${result.reason}`);
  const after = engine.serialize();
  after.city.economy.resources = saved;
  engine.load(after);
  return after.city.buildings.at(-1)!.id;
}

export function setCity(
  engine: GameEngine,
  values: {
    population?: number;
    resources?: Partial<Resources>;
    money?: number;
    completedTechnologyIds?: string[];
    happiness?: number;
  },
): void {
  const state = engine.serialize();
  if (values.population !== undefined) state.city.population.total = values.population;
  if (values.resources) {
    state.city.economy.resources = { ...zeroResources(), ...values.resources };
  }
  if (values.money !== undefined) state.city.economy.money = values.money;
  if (values.completedTechnologyIds)
    state.research.completedTechnologyIds = values.completedTechnologyIds;
  if (values.happiness !== undefined) state.city.population.happiness = values.happiness;
  engine.load(state);
}

/** Zásoby so všetkými surovinami nastavenými na `value`. */
export function zeroResources(value = 0): Resources {
  return Object.fromEntries(RESOURCE_IDS.map((id) => [id, value])) as Resources;
}
