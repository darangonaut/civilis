import type { GameState, ResourceId, TechnologyEffect } from '@/types';
import type { GameData } from '../core/definitions';

/** Efekty dokončených technológií a postavených divov sveta. */
function activeEffects(state: Readonly<GameState>, data: GameData): TechnologyEffect[] {
  const effects: TechnologyEffect[] = [];
  for (const techId of state.research.completedTechnologyIds) {
    effects.push(...(data.technologiesById.get(techId)?.effects ?? []));
  }
  for (const building of state.city.buildings) {
    effects.push(...(data.buildingsById.get(building.definitionId)?.wonder?.effects ?? []));
  }
  return effects;
}

/**
 * Násobič produkcie suroviny z technológií a divov. Bonusy sa sčítavajú
 * (+20 % a +10 % = ×1,3), viď docs/GAME_DESIGN.md.
 */
export function productionMultiplier(
  state: Readonly<GameState>,
  data: GameData,
  resource: ResourceId,
): number {
  let bonus = 0;
  for (const effect of activeEffects(state, data)) {
    if (
      effect.type === 'production_multiplier' &&
      (effect.target === resource || effect.target === 'all')
    ) {
      bonus += effect.multiplier - 1;
    }
  }
  return Math.max(0, 1 + bonus);
}

/** Násobič nákladov na údržbu (aditívne). */
export function maintenanceMultiplier(state: Readonly<GameState>, data: GameData): number {
  let bonus = 0;
  for (const effect of activeEffects(state, data)) {
    if (effect.type === 'maintenance_multiplier') bonus += effect.multiplier - 1;
  }
  return Math.max(0, 1 + bonus);
}

/** Násobič príjmu peňazí (aditívne). */
export function moneyMultiplier(state: Readonly<GameState>, data: GameData): number {
  let bonus = 0;
  for (const effect of activeEffects(state, data)) {
    if (effect.type === 'money_multiplier') bonus += effect.multiplier - 1;
  }
  return Math.max(0, 1 + bonus);
}

/** Body spokojnosti navyše z postavených divov. */
export function wonderHappiness(state: Readonly<GameState>, data: GameData): number {
  let bonus = 0;
  for (const building of state.city.buildings) {
    bonus += data.buildingsById.get(building.definitionId)?.wonder?.happiness ?? 0;
  }
  return bonus;
}
