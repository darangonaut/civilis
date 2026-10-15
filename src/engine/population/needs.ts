import { RESOURCE_IDS, type GameState, type Resources } from '@/types';
import type { GameData } from '../core/definitions';
import { effectiveDefinition } from '../core/levels';
import type { CityAnalysis } from '../economy/analysis';
import { footprint, tileIndex } from '../world/grid';
import { houseOccupancy } from './occupancy';
import { serviceCoverageGrid } from './population';

const instanceNumber = (id: string) => {
  const n = Number(id.slice(1));
  return Number.isFinite(n) ? n : 0;
};

export interface NeedsResult {
  /** Zásobenie domov tovarom 0–100 (vážené kapacitou). */
  goods: number;
  /** Počet domov, ktoré klesli o úroveň. */
  downgraded: number;
}

/**
 * Krok 6c: obyvatelia lepších domov spotrebujú tovar zo skladu (podľa obsadenosti).
 * Pri nedostatku klesá zložka spokojnosti „tovar“; pri dlhom vážnom nedostatku dom klesne o úroveň.
 */
export function simulateNeeds(
  state: GameState,
  data: GameData,
  analysis: CityAnalysis,
  resources: Resources,
  consumption: Partial<Resources>,
): NeedsResult {
  const occupancy = houseOccupancy(state, data, analysis);
  const demand: Partial<Resources> = {};
  const houses: {
    building: GameState['city']['buildings'][number];
    capacity: number;
    need: Partial<Resources>;
  }[] = [];
  let totalCapacity = 0;
  for (const building of state.city.buildings) {
    const base = data.buildingsById.get(building.definitionId);
    if (!base) continue;
    const definition = effectiveDefinition(base, building.level);
    if (definition.housingCapacity <= 0) continue;
    totalCapacity += definition.housingCapacity;
    const residents = definition.housingCapacity * (occupancy.get(building.id) ?? 0);
    const need: Partial<Resources> = {};
    for (const id of RESOURCE_IDS) {
      const perResident = definition.needs?.[id] ?? 0;
      if (perResident > 0 && residents > 0) {
        need[id] = perResident * residents;
        demand[id] = (demand[id] ?? 0) + need[id]!;
      }
    }
    houses.push({ building, capacity: definition.housingCapacity, need });
  }

  // Podiel uspokojeného dopytu po každej surovine; tovar sa odoberie zo skladu.
  const satisfaction: Partial<Record<keyof Resources, number>> = {};
  for (const id of RESOURCE_IDS) {
    const wanted = demand[id] ?? 0;
    if (wanted <= 0) continue;
    const used = Math.min(resources[id], wanted);
    resources[id] -= used;
    if (used > 0) consumption[id] = (consumption[id] ?? 0) + used;
    satisfaction[id] = used / wanted;
  }

  const { downgradeBelow, downgradeDays, downgradeSpread } = data.balance.needs;
  let weighted = 0;
  let downgraded = 0;
  for (const { building, capacity, need } of houses) {
    let houseSatisfaction = 1;
    for (const id of RESOURCE_IDS) {
      if ((need[id] ?? 0) > 0)
        houseSatisfaction = Math.min(houseSatisfaction, satisfaction[id] ?? 1);
    }
    weighted += capacity * houseSatisfaction;
    if (houseSatisfaction < downgradeBelow) {
      building.neglect = (building.neglect ?? 0) + 1;
      const limit = downgradeDays + (instanceNumber(building.id) % (downgradeSpread + 1));
      if (building.neglect >= limit && building.level > 1) {
        building.level -= 1;
        building.neglect = 0;
        downgraded++;
      }
    } else if (building.neglect) {
      delete building.neglect;
    }
  }
  return {
    goods: totalCapacity > 0 ? Math.round((weighted / totalCapacity) * 100) : 100,
    downgraded,
  };
}

/** Znečistenie políčok od pracujúcich budov, znížené parkami (služba oddych). */
export function pollutionGrid(
  state: Readonly<GameState>,
  data: GameData,
  analysis: CityAnalysis,
): Float32Array {
  const world = state.world;
  const grid = new Float32Array(world.width * world.height);
  for (const building of state.city.buildings) {
    const pollution = data.buildingsById.get(building.definitionId)?.pollution;
    if (!pollution || !((analysis.statuses.get(building.id)?.efficiency ?? 0) > 0)) continue;
    const { x, y } = building.position;
    const r = pollution.radius;
    for (let ty = Math.max(0, y - r); ty <= Math.min(world.height - 1, y + r); ty++) {
      for (let tx = Math.max(0, x - r); tx <= Math.min(world.width - 1, x + r); tx++) {
        grid[tileIndex(world, tx, ty)]! += pollution.amount;
      }
    }
  }
  const cleansing = data.balance.pollution.leisureCleansing;
  if (cleansing > 0) {
    const parks = serviceCoverageGrid(state, data, analysis, 'leisure');
    for (let i = 0; i < grid.length; i++) {
      if (parks[i]) grid[i] = Math.max(0, grid[i]! - cleansing);
    }
  }
  return grid;
}

/** Budova je v znečistení, ak niektoré jej políčko dosahuje prah. */
export function isPolluted(
  state: Readonly<GameState>,
  data: GameData,
  building: GameState['city']['buildings'][number],
  grid: Float32Array,
): boolean {
  const base = data.buildingsById.get(building.definitionId);
  if (!base) return false;
  const threshold = data.balance.pollution.threshold;
  return footprint(base, building.position).some(
    (p) => grid[tileIndex(state.world, p.x, p.y)]! >= threshold,
  );
}

/** Podiel kapacity bývania mimo znečistenia 0–100. */
export function environmentFactor(
  state: Readonly<GameState>,
  data: GameData,
  analysis: CityAnalysis,
): number {
  const grid = pollutionGrid(state, data, analysis);
  let total = 0;
  let clean = 0;
  for (const building of state.city.buildings) {
    const base = data.buildingsById.get(building.definitionId);
    if (!base) continue;
    const capacity = effectiveDefinition(base, building.level).housingCapacity;
    if (capacity <= 0) continue;
    total += capacity;
    if (!isPolluted(state, data, building, grid)) clean += capacity;
  }
  return total > 0 ? Math.round((clean / total) * 100) : 100;
}
