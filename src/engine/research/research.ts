import { difficultyOf } from '../core/colony';
import type { CommandResult, GameState } from '@/types';
import type { CommandFailureReason } from '../core/commandReasons';
import type { GameData } from '../core/definitions';
import { isEraUnlocked } from '../milestones/eras';
import { scaleAmount } from '../core/levels';

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
  research.queue = research.queue.filter((id) => id !== technologyId);
  return validation;
}

/** Najviac toľko technológií v poradí. */
export const MAX_RESEARCH_QUEUE = 10;

/**
 * SET_RESEARCH_QUEUE: nové poradie. Technológie musia existovať, byť z odomknutej éry,
 * ešte nepreskúmané a mať prerekvizity splnené už teraz, aktívnou technológiou alebo
 * skoršou položkou poradia.
 */
export function setResearchQueue(
  state: GameState,
  data: GameData,
  technologyIds: string[],
): CommandResult {
  if (
    technologyIds.length > MAX_RESEARCH_QUEUE ||
    new Set(technologyIds).size !== technologyIds.length
  ) {
    return fail('invalid_queue');
  }
  const { research } = state;
  const known = new Set(research.completedTechnologyIds);
  if (research.activeTechnologyId) known.add(research.activeTechnologyId);
  for (const id of technologyIds) {
    const technology = data.technologiesById.get(id);
    if (!technology) return fail('unknown_technology');
    if (known.has(id)) return fail('technology_completed');
    if (!isEraUnlocked(state, data, technology.era)) return fail('era_locked');
    if (!technology.prerequisites.every((p) => known.has(p))) return fail('prerequisites_missing');
    known.add(id);
  }
  research.queue = [...technologyIds];
  return { success: true };
}

/** Začne prvú technológiu z poradia, ktorú možno skúmať (ostatné ostávajú čakať). */
function startNextFromQueue(state: GameState, data: GameData): void {
  const { research } = state;
  research.queue = research.queue.filter((id) => !research.completedTechnologyIds.includes(id));
  const next = research.queue.find((id) => validateResearch(state, data, id).success);
  if (next) startResearch(state, data, next);
}

/**
 * Krok 9: do aktívnej technológie sa investujú dostupné vedomosti (najviac zvyšok ceny).
 * Vráti ID dokončenej technológie alebo null.
 */
export function advanceResearch(state: GameState, data: GameData): string | null {
  const { research } = state;
  if (!research.activeTechnologyId && research.queue.length > 0) startNextFromQueue(state, data);
  const technology = research.activeTechnologyId
    ? data.technologiesById.get(research.activeTechnologyId)
    : undefined;
  if (!technology) return null;
  const cost = scaleAmount(technology.cost, difficultyOf(state, data).researchCost);

  const resources = state.city.economy.resources;
  const invest = Math.min(resources.knowledge, cost - research.investedKnowledge);
  resources.knowledge -= invest;
  research.investedKnowledge += invest;

  if (research.investedKnowledge >= cost) {
    research.completedTechnologyIds.push(technology.id);
    research.activeTechnologyId = null;
    research.investedKnowledge = 0;
    startNextFromQueue(state, data);
    return technology.id;
  }
  return null;
}
