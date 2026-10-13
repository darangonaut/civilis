import type { TerrainType } from '@/types';

export const TERRAIN_COLORS: Record<TerrainType, number> = {
  grass: 0x7fae5a,
  forest: 0x4f8a3c,
  fertile: 0x9c8a4a,
  rock: 0x8f8a80,
  water: 0x3f7fb5,
  hill: 0x9a9468,
};

export type RoofShape = 'flat' | 'pyramid';

export interface BuildingStyle {
  color: number;
  /** Výška kvádra v pixeloch. */
  height: number;
  /** Veľkosť pôdorysu voči políčku (0–1). */
  scale: number;
  roof: RoofShape;
  roofColor?: number;
}

/** Vizuálny štýl budov. Farby sa používajú aj v katalógu (React). */
export const BUILDING_STYLES: Record<string, BuildingStyle> = {
  house: { color: 0xe0c9a0, height: 12, scale: 0.62, roof: 'pyramid', roofColor: 0xc8734a },
  road: { color: 0x8a8578, height: 0, scale: 1, roof: 'flat' },
  lumberjack: { color: 0x8a6440, height: 10, scale: 0.6, roof: 'pyramid', roofColor: 0x6b4a2b },
  farm: { color: 0xd8c25a, height: 3, scale: 0.9, roof: 'flat' },
  quarry: { color: 0x9aa3ad, height: 6, scale: 0.75, roof: 'flat' },
  well: { color: 0x4a90c8, height: 6, scale: 0.35, roof: 'flat' },
  warehouse: { color: 0xb8875a, height: 16, scale: 0.8, roof: 'flat', roofColor: 0xa0703c },
  workshop: { color: 0xd0a080, height: 14, scale: 0.7, roof: 'pyramid', roofColor: 0xb85c38 },
  school: { color: 0xe6e0d0, height: 20, scale: 0.72, roof: 'pyramid', roofColor: 0x7a5cc8 },
  market: { color: 0xf0e0c0, height: 6, scale: 0.85, roof: 'pyramid', roofColor: 0xc84a7a },
};

export const FALLBACK_STYLE: BuildingStyle = {
  color: 0xff00ff,
  height: 10,
  scale: 0.6,
  roof: 'flat',
};

export function buildingStyle(definitionId: string): BuildingStyle {
  return BUILDING_STYLES[definitionId] ?? FALLBACK_STYLE;
}

/** Hlavná rozpoznávacia farba budovy (strecha, ak ju má). */
export function buildingSwatchColor(definitionId: string): string {
  const style = buildingStyle(definitionId);
  return `#${(style.roofColor ?? style.color).toString(16).padStart(6, '0')}`;
}

export function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}
