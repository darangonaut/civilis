import type { Position } from '@/types';

/** Rozmery izometrického políčka v pixeloch pri zoome 1. */
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
const HALF_W = TILE_WIDTH / 2;
const HALF_H = TILE_HEIGHT / 2;

/** Stred políčka vo svetových (pred-kamerových) súradniciach. */
export function tileToWorld(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H };
}

/**
 * Inverzia k tileToWorld. Kosoštvorec políčka zodpovedá štvorcu |Δx|, |Δy| ≤ 0,5
 * v súradniciach mriežky, takže stačí zaokrúhliť.
 */
export function worldToTile(wx: number, wy: number): Position {
  const a = wx / HALF_W;
  const b = wy / HALF_H;
  return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
}

/** Obdĺžnik, ktorý pokrýva celú mapu vo svetových súradniciach. */
export function worldBounds(width: number, height: number) {
  return {
    minX: -height * HALF_W,
    maxX: width * HALF_W,
    minY: -HALF_H,
    maxY: (width + height - 1) * HALF_H,
  };
}
