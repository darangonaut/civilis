import { RESOURCE_IDS, type GameState, type Resources } from '@/types';
import type { GameEvent } from '../core/events';
import type { GameData } from '../core/definitions';
import { currentEraIndex } from '../milestones/eras';
import { evaluateMilestones } from '../milestones/milestones';
import { evaluateAchievements } from '../milestones/achievements';
import { simulatePopulation } from '../population/population';
import { advanceResearch } from '../research/research';
import { UNCAPPED_RESOURCES, analyzeCity, refreshDerivedState } from './analysis';
import { autoSell } from './trade';

function addTo(target: Partial<Resources>, source: Partial<Resources>): void {
  for (const id of RESOURCE_IDS) {
    const amount = source[id] ?? 0;
    if (amount > 0) target[id] = (target[id] ?? 0) + amount;
  }
}

/** Jeden herný deň v pevnom poradí zo špecifikácie 2.4. Vráti udalosti pre UI. */
export function simulateDay(state: GameState, data: GameData): GameEvent[] {
  const events: GameEvent[] = [];
  const economy = state.city.economy;

  // 1.–4. Pripojenie, pracovníci, kapacita, rezervácia vstupov.
  const analysis = analyzeCity(state, data);
  const resources: Resources = { ...analysis.resourcesAfterInputs };
  const production: Partial<Resources> = {};
  const consumption: Partial<Resources> = {};

  // 5. Výroba, orezaná kapacitou skladu (už preplnený sklad sa neznižuje).
  addTo(production, data.balance.baseProduction);
  for (const status of analysis.statuses.values()) {
    addTo(consumption, status.consumed);
    addTo(production, status.produced);
  }
  for (const id of RESOURCE_IDS) {
    const produced = production[id] ?? 0;
    if (produced <= 0) continue;
    const current = resources[id];
    resources[id] = UNCAPPED_RESOURCES.has(id)
      ? current + produced
      : Math.max(current, Math.min(analysis.storageCapacity, current + produced));
  }

  // 6. Spotreba potravín obyvateľmi.
  const foodNeeded = state.city.population.total * data.balance.foodPerCapita;
  const foodEaten = Math.min(resources.food, foodNeeded);
  resources.food -= foodEaten;
  if (foodEaten > 0) consumption.food = (consumption.food ?? 0) + foodEaten;
  const foodSatisfaction = foodNeeded > 0 ? foodEaten / foodNeeded : 1;
  if (foodSatisfaction < 1) events.push({ type: 'food_shortage' });

  for (const id of RESOURCE_IDS) resources[id] = Math.max(0, resources[id]);
  economy.resources = resources;
  economy.dailyProduction = production;
  economy.dailyConsumption = consumption;

  // 6b. Automatický predaj prebytkov (rozšírenie: obchod).
  const tradeIncome = autoSell(state, data);

  // 7. Spokojnosť a rast populácie.
  const populationBefore = state.city.population.total;
  simulatePopulation(state, data, analysis, foodSatisfaction);
  const populationDelta = state.city.population.total - populationBefore;
  if (populationDelta !== 0) events.push({ type: 'population_changed', delta: populationDelta });

  // 8. Peniaze: príjem z trhovísk, údržba (pokladnica neklesne pod nulu).
  economy.money = Math.max(0, economy.money + analysis.moneyIncome - analysis.maintenanceTotal);
  economy.dailyIncome = analysis.moneyIncome + tradeIncome;
  economy.dailyExpenses = analysis.maintenanceTotal;

  // 9. Výskum.
  const technologyId = advanceResearch(state, data);
  if (technologyId) events.push({ type: 'research_completed', technologyId });

  // 10. Civilizačné míľniky.
  const eraBefore = currentEraIndex(state, data);
  const milestoneId = evaluateMilestones(state, data);
  if (milestoneId) events.push({ type: 'milestone_completed', milestoneId });
  if (milestoneId && milestoneId === data.milestones.at(-1)?.id) {
    state.achievements.finishedDay = state.simulation.day + 1;
  }
  const eraAfter = currentEraIndex(state, data);
  if (eraAfter > eraBefore) events.push({ type: 'era_reached', eraId: data.eras[eraAfter]!.id });

  state.simulation.day += 1;
  refreshDerivedState(state, data);

  // 11. Úspechy (rozšírenie) — po prepočte, aby videli aktuálny stav.
  for (const achievementId of evaluateAchievements(state, data))
    events.push({ type: 'achievement_unlocked', achievementId });
  return events;
}
