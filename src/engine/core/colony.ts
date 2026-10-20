import type { GameState, Resources } from '@/types';
import type { GameData, LegacyDefinition } from './definitions';

export type DifficultyFactors = GameData['balance']['difficulties']['normal'];

/** Zdedené výhody kolónie v poradí, v akom ich hráč získal. */
export function activeLegacies(
  state: Pick<GameState, 'colony'>,
  data: GameData,
): LegacyDefinition[] {
  return state.colony.legacyIds.flatMap((id) => data.legacies.find((l) => l.id === id) ?? []);
}

/** Násobiče obtiažnosti vrátane zdedených výhod kolónie (stavby, výskum, údržba). */
export function difficultyOf(
  state: Pick<GameState, 'difficulty' | 'colony'>,
  data: GameData,
): DifficultyFactors {
  const preset = data.balance.difficulties[state.difficulty];
  const legacies = activeLegacies(state, data);
  if (legacies.length === 0) return preset;
  const product = (key: 'constructionCost' | 'researchCost' | 'maintenance') =>
    legacies.reduce((factor, legacy) => factor * (legacy[key] ?? 1), preset[key]);
  return {
    ...preset,
    constructionCost: product('constructionCost'),
    researchCost: product('researchCost'),
    maintenance: product('maintenance'),
  };
}

export type ColonyLaunchBlock = 'not_finished' | 'missing_building' | 'resources' | 'no_colony';

/** Prečo sa ešte nedá vyslať kolonizačná loď (null = dá sa). */
export function colonyLaunchBlock(
  state: Readonly<GameState>,
  data: GameData,
): ColonyLaunchBlock | null {
  const colony = data.colony;
  if (!colony) return 'no_colony';
  if (state.achievements.finishedDay === null) return 'not_finished';
  if (!state.city.buildings.some((b) => b.definitionId === colony.requiredBuilding))
    return 'missing_building';
  const resources = state.city.economy.resources;
  for (const [resource, amount] of Object.entries(colony.launchCost) as [
    keyof Resources,
    number,
  ][]) {
    if (resources[resource] < amount) return 'resources';
  }
  return null;
}

/** Výhody, ktoré si kolónia ešte môže vybrať (každú najviac raz). */
export function availableLegacies(
  state: Pick<GameState, 'colony'>,
  data: GameData,
): LegacyDefinition[] {
  return data.legacies.filter((l) => !state.colony.legacyIds.includes(l.id));
}
