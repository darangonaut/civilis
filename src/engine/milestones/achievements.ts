import type { AchievementCondition, GameState } from '@/types';
import type { GameData } from '../core/definitions';
import { currentEraIndex } from './eras';

export interface AchievementProgress {
  current: number;
  target: number;
  done: boolean;
}

/** Priebeh podmienky úspechu (pre UI aj vyhodnotenie). */
export function achievementProgress(
  state: Readonly<GameState>,
  data: GameData,
  condition: AchievementCondition,
): AchievementProgress {
  const city = state.city;
  const at = (current: number) => ({
    current,
    target: condition.minimum,
    done: current >= condition.minimum,
  });
  switch (condition.type) {
    case 'population':
      return at(city.population.total);
    case 'completed_research':
      return at(state.research.completedTechnologyIds.length);
    case 'happiness':
      return at(Math.round(city.population.happiness));
    case 'money':
      return at(Math.floor(city.economy.money));
    case 'trade_earned':
      return at(Math.floor(state.trade.earned));
    case 'wonder_count':
      return at(
        city.buildings.filter((b) => data.buildingsById.get(b.definitionId)?.wonder).length,
      );
    case 'building_count':
      return at(city.buildings.filter((b) => b.definitionId === condition.buildingId).length);
    case 'building_level':
      return at(
        city.buildings.filter(
          (b) => b.definitionId === condition.buildingId && b.level >= condition.level,
        ).length,
      );
    case 'era':
      return at(currentEraIndex(state, data));
    case 'finished_before_day': {
      const day = state.achievements.finishedDay;
      return {
        current: day ?? 0,
        target: condition.minimum,
        done: day !== null && day <= condition.minimum,
      };
    }
  }
}

/** Splní nové úspechy a vráti ich ID (v poradí z dát). */
export function evaluateAchievements(state: GameState, data: GameData): string[] {
  const unlocked: string[] = [];
  for (const achievement of data.achievements) {
    if (state.achievements.completedIds.includes(achievement.id)) continue;
    if (achievementProgress(state, data, achievement.condition).done) {
      state.achievements.completedIds.push(achievement.id);
      unlocked.push(achievement.id);
    }
  }
  return unlocked;
}

/** Skóre mesta: obyvatelia, výskum, míľniky, divy, úspechy a obchod. */
export function cityScore(state: Readonly<GameState>, data: GameData): number {
  const wonders = state.city.buildings.filter(
    (b) => data.buildingsById.get(b.definitionId)?.wonder,
  ).length;
  return Math.floor(
    state.city.population.total +
      state.research.completedTechnologyIds.length * 20 +
      state.milestones.completedIds.length * 150 +
      wonders * 300 +
      state.achievements.completedIds.length * 100 +
      state.trade.earned / 100,
  );
}
