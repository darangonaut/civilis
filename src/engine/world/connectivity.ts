import type { BuildingInstance, GameState } from '@/types';
import type { GameData } from '../core/definitions';
import { footprint, neighbors4, tileIndex } from './grid';

const WAREHOUSE_ID = 'warehouse';

function isRoadTile(
  state: Readonly<GameState>,
  roadIds: ReadonlySet<string>,
  index: number,
): boolean {
  const buildingId = state.world.tiles[index]?.buildingId;
  return buildingId !== undefined && roadIds.has(buildingId);
}

/**
 * Vráti indexy políčok ciest, ktoré patria do mestskej siete. Sieť začína cestami
 * susediacimi so skladom a šíri sa cez 4-okolie (BFS).
 */
export function computeRoadNetwork(state: Readonly<GameState>, data: GameData): Set<number> {
  const world = state.world;
  const roadIds = new Set(
    state.city.buildings
      .filter((b) => data.buildingsById.get(b.definitionId)?.isRoad)
      .map((b) => b.id),
  );
  const network = new Set<number>();
  const queue: number[] = [];

  for (const building of state.city.buildings) {
    if (building.definitionId !== WAREHOUSE_ID) continue;
    const definition = data.buildingsById.get(WAREHOUSE_ID)!;
    for (const tile of footprint(definition, building.position)) {
      for (const n of neighbors4(world, tile)) {
        const index = tileIndex(world, n.x, n.y);
        if (isRoadTile(state, roadIds, index) && !network.has(index)) {
          network.add(index);
          queue.push(index);
        }
      }
    }
  }

  for (let head = 0; head < queue.length; head++) {
    const index = queue[head]!;
    const position = { x: index % world.width, y: Math.floor(index / world.width) };
    for (const n of neighbors4(world, position)) {
      const next = tileIndex(world, n.x, n.y);
      if (!network.has(next) && isRoadTile(state, roadIds, next)) {
        network.add(next);
        queue.push(next);
      }
    }
  }
  return network;
}

/**
 * ID všetkých funkčne pripojených budov. Budova s `connectsAdjacent` (polia, lesy, lomy) je
 * pripojená aj vtedy, keď susedí s pripojenou budovou rovnakého typu — celý blok fariem tak
 * stačí napojiť na cestu v jednom bode.
 */
export function computeConnectedBuildings(
  state: Readonly<GameState>,
  data: GameData,
  network: ReadonlySet<number>,
): Set<string> {
  const connected = new Set<string>();
  const queue: BuildingInstance[] = [];
  for (const building of state.city.buildings) {
    if (isBuildingConnected(state, data, network, building)) {
      connected.add(building.id);
      if (data.buildingsById.get(building.definitionId)?.connectsAdjacent) queue.push(building);
    }
  }
  const byId = new Map(state.city.buildings.map((b) => [b.id, b]));
  for (let head = 0; head < queue.length; head++) {
    const building = queue[head]!;
    const definition = data.buildingsById.get(building.definitionId)!;
    for (const tile of footprint(definition, building.position)) {
      for (const n of neighbors4(state.world, tile)) {
        const neighborId = state.world.tiles[tileIndex(state.world, n.x, n.y)]?.buildingId;
        const neighbor = neighborId ? byId.get(neighborId) : undefined;
        if (
          !neighbor ||
          connected.has(neighbor.id) ||
          neighbor.definitionId !== building.definitionId
        )
          continue;
        connected.add(neighbor.id);
        queue.push(neighbor);
      }
    }
  }
  return connected;
}

/** Či je budova priamo pripojená: nepotrebuje cestu, alebo susedí s cestou zo siete. */
export function isBuildingConnected(
  state: Readonly<GameState>,
  data: GameData,
  network: ReadonlySet<number>,
  building: BuildingInstance,
): boolean {
  const definition = data.buildingsById.get(building.definitionId);
  if (!definition) return false;
  if (definition.isRoad) {
    return network.has(tileIndex(state.world, building.position.x, building.position.y));
  }
  if (!definition.requiresRoad) return true;
  return footprint(definition, building.position).some((tile) =>
    neighbors4(state.world, tile).some((n) => network.has(tileIndex(state.world, n.x, n.y))),
  );
}
