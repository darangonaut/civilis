import { Graphics, Rectangle, type Renderer, type Texture } from 'pixi.js';
import { TERRAIN_TYPES, type TerrainType } from '@/types';
import { TILE_HEIGHT, TILE_WIDTH } from './iso';
import { TERRAIN_COLORS, buildingStyle, shade, type BuildingStyle } from './palette';

const HW = TILE_WIDTH / 2;
const HH = TILE_HEIGHT / 2;

/** Textúra s kotvou, ktorá zarovná stred políčka so stredom sprite pozície. */
export interface AnchoredTexture {
  texture: Texture;
  anchorX: number;
  anchorY: number;
}

/** Kosoštvorec s polovičnými rozmermi hw × hh, posunutý o (0, dy). */
function diamond(hw: number, hh: number, dy = 0): number[] {
  return [0, -hh + dy, hw, dy, 0, hh + dy, -hw, dy];
}

/**
 * Vyrenderuje grafiku nakreslenú okolo stredu políčka (0, 0) do textúry.
 * `top` je počet pixelov nad horným vrcholom kosoštvorca, ktoré grafika potrebuje.
 */
function bake(renderer: Renderer, graphics: Graphics, top: number): AnchoredTexture {
  const frameTop = HH + top + 1;
  const frame = new Rectangle(-HW - 1, -frameTop, TILE_WIDTH + 2, frameTop + HH + 1);
  const texture = renderer.generateTexture({
    target: graphics,
    frame,
    antialias: true,
    resolution: 2,
  });
  graphics.destroy();
  return { texture, anchorX: 0.5, anchorY: frameTop / frame.height };
}

function drawTerrain(terrain: TerrainType, variant: number): { graphics: Graphics; top: number } {
  const base = shade(TERRAIN_COLORS[terrain], 1 + (variant - 1.5) * 0.025);
  // O pixel väčší kosoštvorec prekryje švy medzi susednými políčkami.
  const g = new Graphics().poly(diamond(HW + 1, HH + 0.5)).fill(base);
  let top = 0;

  switch (terrain) {
    case 'forest': {
      const trees =
        variant % 2 === 0
          ? [
              [-12, 2],
              [10, -2],
              [0, 6],
            ]
          : [
              [-8, -1],
              [12, 3],
              [-2, 7],
              [4, -5],
            ];
      for (const [x, y] of trees) {
        g.poly([x!, y! - 16, x! + 6, y!, x! - 6, y!]).fill(shade(0x2f6b2a, 1 + variant * 0.05));
        g.rect(x! - 1, y!, 2, 3).fill(0x5a3d22);
      }
      top = 12;
      break;
    }
    case 'rock':
      g.poly([-12, 2, -6, -6, 2, 0, -4, 6]).fill(0xb4aea4);
      g.poly([4, 4, 10, -3, 16, 3, 10, 8]).fill(0x6f6a62);
      break;
    case 'hill':
      g.ellipse(-4, -2, 18, 9).fill(shade(TERRAIN_COLORS.hill, 1.12));
      g.ellipse(-6, -5, 9, 4).fill(shade(TERRAIN_COLORS.hill, 1.25));
      top = 2;
      break;
    case 'fertile':
      for (let i = -2; i <= 2; i++) {
        g.moveTo(i * 8 - 8, i * 4 + 4)
          .lineTo(i * 8 + 8, i * 4 - 4)
          .stroke({ width: 1.5, color: shade(TERRAIN_COLORS.fertile, 0.8) });
      }
      break;
    case 'water':
      g.moveTo(-10, 0).quadraticCurveTo(-5, -3, 0, 0).stroke({ width: 1.5, color: 0x8fc0e8 });
      g.moveTo(4, 5).quadraticCurveTo(9, 2, 14, 5).stroke({ width: 1.5, color: 0x8fc0e8 });
      break;
    case 'grass':
      if (variant === 3) g.circle(-8, 3, 1.5).fill(0xe8e070).circle(9, -2, 1.5).fill(0xf0f0f0);
      break;
  }
  return { graphics: g, top };
}

function drawBox(g: Graphics, style: BuildingStyle, color: number, height: number): void {
  const hw = HW * style.scale;
  const hh = HH * style.scale;
  // Ľavá a pravá stena, potom horná plocha.
  g.poly([-hw, 0, 0, hh, 0, hh - height, -hw, -height]).fill(shade(color, 0.8));
  g.poly([0, hh, hw, 0, hw, -height, 0, hh - height]).fill(shade(color, 0.62));
  g.poly(diamond(hw, hh, -height)).fill(color);
}

function drawRoof(g: Graphics, style: BuildingStyle): number {
  const hw = HW * style.scale;
  const hh = HH * style.scale;
  const roof = style.roofColor ?? shade(style.color, 0.9);
  if (style.roof === 'flat') {
    if (style.roofColor !== undefined)
      g.poly(diamond(hw * 0.8, hh * 0.8, -style.height)).fill(roof);
    return 0;
  }
  const rise = Math.round(hw * 0.75);
  const apexY = -style.height - rise;
  const y = -style.height;
  g.poly([-hw, y, 0, y + hh, 0, apexY]).fill(shade(roof, 0.95));
  g.poly([0, y + hh, hw, y, 0, apexY]).fill(shade(roof, 0.72));
  return rise;
}

function drawBuilding(definitionId: string): { graphics: Graphics; top: number } {
  const style = buildingStyle(definitionId);
  const g = new Graphics();

  if (definitionId === 'road') {
    g.poly(diamond(HW + 1, HH + 0.5)).fill(style.color);
    g.poly(diamond(HW * 0.55, HH * 0.55)).fill(shade(style.color, 1.12));
    return { graphics: g, top: 0 };
  }

  if (definitionId === 'farm') {
    g.poly(diamond(HW * 0.95, HH * 0.95)).fill(0x8a6a3a);
    for (let i = -3; i <= 3; i++) {
      g.moveTo(i * 7 - 12, i * 3.5 + 6)
        .lineTo(i * 7 + 12, i * 3.5 - 6)
        .stroke({ width: 2, color: style.color });
    }
    // Malá stodola v zadnom rohu.
    const barn: BuildingStyle = {
      color: 0xb04a3a,
      height: 8,
      scale: 0.28,
      roof: 'pyramid',
      roofColor: 0x7a2e24,
    };
    g.save().translateTransform(0, -8);
    drawBox(g, barn, barn.color, barn.height);
    const rise = drawRoof(g, barn);
    g.restore();
    return { graphics: g, top: Math.max(0, barn.height + rise + 8 - HH) };
  }

  drawBox(g, style, style.color, style.height);
  const rise = drawRoof(g, style);
  let top = style.height + rise - HH * (1 - style.scale);

  switch (definitionId) {
    case 'lumberjack':
      g.rect(-HW * 0.55, -2, 10, 4)
        .fill(0x6b4a2b)
        .rect(-HW * 0.55 + 2, -6, 8, 4)
        .fill(0x8a6440);
      break;
    case 'quarry':
      g.poly([-6, -10, 0, -16, 6, -10, 0, -6]).fill(0xc8ccd0);
      g.poly([4, -7, 10, -12, 14, -7, 8, -4]).fill(0x707880);
      top = Math.max(top, 8);
      break;
    case 'well':
      g.poly(diamond(HW * 0.2, HH * 0.2, -style.height)).fill(0x1f4f80);
      g.rect(-7, -style.height - 14, 2, 14)
        .fill(0x6b4a2b)
        .rect(5, -style.height - 14, 2, 14)
        .fill(0x6b4a2b);
      g.rect(-8, -style.height - 16, 16, 3).fill(0x8a3a2a);
      top = Math.max(top, style.height + 16 - HH);
      break;
    case 'workshop':
      g.rect(6, -style.height - rise - 2, 5, rise + 4).fill(0x5a5048);
      break;
    case 'school':
      g.rect(-1, -style.height - rise - 14, 2, 14).fill(0x4a4038);
      g.poly([
        1,
        -style.height - rise - 14,
        11,
        -style.height - rise - 11,
        1,
        -style.height - rise - 8,
      ]).fill(0xe04040);
      top += 14;
      break;
    case 'warehouse':
      g.rect(-8, 1, 8, -10).fill(0x6b4a2b);
      break;
  }
  return { graphics: g, top: Math.max(0, top) };
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
export function createTextureAtlas(
  renderer: Renderer,
  buildingIds: readonly string[],
): TextureAtlas {
  const terrain = Object.fromEntries(
    TERRAIN_TYPES.map((type) => [
      type,
      Array.from({ length: TERRAIN_VARIANTS }, (_, variant) => {
        const { graphics, top } = drawTerrain(type, variant);
        return bake(renderer, graphics, top);
      }),
    ]),
  ) as Record<TerrainType, AnchoredTexture[]>;

  const buildings = new Map<string, AnchoredTexture>();
  const building = (definitionId: string): AnchoredTexture => {
    let texture = buildings.get(definitionId);
    if (!texture) {
      const { graphics, top } = drawBuilding(definitionId);
      texture = bake(renderer, graphics, top);
      buildings.set(definitionId, texture);
    }
    return texture;
  };
  buildingIds.forEach(building);

  const outline = bake(
    renderer,
    new Graphics()
      .poly(diamond(HW - 1, HH - 0.5))
      .stroke({ width: 2, color: 0xffffff, alignment: 0.5 }),
    0,
  );

  // Výstražná značka nad budovou s problémom. Kotva v strede dolného hrotu.
  const markerGraphics = new Graphics()
    .poly([0, 0, -5, -8, 5, -8])
    .fill(0xd9433a)
    .circle(0, -15, 9)
    .fill(0xd9433a)
    .stroke({ width: 1.5, color: 0xffffff })
    .rect(-1.5, -21, 3, 8)
    .fill(0xffffff)
    .circle(0, -10, 1.6)
    .fill(0xffffff);
  const markerTexture = renderer.generateTexture({
    target: markerGraphics,
    frame: new Rectangle(-11, -26, 22, 27),
    antialias: true,
    resolution: 2,
  });
  markerGraphics.destroy();
  const marker: AnchoredTexture = { texture: markerTexture, anchorX: 0.5, anchorY: 26 / 27 };

  return {
    terrain,
    building,
    outline,
    marker,
    destroy() {
      marker.texture.destroy(true);
      for (const variants of Object.values(terrain))
        variants.forEach((t) => t.texture.destroy(true));
      buildings.forEach((t) => t.texture.destroy(true));
      outline.texture.destroy(true);
    },
  };
}
