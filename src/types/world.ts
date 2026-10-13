import type { ResourceId } from './resources';

export const TERRAIN_TYPES = ['grass', 'forest', 'fertile', 'rock', 'water', 'hill'] as const;

export type TerrainType = (typeof TERRAIN_TYPES)[number];

export interface Position {
  x: number;
  y: number;
}

export interface Tile {
  terrain: TerrainType;
  fertility: number; // 0-100
  resourceDeposit?: ResourceId;
  buildingId?: string;
}

/** Políčka sú v jednorozmernom poli, index = y * width + x. */
export interface World {
  seed: number;
  width: number;
  height: number;
  tiles: Tile[];
}
