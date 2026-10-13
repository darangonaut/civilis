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

/** Či je podmienka splnená práve dnes (bez ohľadu na počet dní). */
export function isConditionMetToday(
  state: Readonly<GameState>,
  data: GameData,
  condition: MilestoneCondition,
): boolean {
  const { city, research } = state;
  switch (condition.type) {
    case 'population':
      return city.population.total >= condition.minimum;
    case 'happiness':
      return city.population.happiness >= condition.minimum;
    case 'building_count':
      return (
        city.buildings.filter((b) => b.definitionId === condition.buildingId).length >=
        condition.minimum
      );
    case 'completed_research':
      return research.completedTechnologyIds.length >= condition.minimum;
    case 'all_research_completed':
      return data.technologies.every((t) => research.completedTechnologyIds.includes(t.id));
    case 'resource_balance': {
      const { dailyProduction, dailyConsumption } = city.economy;
      const balance =
        (dailyProduction[condition.resource] ?? 0) - (dailyConsumption[condition.resource] ?? 0);
      return balance >= condition.minimum;
    }
    case 'money_balance':
      return city.economy.dailyIncome - city.economy.dailyExpenses >= condition.minimum;
  }
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
