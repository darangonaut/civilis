import type { BuildingInstance, GameState, Position, World } from '@/types';
import { generateWorld, getStartCenter } from '../world/generateWorld';
import { footprint, tileIndex } from '../world/grid';
import { DEFAULT_BUILDING_PRIORITY, SCHEMA_VERSION } from './constants';
import type { GameData } from './definitions';
import { refreshDerivedState } from '../economy/analysis';
import { computeHappinessFactors } from '../population/population';
import { normalizeSeed } from './random';

export interface NewGameOptions {
  seed: number;
  /** Identifikátor a časová pečiatka sa dodávajú zvonka, aby engine zostal deterministický. */
  gameId: string;
  now: string;
  cityName?: string;
}

/** Rozloženie počiatočnej osady relatívne k stredu štartovacej oblasti. */
const STARTING_LAYOUT: { definitionId: string; offset: Position }[] = [
  { definitionId: 'warehouse', offset: { x: 0, y: 0 } },
  { definitionId: 'house', offset: { x: 2, y: 0 } },
  ...[-1, 0, 1, 2, 3].map((dx) => ({ definitionId: 'road', offset: { x: dx, y: 1 } })),
];

function placeStartingBuildings(world: World, data: GameData): BuildingInstance[] {
  const center = getStartCenter(world);
  return STARTING_LAYOUT.map(({ definitionId, offset }, i) => {
    const definition = data.buildingsById.get(definitionId);
    if (!definition) throw new Error(`Chýba definícia počiatočnej budovy "${definitionId}"`);
    const instance: BuildingInstance = {
      id: `b${i + 1}`,
      definitionId,
      position: { x: center.x + offset.x, y: center.y + offset.y },
      enabled: true,
      priority: DEFAULT_BUILDING_PRIORITY,
      level: 1,
    };
    for (const p of footprint(definition, instance.position)) {
      // Počiatočné budovy stoja vždy na tráve, bez ohľadu na vygenerovaný terén.
      world.tiles[tileIndex(world, p.x, p.y)] = {
        terrain: 'grass',
        fertility: 45,
        buildingId: instance.id,
      };
    }
    return instance;
  });
}

export function createNewGame(data: GameData, options: NewGameOptions): GameState {
  const seed = normalizeSeed(options.seed);
  const { width, height } = data.balance.mapSize;
  const start = data.balance.startingState;
  const world = generateWorld(seed, width, height);
  const buildings = placeStartingBuildings(world, data);

  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    gameId: options.gameId,
    createdAt: options.now,
    lastSavedAt: options.now,
    simulation: { day: 0, speed: 1, seed },
    world,
    city: {
      name: options.cityName ?? 'Civilis',
      population: {
        total: start.population,
        housingCapacity: 0,
        availableWorkers: Math.floor(start.population * data.balance.workforceShare),
        employedWorkers: 0,
        happiness: start.happiness,
        happinessFactors: { food: 100, housing: 0, water: 0, education: 0, leisure: 0 },
        growthProgress: 0,
      },
      economy: {
        resources: { ...start.resources },
        money: start.money,
        storageCapacity: 0,
        dailyIncome: 0,
        dailyExpenses: 0,
        dailyProduction: {},
        dailyConsumption: {},
      },
      buildings,
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
    events: {
      enabled: true,
      nextDay: data.balance.events.firstDay,
      active: [],
      pending: null,
    },
  };
  const analysis = refreshDerivedState(state, data);
  state.city.population.happinessFactors = computeHappinessFactors(state, data, analysis, 1);
  return state;
}
