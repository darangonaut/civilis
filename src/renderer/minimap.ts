import type { BuildingCategory, GameState, TerrainType } from '@/types';
import type { GameData } from '@/engine';
import type { CameraView } from './GameRenderer';
import { TILE_HEIGHT, TILE_WIDTH } from './iso';
import { MARS_MINIMAP, PROXIMA_MINIMAP } from './pixel/sprites';

const TERRAIN: Record<TerrainType, string> = {
  grass: '#3e8948',
  forest: '#265c42',
  fertile: '#b86f50',
  rock: '#5a6988',
  water: '#0099db',
  hill: '#6f8a3c',
};

const BUILDINGS: Record<BuildingCategory, string> = {
  housing: '#ead4aa',
  production: '#feae34',
  service: '#b55088',
  infrastructure: '#c0a080',
  decoration: '#63c74d',
  wonder: '#fee761',
};

/** Mierka minimapy: políčko = `scale` px na šírku diagonály. */
export interface MinimapLayout {
  scale: number;
  width: number;
  height: number;
}

export function minimapLayout(state: Readonly<GameState>, maxWidth: number): MinimapLayout {
  const { width, height } = state.world;
  const scale = maxWidth / (width + height);
  return {
    scale,
    width: Math.ceil((width + height) * scale),
    height: Math.ceil(((width + height) / 2) * scale),
  };
}

/** Nakreslí celú mapu izometricky (terén + budovy podľa kategórie). */
export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  state: Readonly<GameState>,
  data: GameData,
  layout: MinimapLayout,
): void {
  const { width, height, tiles } = state.world;
  const s = layout.scale;
  const categoryById = new Map(
    state.city.buildings.map((b) => [b.id, data.buildingsById.get(b.definitionId)?.category]),
  );
  const terrainColors =
    state.planet === 'mars' ? MARS_MINIMAP : state.planet === 'proxima' ? PROXIMA_MINIMAP : TERRAIN;
  ctx.clearRect(0, 0, layout.width, layout.height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y * width + x]!;
      const category = tile.buildingId ? categoryById.get(tile.buildingId) : undefined;
      ctx.fillStyle = category ? BUILDINGS[category] : terrainColors[tile.terrain];
      const mx = (x - y + height - 1) * s;
      const my = ((x + y) / 2) * s;
      ctx.fillRect(mx, my, s * 2 + 0.5, s + 0.5);
    }
  }
}

/** Výhľad kamery (svetové súradnice) → obdĺžnik v súradniciach minimapy. */
export function viewToMinimap(view: CameraView, state: Readonly<GameState>, layout: MinimapLayout) {
  const s = layout.scale;
  const offset = state.world.height - 1;
  const toX = (wx: number) => (wx / (TILE_WIDTH / 2) + offset) * s + s;
  const toY = (wy: number) => (wy / TILE_HEIGHT) * s + s / 2;
  return {
    x: toX(view.minX),
    y: toY(view.minY),
    w: toX(view.maxX) - toX(view.minX),
    h: toY(view.maxY) - toY(view.minY),
  };
}

/** Bod na minimape → svetové súradnice (kam presunúť kameru). */
export function minimapToWorld(
  mx: number,
  my: number,
  state: Readonly<GameState>,
  layout: MinimapLayout,
) {
  const s = layout.scale;
  const offset = state.world.height - 1;
  return { x: ((mx - s) / s - offset) * (TILE_WIDTH / 2), y: ((my - s / 2) / s) * TILE_HEIGHT };
}
