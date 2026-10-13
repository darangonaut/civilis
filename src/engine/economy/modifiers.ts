import type { ResearchState, ResourceId } from '@/types';
import type { GameData } from '../core/definitions';

/**
 * Násobič produkcie suroviny z dokončených technológií. Bonusy sa sčítavajú
 * (+20 % a +10 % = ×1,3), viď docs/GAME_DESIGN.md.
 */
export function productionMultiplier(
  research: ResearchState,
  data: GameData,
  resource: ResourceId,
): number {
  let bonus = 0;
  for (const techId of research.completedTechnologyIds) {
    for (const effect of data.technologiesById.get(techId)?.effects ?? []) {
      if (
        effect.type === 'production_multiplier' &&
        (effect.target === resource || effect.target === 'all')
      ) {
        bonus += effect.multiplier - 1;
      }
    }
  }
  return Math.max(0, 1 + bonus);
}

/** Násobič nákladov na údržbu z dokončených technológií (aditívne). */
export function maintenanceMultiplier(research: ResearchState, data: GameData): number {
  let bonus = 0;
  for (const techId of research.completedTechnologyIds) {
    for (const effect of data.technologiesById.get(techId)?.effects ?? []) {
      if (effect.type === 'maintenance_multiplier') bonus += effect.multiplier - 1;
    }
  }
  return Math.max(0, 1 + bonus);
}
