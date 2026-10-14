import type {
  BuildingDefinition,
  BuildingInstance,
  GameState,
  HappinessFactors,
  ServiceType,
} from '@/types';
import { effectiveDefinition } from '../core/levels';
import type { GameData } from '../core/definitions';
import type { CityAnalysis } from '../economy/analysis';
import { footprint, tileIndex } from '../world/grid';

/**
 * Mriežka políčok v dosahu aktívnej služby daného typu. Dosah je štvorec (Chebyševova
 * vzdialenosť ≤ radius) okolo budovy služby. Služba je aktívna, ak beží (efektivita > 0) —
 * studňa vždy, škola iba s pracovníkmi a cestou.
 */
export function serviceCoverageGrid(
  state: Readonly<GameState>,
  data: GameData,
  analysis: CityAnalysis,
  type: ServiceType,
): Uint8Array {
  const world = state.world;
  const covered = new Uint8Array(world.width * world.height);
  for (const building of state.city.buildings) {
    const service = data.buildingsById.get(building.definitionId)?.service;
    if (service?.type !== type || !((analysis.statuses.get(building.id)?.efficiency ?? 0) > 0))
      continue;
    const { x, y } = building.position;
    for (
      let ty = Math.max(0, y - service.radius);
      ty <= Math.min(world.height - 1, y + service.radius);
      ty++
    ) {
      for (
        let tx = Math.max(0, x - service.radius);
        tx <= Math.min(world.width - 1, x + service.radius);
        tx++
      ) {
        covered[tileIndex(world, tx, ty)] = 1;
      }
    }
  }
  return covered;
}

export function isBuildingCovered(
  state: Readonly<GameState>,
  definition: BuildingDefinition,
  building: BuildingInstance,
  grid: Uint8Array,
): boolean {
  return footprint(definition, building.position).some(
    (p) => grid[tileIndex(state.world, p.x, p.y)] === 1,
  );
}

/** Podiel kapacity bývania pripojených domov (0–1) v dosahu služby. */
export function serviceCoverage(
  state: Readonly<GameState>,
  data: GameData,
  analysis: CityAnalysis,
  type: ServiceType,
): number {
  const grid = serviceCoverageGrid(state, data, analysis, type);
  let total = 0;
  let inRange = 0;
  for (const building of state.city.buildings) {
    const base = data.buildingsById.get(building.definitionId);
    if (!base || !analysis.statuses.get(building.id)?.connected) continue;
    const definition = effectiveDefinition(base, building.level);
    if (definition.housingCapacity <= 0) continue;
    total += definition.housingCapacity;
    if (isBuildingCovered(state, definition, building, grid)) inRange += definition.housingCapacity;
  }
  return total > 0 ? inRange / total : 0;
}

/**
 * Zložky spokojnosti (0–100). `foodSatisfaction` je podiel potravín, ktoré obyvatelia
 * v daný deň skutočne zjedli (0–1).
 */
export function computeHappinessFactors(
  state: Readonly<GameState>,
  data: GameData,
  analysis: CityAnalysis,
  foodSatisfaction: number,
): HappinessFactors {
  const population = state.city.population.total;
  const capacity = analysis.housingCapacity;
  const freeShare = capacity > 0 ? (capacity - population) / capacity : 0;
  const housing = Math.min(1, Math.max(0, freeShare / data.balance.housingComfortMargin));
  return {
    food: Math.round(Math.min(1, Math.max(0, foodSatisfaction)) * 100),
    housing: Math.round(housing * 100),
    water: Math.round(serviceCoverage(state, data, analysis, 'water') * 100),
    education: Math.round(serviceCoverage(state, data, analysis, 'education') * 100),
    leisure: Math.round(serviceCoverage(state, data, analysis, 'leisure') * 100),
  };
}

export function targetHappiness(factors: HappinessFactors, data: GameData): number {
  const w = data.balance.happinessWeights;
  return (
    factors.food * w.food +
    factors.housing * w.housing +
    factors.water * w.water +
    factors.education * w.education +
    // Parky a dekorácie: bonus navyše nad vážený priemer (strop 100 drží simulácia).
    (factors.leisure / 100) * data.balance.leisureBonus
  );
}

/**
 * Krok 7: spokojnosť sa posúva k cieľovej hodnote najviac o `happinessChangePerDay`,
 * potom sa podľa nej mení populácia.
 */
export function simulatePopulation(
  state: GameState,
  data: GameData,
  analysis: CityAnalysis,
  foodSatisfaction: number,
): void {
  const { balance } = data;
  const population = state.city.population;
  const factors = computeHappinessFactors(state, data, analysis, foodSatisfaction);
  population.happinessFactors = factors;

  const target = targetHappiness(factors, data);
  const step = Math.max(
    -balance.happinessChangePerDay,
    Math.min(balance.happinessChangePerDay, target - population.happiness),
  );
  population.happiness = Math.min(100, Math.max(0, population.happiness + step));

  const capacity = analysis.housingCapacity;
  const free = capacity - population.total;
  let total = population.total;

  if (free < 0) {
    // Bez strechy nad hlavou obyvatelia odchádzajú bez ohľadu na spokojnosť.
    total -= Math.max(1, Math.ceil(-free * 0.5));
    population.growthProgress = 0;
  } else if (population.happiness >= balance.happinessGrowthThreshold) {
    if (free > 0 && foodSatisfaction >= 1) {
      // Plynulý rast: zlomky obyvateľov sa sčítavajú, kým nevznikne celý obyvateľ.
      const progress =
        population.growthProgress +
        balance.populationBaseGrowth +
        total * balance.populationGrowthRate;
      // Strop rastu sa zväčšuje s mestom (veľké mestá priťahujú viac ľudí).
      const cap = Math.max(
        balance.populationMaxGrowth,
        Math.floor(total * balance.populationMaxGrowthShare),
      );
      const arrivals = Math.min(free, cap, Math.floor(progress));
      total += arrivals;
      // Pri strope rastu alebo plnom bývaní sa nadbytok nesčítava donekonečna.
      population.growthProgress =
        arrivals === free || arrivals < Math.floor(progress) ? 0 : progress - Math.floor(progress);
    }
  } else if (population.happiness < balance.happinessDeclineThreshold) {
    total -= Math.max(1, Math.floor(total * balance.populationDeclineRate));
    population.growthProgress = 0;
  }

  population.total = Math.max(balance.minimumPopulation, total);
}
