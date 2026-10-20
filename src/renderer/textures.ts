import { Texture } from 'pixi.js';
import { TERRAIN_TYPES, type PlanetId, type TerrainType } from '@/types';
import {
  drawBuilding,
  drawMarker,
  drawTerrain,
  drawTileOutline,
  type MarkerKind,
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
  /** Textúry terénu planéty (vytvoria sa pri prvom použití). */
  terrain(planet: PlanetId): Record<TerrainType, AnchoredTexture[]>;
  /** Textúra podľa kľúča sprite-u (`buildingSpriteKey`). */
  building(key: string): AnchoredTexture;
  outline: AnchoredTexture;
  marker(kind: MarkerKind): AnchoredTexture;
  /** Vyhladzovanie (pri zoome pod 1×) alebo ostré pixely. */
  setSmoothing(smooth: boolean): void;
  destroy(): void;
}

export const TERRAIN_VARIANTS = 4;

/** Vytvorí zdieľané textúry raz pre celú mapu (každý typ terénu a budovy = jedna textúra). */
export function createTextureAtlas(buildingIds: readonly string[]): TextureAtlas {
  const terrains = new Map<PlanetId, Record<TerrainType, AnchoredTexture[]>>();
  const terrain = (planet: PlanetId) => {
    let textures = terrains.get(planet);
    if (!textures) {
      textures = Object.fromEntries(
        TERRAIN_TYPES.map((type) => [
          type,
          Array.from({ length: TERRAIN_VARIANTS }, (_, variant) =>
            toTexture(drawTerrain(type, variant, planet)),
          ),
        ]),
      ) as Record<TerrainType, AnchoredTexture[]>;
      terrains.set(planet, textures);
    }
    return textures;
  };

  const buildings = new Map<string, AnchoredTexture>();
  const building = (key: string): AnchoredTexture => {
    let texture = buildings.get(key);
    if (!texture) {
      texture = toTexture(drawBuilding(key));
      buildings.set(key, texture);
    }
    return texture;
  };
  buildingIds.forEach(building);

  const outline = toTexture(drawTileOutline());
  const markers = new Map<MarkerKind, AnchoredTexture>();
  const marker = (kind: MarkerKind): AnchoredTexture => {
    let texture = markers.get(kind);
    if (!texture) {
      texture = toTexture(drawMarker(kind));
      markers.set(kind, texture);
    }
    return texture;
  };

  return {
    terrain,
    building,
    outline,
    marker,
    setSmoothing(smooth: boolean) {
      const mode = smooth ? 'linear' : 'nearest';
      const all = [
        ...[...terrains.values()].flatMap((t) => Object.values(t).flat()),
        ...buildings.values(),
        ...markers.values(),
        outline,
      ];
      for (const entry of all)
        if (entry.texture.source.scaleMode !== mode) entry.texture.source.scaleMode = mode;
    },
    destroy() {
      for (const textures of terrains.values())
        Object.values(textures)
          .flat()
          .forEach((t) => t.texture.destroy(true));
      buildings.forEach((t) => t.texture.destroy(true));
      outline.texture.destroy(true);
      markers.forEach((t) => t.texture.destroy(true));
    },
  };
}
