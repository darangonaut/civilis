import type { EraDefinition, GameState } from '@/types';
import type { GameData } from '../core/definitions';
import { currentMilestone } from './milestones';

/** Index aktuálnej éry = éra najbližšieho nesplneného míľnika (po poslednom ostáva posledná). */
export function currentEraIndex(state: Readonly<GameState>, data: GameData): number {
  const milestone = currentMilestone(state, data);
  const eraId = milestone?.era ?? data.eras.at(-1)!.id;
  return Math.max(
    0,
    data.eras.findIndex((e) => e.id === eraId),
  );
}

export function currentEra(state: Readonly<GameState>, data: GameData): EraDefinition {
  return data.eras[currentEraIndex(state, data)]!;
}

/** Či je éra už odomknutá (aktuálna alebo skoršia). */
export function isEraUnlocked(state: Readonly<GameState>, data: GameData, eraId: string): boolean {
  const index = data.eras.findIndex((e) => e.id === eraId);
  return index >= 0 && index <= currentEraIndex(state, data);
}

/** Éra, v ktorej sa budova odomyká (podľa éry technológie, ktorú vyžaduje). */
export function buildingEraIndex(data: GameData, buildingId: string): number {
  const techId = data.buildingsById.get(buildingId)?.requiredTechnologyId;
  const tech = techId ? data.technologiesById.get(techId) : undefined;
  return tech
    ? Math.max(
        0,
        data.eras.findIndex((e) => e.id === tech.era),
      )
    : 0;
}
