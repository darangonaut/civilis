import { describe, expect, it } from 'vitest';
import {
  START_AREA_SIZE,
  START_RESOURCE_MINIMUM,
  START_RESOURCE_RADIUS,
  countTerrainNear,
  generateWorld,
  getStartAreaOrigin,
  getStartCenter,
} from '@/engine/world/generateWorld';
import { getTile } from '@/engine/world/grid';
import type { TerrainType } from '@/types';

describe('generátor mapy', () => {
  it('je deterministický', () => {
    expect(generateWorld(42, 64, 64)).toEqual(generateWorld(42, 64, 64));
  });

  it('rôzne seedy dajú rôzne mapy', () => {
    const a = generateWorld(1, 64, 64).tiles.map((t) => t.terrain);
    const b = generateWorld(2, 64, 64).tiles.map((t) => t.terrain);
    expect(a).not.toEqual(b);
  });

  it('vytvorí mapu požadovanej veľkosti s platnými políčkami', () => {
    const world = generateWorld(5, 64, 48);
    expect(world.tiles).toHaveLength(64 * 48);
    for (const tile of world.tiles) {
      expect(tile.fertility).toBeGreaterThanOrEqual(0);
      expect(tile.fertility).toBeLessThanOrEqual(100);
      expect(tile.buildingId).toBeUndefined();
    }
  });

  it('obsahuje všetky typy terénu', () => {
    const terrains = new Set(generateWorld(9, 64, 64).tiles.map((t) => t.terrain));
    expect([...terrains].sort()).toEqual(['fertile', 'forest', 'grass', 'hill', 'rock', 'water']);
  });

  it('podporuje mapu 256 × 256 bez zmeny modelu', () => {
    const world = generateWorld(3, 256, 256);
    expect(world.tiles).toHaveLength(256 * 256);
  });

  it('na 100 seedoch garantuje štartovaciu oblasť a suroviny', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const world = generateWorld(seed, 64, 64);
      const origin = getStartAreaOrigin(world);
      for (let y = origin.y; y < origin.y + START_AREA_SIZE; y++) {
        for (let x = origin.x; x < origin.x + START_AREA_SIZE; x++) {
          const terrain = getTile(world, x, y)!.terrain;
          expect(['water', 'hill'], `seed ${seed} [${x},${y}]`).not.toContain(terrain);
        }
      }
      const center = getStartCenter(world);
      for (const [terrain, minimum] of Object.entries(START_RESOURCE_MINIMUM)) {
        expect(
          countTerrainNear(world, center, START_RESOURCE_RADIUS, terrain as TerrainType),
          `seed ${seed} ${terrain}`,
        ).toBeGreaterThanOrEqual(minimum);
      }
    }
  });
});
