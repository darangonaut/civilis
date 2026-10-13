import { gameData } from '@/data';
import { buildingEraIndex } from '@/engine';
import type { ResourceId } from '@/types';

/** Éra, od ktorej má zmysel surovinu zobrazovať (najskoršia budova, ktorá ju vyrába). */
const resourceEra = new Map<ResourceId, number>();
for (const building of gameData.buildings) {
  for (const id of Object.keys(building.outputs) as ResourceId[]) {
    const era = buildingEraIndex(gameData, building.id);
    resourceEra.set(id, Math.min(resourceEra.get(id) ?? Infinity, era));
  }
}

export function resourceVisible(id: ResourceId, eraIndex: number, amount: number): boolean {
  return amount > 0 || (resourceEra.get(id) ?? 0) <= eraIndex;
}
