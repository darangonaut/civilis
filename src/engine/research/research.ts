import type { CommandResult, GameState } from '@/types';
import type { CommandFailureReason } from '../core/commandReasons';
import type { GameData } from '../core/definitions';
import { isEraUnlocked } from '../milestones/eras';

const fail = (reason: CommandFailureReason): CommandResult => ({ success: false, reason });

/** Či sa dá technológia práve začať skúmať (bez zmeny stavu). */
export function validateResearch(
  state: Readonly<GameState>,
  data: GameData,
  technologyId: string,
): CommandResult {
  const technology = data.technologiesById.get(technologyId);
  if (!technology) return fail('unknown_technology');
  const { research } = state;
  if (research.completedTechnologyIds.includes(technologyId)) return fail('technology_completed');
  if (research.activeTechnologyId === technologyId) return fail('research_active');
  if (!isEraUnlocked(state, data, technology.era)) return fail('era_locked');
  if (!technology.prerequisites.every((id) => research.completedTechnologyIds.includes(id))) {
    return fail('prerequisites_missing');
  }
  return { success: true };
}

/**
 * START_RESEARCH. Pri prepnutí na inú technológiu sa doteraz investované vedomosti
 * vrátia do zásob, takže sa nič nestratí.
 */
export function startResearch(
  state: GameState,
  data: GameData,
  technologyId: string,
): CommandResult {
  const validation = validateResearch(state, data, technologyId);
  if (!validation.success) return validation;
  const { research } = state;
  state.city.economy.resources.knowledge += research.investedKnowledge;
  research.activeTechnologyId = technologyId;
  research.investedKnowledge = 0;
  return validation;
}

/**
 * Krok 9: do aktívnej technológie sa investujú dostupné vedomosti (najviac zvyšok ceny).
 * Vráti ID dokončenej technológie alebo null.
 */
export function advanceResearch(state: GameState, data: GameData): string | null {
  const { research } = state;
  const technology = research.activeTechnologyId
    ? data.technologiesById.get(research.activeTechnologyId)
    : undefined;
  if (!technology) return null;

  const resources = state.city.economy.resources;
  const invest = Math.min(resources.knowledge, technology.cost - research.investedKnowledge);
  resources.knowledge -= invest;
  research.investedKnowledge += invest;

  if (research.investedKnowledge >= technology.cost) {
    research.completedTechnologyIds.push(technology.id);
    research.activeTechnologyId = null;
    research.investedKnowledge = 0;
    return technology.id;
  }
  return null;
}
