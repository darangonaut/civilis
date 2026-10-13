import type { GameState } from '@/types';
import type { GameData } from '../core/definitions';
import type { CityAnalysis } from '../economy/analysis';
import { effectiveDefinition } from '../core/levels';

function instanceNumber(id: string): number {
  const n = Number(id.slice(1));
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/**
 * Obsadenosť domov (0–1). Obyvatelia sa sťahujú do pripojených domov od najstaršieho,
 * kým sa nevyčerpá populácia — nový dom sa rozsvieti, až keď sa doň niekto nasťahuje.
 * Slúži iba na zobrazenie (simulácia s jednotlivými domami nepočíta).
 */
export function houseOccupancy(
  state: Readonly<GameState>,
  data: GameData,
  analysis: CityAnalysis,
): Map<string, number> {
  const houses = state.city.buildings
    .filter((b) => analysis.statuses.get(b.id)?.connected)
    .map((b) => {
      const base = data.buildingsById.get(b.definitionId);
      return { id: b.id, capacity: base ? effectiveDefinition(base, b.level).housingCapacity : 0 };
    })
    .filter((h) => h.capacity > 0)
    .sort((a, b) => instanceNumber(a.id) - instanceNumber(b.id));

  const occupancy = new Map<string, number>();
  let remaining = state.city.population.total;
  for (const house of houses) {
    const residents = Math.min(house.capacity, Math.max(0, remaining));
    occupancy.set(house.id, residents / house.capacity);
    remaining -= residents;
  }
  return occupancy;
}
