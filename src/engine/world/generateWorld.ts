import type { Position, TerrainType, Tile, World } from '@/types';
import { createRng, hash2, randomInt } from '../core/random';
import { getTile, isInBounds, tileIndex } from './grid';

/** Strana garantovanej štartovacej oblasti (12 × 12 políčok). */
export const START_AREA_SIZE = 12;
/** Do akej Chebyševovej vzdialenosti od stredu musia byť dostupné suroviny. */
export const START_RESOURCE_RADIUS = 10;
/** Minimálny počet políčok daného terénu v okolí štartu. */
export const START_RESOURCE_MINIMUM: Partial<Record<TerrainType, number>> = {
  forest: 8,
  rock: 4,
  fertile: 8,
};

const UNBUILDABLE: ReadonlySet<TerrainType> = new Set(['water', 'hill']);

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Bilineárne interpolovaný value noise v [0, 1). */
function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

/** Fraktálny šum (súčet oktáv). */
function fbm(x: number, y: number, seed: number, scale: number, octaves = 4): number {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1 / scale;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave++) {
    sum += valueNoise(x * frequency, y * frequency, seed + octave * 1013) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / norm;
}

/**
 * Prevedie hodnoty na percentily (0 = najnižšia, 1 = najvyššia). Vďaka tomu majú všetky
 * mapy rovnaké zastúpenie terénov bez ohľadu na rozptyl šumu.
 */
function toPercentiles(values: Float64Array): Float64Array {
  const order = Array.from(values.keys()).sort((a, b) => values[a]! - values[b]! || a - b);
  const result = new Float64Array(values.length);
  const last = Math.max(1, values.length - 1);
  order.forEach((index, rank) => {
    result[index] = rank / last;
  });
  return result;
}

function sampleField(width: number, height: number, seed: number, scale: number): Float64Array {
  const field = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      field[y * width + x] = fbm(x, y, seed, scale);
    }
  }
  return toPercentiles(field);
}

function classify(elevation: number, moisture: number, rockiness: number): TerrainType {
  if (elevation < 0.12) return 'water';
  if (elevation > 0.93) return 'hill';
  if (rockiness > 0.9) return 'rock';
  if (moisture > 0.72) return 'forest';
  if (moisture > 0.52) return 'fertile';
  return 'grass';
}

function fertilityFor(terrain: TerrainType, moisture: number): number {
  switch (terrain) {
    case 'fertile':
      return Math.round(70 + moisture * 30);
    case 'grass':
      return Math.round(30 + moisture * 30);
    case 'forest':
      return 40;
    case 'hill':
      return 10;
    case 'rock':
      return 5;
    case 'water':
      return 0;
  }
}

function makeTile(terrain: TerrainType, fertility: number): Tile {
  const tile: Tile = { terrain, fertility };
  if (terrain === 'forest') tile.resourceDeposit = 'wood';
  if (terrain === 'rock') tile.resourceDeposit = 'stone';
  return tile;
}

function setTerrain(world: World, x: number, y: number, terrain: TerrainType): void {
  if (!isInBounds(world, x, y)) return;
  const fertility = terrain === 'fertile' ? 85 : fertilityFor(terrain, 0.5);
  world.tiles[tileIndex(world, x, y)] = makeTile(terrain, fertility);
}

export function getStartCenter(world: Pick<World, 'width' | 'height'>): Position {
  return { x: Math.floor(world.width / 2), y: Math.floor(world.height / 2) };
}

/** Ľavý horný roh garantovanej štartovacej oblasti. */
export function getStartAreaOrigin(world: Pick<World, 'width' | 'height'>): Position {
  const center = getStartCenter(world);
  return { x: center.x - START_AREA_SIZE / 2, y: center.y - START_AREA_SIZE / 2 };
}

export function countTerrainNear(
  world: World,
  center: Position,
  radius: number,
  terrain: TerrainType,
): number {
  let count = 0;
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (getTile(world, x, y)?.terrain === terrain) count++;
    }
  }
  return count;
}

/**
 * Zabezpečí garancie zo špecifikácie 1.2: štartovacia oblasť 12 × 12 bez vody a kopcov
 * a v jej okolí dostatok lesa, kameňa a úrodnej pôdy. Chýbajúce suroviny sa doplnia
 * malými plochami na okraji oblasti.
 */
function prepareStartArea(world: World, rng: () => number): void {
  const origin = getStartAreaOrigin(world);
  const center = getStartCenter(world);

  for (let y = origin.y; y < origin.y + START_AREA_SIZE; y++) {
    for (let x = origin.x; x < origin.x + START_AREA_SIZE; x++) {
      if (UNBUILDABLE.has(getTile(world, x, y)!.terrain)) setTerrain(world, x, y, 'grass');
    }
  }

  // Každá chýbajúca surovina dostane inú stranu, aby sa plochy neprekrývali.
  const sides = [0, 1, 2, 3];
  for (let i = sides.length - 1; i > 0; i--) {
    const j = randomInt(rng, 0, i);
    [sides[i], sides[j]] = [sides[j]!, sides[i]!];
  }

  const required = Object.entries(START_RESOURCE_MINIMUM) as [TerrainType, number][];
  required.forEach(([terrain, minimum], i) => {
    if (countTerrainNear(world, center, START_RESOURCE_RADIUS, terrain) >= minimum) return;
    const side = sides[i]!;
    const offset = randomInt(rng, -3, 3);
    const distance = START_AREA_SIZE / 2 + 2;
    const patchCenter =
      side === 0
        ? { x: center.x + offset, y: center.y - distance }
        : side === 1
          ? { x: center.x + distance, y: center.y + offset }
          : side === 2
            ? { x: center.x + offset, y: center.y + distance }
            : { x: center.x - distance, y: center.y + offset };
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        setTerrain(world, patchCenter.x + dx, patchCenter.y + dy, terrain);
      }
    }
  });
}

/** Vygeneruje deterministickú mapu zo seedu. */
export function generateWorld(seed: number, width: number, height: number): World {
  const elevation = sampleField(width, height, seed, 18);
  const moisture = sampleField(width, height, seed ^ 0x5bd1e995, 10);
  const rockiness = sampleField(width, height, seed ^ 0x1b873593, 6);

  const tiles: Tile[] = new Array<Tile>(width * height);
  for (let i = 0; i < tiles.length; i++) {
    const terrain = classify(elevation[i]!, moisture[i]!, rockiness[i]!);
    tiles[i] = makeTile(terrain, fertilityFor(terrain, moisture[i]!));
  }

  const world: World = { seed, width, height, tiles };
  prepareStartArea(world, createRng(seed ^ 0x9e3779b9));
  return world;
}
