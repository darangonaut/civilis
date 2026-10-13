import {
  RESOURCE_IDS,
  type GameState,
  type MilestoneCondition,
  type MilestoneDefinition,
} from '@/types';
import type { GameData } from '../core/definitions';

/** Kľúč počítadla po sebe idúcich dní pre podmienku míľnika. */
export function progressKey(milestoneId: string, conditionIndex: number): string {
  return `${milestoneId}:${conditionIndex}`;
}

/** Najbližší nesplnený míľnik (míľniky sa plnia v poradí z `milestones.json`). */
export function currentMilestone(
  state: Readonly<GameState>,
  data: GameData,
): MilestoneDefinition | null {
  return data.milestones.find((m) => !state.milestones.completedIds.includes(m.id)) ?? null;
}

export interface ConditionProgress {
  /** Aktuálna hodnota sledovanej veličiny. */
  current: number;
  /** Požadovaná hodnota. */
  target: number;
  metToday: boolean;
  /** Koľko po sebe idúcich dní je podmienka splnená / koľko treba. */
  days: number;
  requiredDays: number;
}

function conditionValue(state: Readonly<GameState>, data: GameData, condition: MilestoneCondition) {
  const { city, research } = state;
  switch (condition.type) {
    case 'population':
      return { current: city.population.total, target: condition.minimum };
    case 'happiness':
      return { current: city.population.happiness, target: condition.minimum };
    case 'building_count':
      return {
        current: city.buildings.filter((b) => b.definitionId === condition.buildingId).length,
        target: condition.minimum,
      };
    case 'building_level':
      return {
        current: city.buildings.filter(
          (b) => b.definitionId === condition.buildingId && b.level >= condition.level,
        ).length,
        target: condition.minimum,
      };
    case 'completed_research':
      return { current: research.completedTechnologyIds.length, target: condition.minimum };
    case 'all_research_completed':
      return {
        current: data.technologies.filter((t) => research.completedTechnologyIds.includes(t.id))
          .length,
        target: data.technologies.length,
      };
    case 'resource_balance':
      return {
        current:
          (city.economy.dailyProduction[condition.resource] ?? 0) -
          (city.economy.dailyConsumption[condition.resource] ?? 0),
        target: condition.minimum,
      };
    case 'money_balance':
      return {
        current: city.economy.dailyIncome - city.economy.dailyExpenses,
        target: condition.minimum,
      };
  }
}

/** Či je podmienka splnená práve dnes (bez ohľadu na počet dní). */
export function isConditionMetToday(
  state: Readonly<GameState>,
  data: GameData,
  condition: MilestoneCondition,
): boolean {
  const { current, target } = conditionValue(state, data, condition);
  return current >= target;
}

/** Priebeh podmienky míľnika pre UI. */
export function conditionProgress(
  state: Readonly<GameState>,
  data: GameData,
  milestoneId: string,
  conditionIndex: number,
  condition: MilestoneCondition,
): ConditionProgress {
  const metToday = isConditionMetToday(state, data, condition);
  const required = requiredDays(condition);
  const days =
    required > 1
      ? (state.milestones.progressDays[progressKey(milestoneId, conditionIndex)] ?? 0)
      : metToday
        ? 1
        : 0;
  return { ...conditionValue(state, data, condition), metToday, days, requiredDays: required };
}

/** Počet po sebe idúcich dní, ktoré podmienka vyžaduje (1 = stačí splniť raz). */
export function requiredDays(condition: MilestoneCondition): number {
  return 'consecutiveDays' in condition && condition.consecutiveDays
    ? condition.consecutiveDays
    : 1;
}

/**
 * Krok 10: aktualizuje počítadlá dní aktuálneho míľnika a ak sú splnené všetky podmienky,
 * označí ho za splnený a pripíše odmenu (presne raz). Vráti ID splneného míľnika alebo null.
 */
export function evaluateMilestones(state: GameState, data: GameData): string | null {
  const milestone = currentMilestone(state, data);
  if (!milestone) return null;

  const progress = state.milestones.progressDays;
  let allMet = true;
  milestone.conditions.forEach((condition, index) => {
    const key = progressKey(milestone.id, index);
    const days = isConditionMetToday(state, data, condition) ? (progress[key] ?? 0) + 1 : 0;
    if (requiredDays(condition) > 1) progress[key] = days;
    if (days < requiredDays(condition)) allMet = false;
  });
  if (!allMet) return null;

  state.milestones.completedIds.push(milestone.id);
  milestone.conditions.forEach((_, index) => delete progress[progressKey(milestone.id, index)]);
  const { resources } = milestone.rewards;
  if (resources) {
    for (const id of RESOURCE_IDS) state.city.economy.resources[id] += resources[id] ?? 0;
  }
  state.city.economy.money += milestone.rewards.money ?? 0;
  return milestone.id;
}
