import {
  RESOURCE_IDS,
  SIMULATION_SPEEDS,
  type CommandResult,
  type GameCommand,
  type GameState,
  type Position,
} from '@/types';
import { footprint, getTile, isInBounds, tileIndex } from '../world/grid';
import { refreshDerivedState } from '../economy/analysis';
import { startResearch } from '../research/research';
import { upgradeBuilding } from './upgrade';
import type { CommandFailureReason } from './commandReasons';
import {
  DEFAULT_BUILDING_PRIORITY,
  MAX_BUILDING_PRIORITY,
  MIN_BUILDING_PRIORITY,
} from './constants';
import type { GameData } from './definitions';

const ok: CommandResult = { success: true };
const fail = (reason: CommandFailureReason): CommandResult => ({ success: false, reason });

/**
 * Overí, či sa dá budova postaviť. Nemení stav — používa sa aj na náhľad v režime výstavby.
 */
export function validatePlacement(
  state: Readonly<GameState>,
  data: GameData,
  buildingId: string,
  position: Position,
): CommandResult {
  const definition = data.buildingsById.get(buildingId);
  if (!definition) return fail('unknown_building');

  const tiles = footprint(definition, position);
  if (!tiles.every((p) => isInBounds(state.world, p.x, p.y))) return fail('out_of_bounds');
  if (tiles.some((p) => getTile(state.world, p.x, p.y)!.buildingId !== undefined)) {
    return fail('tile_occupied');
  }
  if (
    !tiles.every((p) => definition.allowedTerrain.includes(getTile(state.world, p.x, p.y)!.terrain))
  ) {
    return fail('invalid_terrain');
  }
  if (
    definition.requiredTechnologyId &&
    !state.research.completedTechnologyIds.includes(definition.requiredTechnologyId)
  ) {
    return fail('technology_required');
  }
  const resources = state.city.economy.resources;
  if (RESOURCE_IDS.some((id) => (definition.constructionCost[id] ?? 0) > resources[id])) {
    return fail('insufficient_resources');
  }
  return ok;
}

/** Ďalšie voľné ID inštancie (`b<n>`), deterministicky odvodené zo stavu. */
function nextInstanceId(state: GameState): string {
  let max = 0;
  for (const building of state.city.buildings) {
    const n = Number(building.id.slice(1));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `b${max + 1}`;
}

function placeBuilding(
  state: GameState,
  data: GameData,
  buildingId: string,
  position: Position,
): CommandResult {
  const validation = validatePlacement(state, data, buildingId, position);
  if (!validation.success) return validation;

  const definition = data.buildingsById.get(buildingId)!;
  const resources = state.city.economy.resources;
  for (const id of RESOURCE_IDS) resources[id] -= definition.constructionCost[id] ?? 0;

  const instance = {
    id: nextInstanceId(state),
    definitionId: buildingId,
    position: { x: position.x, y: position.y },
    enabled: true,
    priority: DEFAULT_BUILDING_PRIORITY,
    level: 1,
  };
  state.city.buildings.push(instance);
  for (const p of footprint(definition, position)) {
    state.world.tiles[tileIndex(state.world, p.x, p.y)]!.buildingId = instance.id;
  }
  refreshDerivedState(state, data);
  return ok;
}

function demolishBuilding(state: GameState, data: GameData, instanceId: string): CommandResult {
  const index = state.city.buildings.findIndex((b) => b.id === instanceId);
  const instance = state.city.buildings[index];
  if (!instance) return fail('unknown_instance');

  if (instance.definitionId === 'warehouse') {
    const warehouses = state.city.buildings.filter((b) => b.definitionId === 'warehouse').length;
    if (warehouses <= 1) return fail('last_warehouse');
  }

  const definition = data.buildingsById.get(instance.definitionId);
  const size = definition ?? { size: { width: 1, height: 1 } };
  for (const p of footprint(size, instance.position)) {
    const tile = getTile(state.world, p.x, p.y);
    if (tile?.buildingId === instance.id) delete tile.buildingId;
  }
  state.city.buildings.splice(index, 1);
  refreshDerivedState(state, data);
  return ok;
}

function setBuildingPriority(
  state: GameState,
  instanceId: string,
  priority: number,
): CommandResult {
  const instance = state.city.buildings.find((b) => b.id === instanceId);
  if (!instance) return fail('unknown_instance');
  if (
    !Number.isInteger(priority) ||
    priority < MIN_BUILDING_PRIORITY ||
    priority > MAX_BUILDING_PRIORITY
  ) {
    return fail('invalid_priority');
  }
  instance.priority = priority;
  return ok;
}

/**
 * Vykoná príkaz. Každá vetva najprv celý príkaz zvaliduje a až potom mení stav,
 * takže neplatný príkaz stav nikdy nezmení.
 */
export function executeCommand(
  state: GameState,
  data: GameData,
  command: GameCommand,
): CommandResult {
  switch (command.type) {
    case 'PLACE_BUILDING':
      return placeBuilding(state, data, command.buildingId, command.position);
    case 'DEMOLISH_BUILDING':
      return demolishBuilding(state, data, command.instanceId);
    case 'SET_BUILDING_PRIORITY':
      return setBuildingPriority(state, command.instanceId, command.priority);
    case 'SET_SPEED':
      if (!(SIMULATION_SPEEDS as readonly number[]).includes(command.speed))
        return fail('invalid_speed');
      state.simulation.speed = command.speed;
      return ok;
    case 'START_RESEARCH':
      return startResearch(state, data, command.technologyId);
    case 'SET_BUILDING_ENABLED': {
      const instance = state.city.buildings.find((b) => b.id === command.instanceId);
      if (!instance) return fail('unknown_instance');
      instance.enabled = command.enabled;
      refreshDerivedState(state, data);
      return ok;
    }
    case 'UPGRADE_BUILDING':
      return upgradeBuilding(state, data, command.instanceId);
  }
}
