import type { GameState, HappinessFactors, ServiceType } from '@/types';
import type { GameData } from '../core/definitions';
import type { CityAnalysis } from '../economy/analysis';
import { footprint, tileIndex } from '../world/grid';

/**
 * Podiel kapacity bývania (0–1) v dosahu aktívnej služby daného typu. Dosah je štvorec
 * (Chebyševova vzdialenosť ≤ radius) okolo budovy služby. Služba je aktívna, ak beží
 * (efektivita > 0) — studňa vždy, škola iba s pracovníkmi a cestou.
 */
export function serviceCoverage(
  state: Readonly<GameState>,
  data: GameData,
  analysis: CityAnalysis,
  type: ServiceType,
): number {
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

  let total = 0;
  let inRange = 0;
  for (const building of state.city.buildings) {
    const definition = data.buildingsById.get(building.definitionId);
    if (
      !definition ||
      definition.housingCapacity <= 0 ||
      !analysis.statuses.get(building.id)?.connected
    )
      continue;
    total += definition.housingCapacity;
    if (footprint(definition, building.position).some((p) => covered[tileIndex(world, p.x, p.y)])) {
      inRange += definition.housingCapacity;
    }
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
  };
}

export function targetHappiness(factors: HappinessFactors, data: GameData): number {
  const w = data.balance.happinessWeights;
  return (
    factors.food * w.food +
    factors.housing * w.housing +
    factors.water * w.water +
    factors.education * w.education
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
  } else if (population.happiness >= balance.happinessGrowthThreshold) {
    if (free > 0 && foodSatisfaction >= 1) {
      total += Math.min(free, Math.max(1, Math.floor(total * balance.populationGrowthRate)));
    }
  } else if (population.happiness < balance.happinessDeclineThreshold) {
    total -= Math.max(1, Math.floor(total * balance.populationDeclineRate));
  }

  population.total = Math.max(balance.minimumPopulation, total);
}
