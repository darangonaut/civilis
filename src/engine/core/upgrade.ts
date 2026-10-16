import {
  RESOURCE_IDS,
  type BuildingInstance,
  type BuildingLevelDefinition,
  type CommandResult,
  type GameState,
  type Resources,
  type ServiceType,
} from '@/types';
import { analyzeCity, refreshDerivedState, type CityAnalysis } from '../economy/analysis';
import { isBuildingCovered, serviceCoverageGrid } from '../population/population';
import type { CommandFailureReason } from './commandReasons';
import type { GameData } from './definitions';
import { effectiveDefinition, nextLevel, scaleCost } from './levels';

export interface UpgradeRequirements {
  next: BuildingLevelDefinition;
  technologyMet: boolean;
  services: { type: ServiceType; met: boolean }[];
  affordable: boolean;
  /** Cena vylepšenia po obtiažnosti. */
  cost: Partial<Resources>;
}

/**
 * Požiadavky na vylepšenie budovy na ďalšiu úroveň (null = už je na maxime).
 * `analysis` a mriežky pokrytia sa dajú podať zvonka, ak sa vyhodnocuje viac budov naraz.
 */
export function upgradeRequirements(
  state: Readonly<GameState>,
  data: GameData,
  building: BuildingInstance,
  analysis: CityAnalysis = analyzeCity(state, data),
  grids: Partial<Record<ServiceType, Uint8Array>> = {},
): UpgradeRequirements | null {
  const base = data.buildingsById.get(building.definitionId);
  const next = base && nextLevel(base, building.level);
  if (!base || !next) return null;

  const definition = effectiveDefinition(base, building.level);
  const services = (next.requiredServices ?? []).map((type) => {
    const grid = (grids[type] ??= serviceCoverageGrid(state, data, analysis, type));
    return { type, met: isBuildingCovered(state, definition, building, grid) };
  });
  const resources = state.city.economy.resources;
  const cost = scaleCost(
    next.upgradeCost,
    data.balance.difficulties[state.difficulty].constructionCost,
  );
  return {
    next,
    technologyMet:
      !next.requiredTechnologyId ||
      state.research.completedTechnologyIds.includes(next.requiredTechnologyId),
    services,
    affordable: RESOURCE_IDS.every((id) => (cost[id] ?? 0) <= resources[id]),
    cost,
  };
}

const fail = (reason: CommandFailureReason): CommandResult => ({ success: false, reason });

export function validateUpgrade(
  state: Readonly<GameState>,
  data: GameData,
  instanceId: string,
): CommandResult {
  const building = state.city.buildings.find((b) => b.id === instanceId);
  if (!building) return fail('unknown_instance');
  const requirements = upgradeRequirements(state, data, building);
  if (!requirements) return fail('max_level');
  if (!requirements.technologyMet) return fail('technology_required');
  if (requirements.services.some((s) => !s.met)) return fail('service_required');
  if (!requirements.affordable) return fail('insufficient_resources');
  return { success: true };
}

/** UPGRADE_BUILDING: najprv celá validácia, potom zaplatenie a zvýšenie úrovne. */
export function upgradeBuilding(
  state: GameState,
  data: GameData,
  instanceId: string,
): CommandResult {
  const validation = validateUpgrade(state, data, instanceId);
  if (!validation.success) return validation;
  const building = state.city.buildings.find((b) => b.id === instanceId)!;
  const next = nextLevel(data.buildingsById.get(building.definitionId)!, building.level)!;
  const cost = scaleCost(
    next.upgradeCost,
    data.balance.difficulties[state.difficulty].constructionCost,
  );
  for (const id of RESOURCE_IDS) state.city.economy.resources[id] -= cost[id] ?? 0;
  building.level += 1;
  refreshDerivedState(state, data);
  return validation;
}

/** ID budov, ktoré sa dajú práve teraz vylepšiť (pre značky na mape). */
export function upgradableBuildings(
  state: Readonly<GameState>,
  data: GameData,
  analysis: CityAnalysis,
): Set<string> {
  const grids: Partial<Record<ServiceType, Uint8Array>> = {};
  const result = new Set<string>();
  for (const building of state.city.buildings) {
    const r = upgradeRequirements(state, data, building, analysis, grids);
    if (r && r.technologyMet && r.affordable && r.services.every((s) => s.met))
      result.add(building.id);
  }
  return result;
}
