import { Texture } from 'pixi.js';
import { TERRAIN_TYPES, type TerrainType } from '@/types';
import {
  drawBuilding,
  drawMarker,
  drawTerrain,
  drawTileOutline,
  type PixelSprite,
} from './pixel/sprites';

/** Textúra s kotvou, ktorá zarovná stred políčka so stredom sprite pozície. */
export interface AnchoredTexture {
  texture: Texture;
  anchorX: number;
  anchorY: number;
}

/** Pixel art sa nesmie vyhladzovať — filtrovanie „nearest“ drží ostré pixely pri zoome. */
function toTexture(sprite: PixelSprite): AnchoredTexture {
  const texture = Texture.from(sprite.canvas.toCanvas());
  texture.source.scaleMode = 'nearest';
  return {
    texture,
    // Kotva v strede pixela, aby sa sprite pri celočíselnom zoome zarovnal na mriežku.
    anchorX: sprite.anchorX / sprite.canvas.width,
    anchorY: sprite.anchorY / sprite.canvas.height,
  };
}

export interface TextureAtlas {
  terrain: Record<TerrainType, AnchoredTexture[]>;
  building(definitionId: string): AnchoredTexture;
  outline: AnchoredTexture;
  marker: AnchoredTexture;
  destroy(): void;
}

export const TERRAIN_VARIANTS = 4;

/** Vytvorí zdieľané textúry raz pre celú mapu (každý typ terénu a budovy = jedna textúra). */
export function createTextureAtlas(buildingIds: readonly string[]): TextureAtlas {
  const terrain = Object.fromEntries(
    TERRAIN_TYPES.map((type) => [
      type,
      Array.from({ length: TERRAIN_VARIANTS }, (_, variant) =>
        toTexture(drawTerrain(type, variant)),
      ),
    ]),
  ) as Record<TerrainType, AnchoredTexture[]>;

  const buildings = new Map<string, AnchoredTexture>();
  const building = (definitionId: string): AnchoredTexture => {
    let texture = buildings.get(definitionId);
    if (!texture) {
      texture = toTexture(drawBuilding(definitionId));
      buildings.set(definitionId, texture);
    }
    return texture;
  };
  buildingIds.forEach(building);

  const outline = toTexture(drawTileOutline());
  const marker = toTexture(drawMarker());

  return {
    terrain,
    building,
    outline,
    marker,
    destroy() {
      for (const variants of Object.values(terrain))
        variants.forEach((t) => t.texture.destroy(true));
      buildings.forEach((t) => t.texture.destroy(true));
      outline.texture.destroy(true);
      marker.texture.destroy(true);
    },
  };
}
