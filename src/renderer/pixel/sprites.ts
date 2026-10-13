import type { TerrainType } from '@/types';
import { PixelCanvas, pixelNoise, shade, type Point, type Rgb } from './PixelCanvas';

/** Rozmery pixelového políčka (logické pixely). */
export const PX_TILE_W = 32;
export const PX_TILE_H = 16;
const HW = PX_TILE_W / 2;
const HH = PX_TILE_H / 2;

/** Obmedzená paleta (inšpirovaná Endesga 32). */
export const P = {
  ink: 0x181425,
  grass: 0x3e8948,
  grassLight: 0x63c74d,
  grassDark: 0x265c42,
  leaf: 0x2f7a3e,
  leafLight: 0x5aa84a,
  leafDark: 0x193c3e,
  trunk: 0x733e39,
  soil: 0xb86f50,
  soilDark: 0x8f563b,
  soilLight: 0xd59368,
  wheat: 0xfeae34,
  wheatLight: 0xfee761,
  stone: 0x8b9bb4,
  stoneLight: 0xc0cbdc,
  stoneDark: 0x5a6988,
  stoneDeep: 0x3a4466,
  water: 0x0099db,
  waterDeep: 0x124e89,
  waterLight: 0x2ce8f5,
  hill: 0x6f8a3c,
  hillLight: 0x96b04c,
  hillDark: 0x4c6a2a,
  road: 0xb59f86,
  roadDark: 0x8a7560,
  roadLight: 0xd2c2ac,
  plaster: 0xead4aa,
  plasterShade: 0xc9a77c,
  plasterDark: 0xa4805c,
  wood: 0xb86f50,
  woodShade: 0x8f563b,
  woodDark: 0x5d3a2c,
  roof: 0xe43b44,
  roofShade: 0xa22633,
  roofDark: 0x6e1a2a,
  brick: 0xc0603a,
  brickShade: 0x96442a,
  purple: 0xb55088,
  purpleShade: 0x68386c,
  window: 0x262b44,
  glow: 0xfee761,
  white: 0xffffff,
  smoke: 0xc0cbdc,
} as const;

export interface PixelSprite {
  canvas: PixelCanvas;
  /** Pixel, ktorý zodpovedá stredu políčka. */
  anchorX: number;
  anchorY: number;
}

/** Plátno pre sprite s `top` pixelmi nad horným vrcholom políčka. */
function tileCanvas(top: number): { pc: PixelCanvas; cx: number; cy: number } {
  const pc = new PixelCanvas(PX_TILE_W + 2, PX_TILE_H + top + 2);
  return { pc, cx: HW + 1, cy: top + HH + 1 };
}

function sprite(pc: PixelCanvas, cx: number, cy: number): PixelSprite {
  return { canvas: pc, anchorX: cx, anchorY: cy };
}

/** Výber farby z rampy podľa šumu — jemný dithering textúry. */
function dither(ramp: readonly Rgb[], weights: readonly number[], seed: number) {
  return (x: number, y: number): Rgb => {
    const n = pixelNoise(x, y, seed);
    let acc = 0;
    for (let i = 0; i < ramp.length; i++) {
      acc += weights[i]!;
      if (n < acc) return ramp[i]!;
    }
    return ramp[ramp.length - 1]!;
  };
}

/** Tráva: pokojný základ, občas trs (svetlý pixel nad tmavým) — žiadny šum. */
function grassTexture(seed: number) {
  return (x: number, y: number): Rgb => {
    if (pixelNoise(x, y + 1, seed) < 0.035) return P.grassLight;
    if (pixelNoise(x, y, seed) < 0.035) return P.grassDark;
    return P.grass;
  };
}

// --- Malé ASCII sprity -----------------------------------------------------------------

const TREE = [
  '...o...',
  '..oLo..',
  '..oLGo.',
  '.oLGGo.',
  '.oLGDo.',
  'oLGGGDo',
  'oLGGDDo',
  '.ooTTo.',
  '...T...',
];
const TREE_PAL = { o: P.leafDark, L: P.leafLight, G: P.leaf, D: P.grassDark, T: P.trunk };

const BOULDER = ['.oo.', 'oLSo', 'oSDo', '.oo.'];
const BOULDER_BIG = ['..ooo.', '.oLLSo', 'oLSSDo', 'oSSDDo', '.oooo.'];
const BOULDER_PAL = { o: P.stoneDeep, L: P.stoneLight, S: P.stone, D: P.stoneDark };

const LOGS = ['.ooo.', 'oWwWo', 'oWwWo', '.ooo.'];
const LOGS_PAL = { o: P.woodDark, W: P.wood, w: P.soilLight };

// --- Terén ------------------------------------------------------------------------------

export function drawTerrain(terrain: TerrainType, variant: number): PixelSprite {
  const seed = variant * 7919 + terrain.length * 104729;
  switch (terrain) {
    case 'grass': {
      const { pc, cx, cy } = tileCanvas(0);
      pc.fillDiamond(cx, cy, HW, grassTexture(seed));
      if (variant === 3) pc.set(cx - 6, cy, P.wheatLight);
      return sprite(pc, cx, cy);
    }
    case 'forest': {
      const top = 8;
      const { pc, cx, cy } = tileCanvas(top);
      pc.fillDiamond(cx, cy, HW, dither([P.grassDark, P.grass], [0.88, 0.12], seed));
      const spots =
        variant % 2 === 0
          ? [
              [-9, -2],
              [3, -4],
              [-3, 1],
              [8, 0],
            ]
          : [
              [-6, -3],
              [5, -2],
              [-10, 1],
              [0, 2],
              [9, 2],
            ];
      for (const [dx, dy] of spots) pc.stamp(cx + dx! - 3, cy + dy! - 8, TREE, TREE_PAL);
      return sprite(pc, cx, cy);
    }
    case 'fertile': {
      const { pc, cx, cy } = tileCanvas(0);
      // Brázdy v smere izometrickej osi (sklon 2:1).
      pc.fillDiamond(cx, cy, HW, (x, y) => {
        const furrow = (((x >> 1) + y) & 3) === 0;
        if (furrow) return P.soilDark;
        return pixelNoise(x, y, seed) < 0.05 ? P.soilLight : P.soil;
      });
      return sprite(pc, cx, cy);
    }
    case 'rock': {
      const top = 2;
      const { pc, cx, cy } = tileCanvas(top);
      pc.fillDiamond(
        cx,
        cy,
        HW,
        dither([P.stoneDark, P.stone, P.stoneDeep], [0.8, 0.12, 0.08], seed),
      );
      pc.stamp(cx - 9, cy - 3, BOULDER_BIG, BOULDER_PAL);
      pc.stamp(cx + 3, cy - 1, variant % 2 ? BOULDER_BIG : BOULDER, BOULDER_PAL);
      pc.stamp(cx - 2, cy + 3, BOULDER, BOULDER_PAL);
      return sprite(pc, cx, cy);
    }
    case 'water': {
      const { pc, cx, cy } = tileCanvas(0);
      pc.fillDiamond(cx, cy, HW, P.water);
      const waves =
        variant % 2 === 0
          ? [
              [-8, -1],
              [3, 2],
            ]
          : [
              [-4, 2],
              [5, -2],
            ];
      for (const [dx, dy] of waves) {
        pc.fillRect(cx + dx!, cy + dy!, 3, 1, P.waterLight);
        pc.set(cx + dx! + 3, cy + dy! + 1, P.waterLight);
      }
      return sprite(pc, cx, cy);
    }
    case 'hill': {
      const top = 5;
      const { pc, cx, cy } = tileCanvas(top);
      pc.fillDiamond(cx, cy, HW, dither([P.hill, P.hillDark], [0.93, 0.07], seed));
      // Návršie: svetlá ľavá strana, tmavá pravá, obrys.
      const mound: Point[] = [
        [cx - 12, cy + 2],
        [cx - 6, cy - 5],
        [cx + 1, cy - 8],
        [cx + 7, cy - 4],
        [cx + 12, cy + 2],
        [cx, cy + 6],
      ];
      pc.fillPolygon(mound, (x) => (x < cx + 1 ? P.hillLight : P.hill));
      pc.fillPolygon(
        [
          [cx + 1, cy - 8],
          [cx + 7, cy - 4],
          [cx + 12, cy + 2],
          [cx + 3, cy + 4],
        ],
        P.hillDark,
      );
      return sprite(pc, cx, cy);
    }
  }
}

// --- Budovy -----------------------------------------------------------------------------

interface BoxColors {
  top: Rgb;
  left: Rgb;
  right: Rgb;
}

/** Izometrický kváder so stredom pôdorysu (cx, cy), polovičnou šírkou hw a výškou h. */
function isoBox(
  pc: PixelCanvas,
  cx: number,
  cy: number,
  hw: number,
  h: number,
  c: BoxColors,
): void {
  const hh = hw / 2;
  pc.fillPolygon(
    [
      [cx - hw, cy],
      [cx, cy + hh],
      [cx, cy + hh - h],
      [cx - hw, cy - h],
    ],
    c.left,
  );
  pc.fillPolygon(
    [
      [cx, cy + hh],
      [cx + hw, cy],
      [cx + hw, cy - h],
      [cx, cy + hh - h],
    ],
    c.right,
  );
  pc.fillDiamond(cx, cy - h, hw, c.top);
}

/** Valbová strecha nad kvádrom (s presahom). Vráti výšku hrebeňa nad korunou stien. */
function hipRoof(
  pc: PixelCanvas,
  cx: number,
  cy: number,
  hw: number,
  h: number,
  rise: number,
  light: Rgb,
  dark: Rgb,
): void {
  const r = hw + 2;
  const base = cy - h + 1;
  const apex: Point = [cx, base - rise];
  pc.fillPolygon([[cx - r, base], [cx, base - r / 2], apex], shade(light, 1.1));
  pc.fillPolygon([[cx, base - r / 2], [cx + r, base], apex], shade(dark, 0.9));
  pc.fillPolygon([[cx - r, base], [cx, base + r / 2], apex], light);
  pc.fillPolygon([[cx, base + r / 2], [cx + r, base], apex], dark);
}

/** Bod na ľavej stene `dx` pixelov od ľavého rohu, `up` pixelov nad zemou. */
function leftWall(cx: number, cy: number, hw: number, dx: number, up: number): [number, number] {
  return [Math.round(cx - hw + dx), Math.round(cy + dx / 2 - up)];
}

/** Bod na pravej stene `dx` pixelov od predného rohu, `up` pixelov nad zemou. */
function rightWall(cx: number, cy: number, hw: number, dx: number, up: number): [number, number] {
  return [Math.round(cx + dx), Math.round(cy + hw / 2 - dx / 2 - up)];
}

const WINDOW = ['ff', 'gw', 'ww'];
const DOOR = ['ddd', 'dDd', 'dDd', 'dDd'];
const DETAIL_PAL = { f: P.woodDark, g: P.glow, w: P.window, d: P.woodDark, D: P.wood };

function finish(pc: PixelCanvas, cx: number, cy: number): PixelSprite {
  pc.outline(P.ink);
  return sprite(pc, cx, cy);
}

type Drawer = () => PixelSprite;

const BUILDINGS: Record<string, Drawer> = {
  road: () => {
    const { pc, cx, cy } = tileCanvas(0);
    pc.fillDiamond(cx, cy, HW, (x, y) => {
      // Dlažba: tmavé škáry v mriežke, svetlé kamene.
      const joint = (x + 2 * y) % 6 === 0 || (x - 2 * y + 600) % 8 === 0;
      if (joint) return P.roadDark;
      return pixelNoise(x, y, 31) < 0.08 ? P.roadLight : P.road;
    });
    return sprite(pc, cx, cy);
  },

  house: () => {
    const { pc, cx, cy } = tileCanvas(20);
    const hw = 10;
    isoBox(pc, cx, cy, hw, 9, { top: P.plaster, left: P.plaster, right: P.plasterShade });
    hipRoof(pc, cx, cy, hw, 9, 9, P.roof, P.roofShade);
    pc.stamp(...leftWall(cx, cy, hw, 4, 7), WINDOW, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy, hw, 4, 5), DOOR, DETAIL_PAL);
    pc.fillRect(cx + 4, cy - 21, 2, 4, P.brickShade);
    return finish(pc, cx, cy);
  },

  lumberjack: () => {
    const { pc, cx, cy } = tileCanvas(16);
    const hw = 8;
    isoBox(pc, cx + 2, cy - 1, hw, 7, { top: P.wood, left: P.wood, right: P.woodShade });
    hipRoof(pc, cx + 2, cy - 1, hw, 7, 6, P.woodShade, P.woodDark);
    pc.stamp(...rightWall(cx + 2, cy - 1, hw, 3, 4), DOOR, DETAIL_PAL);
    pc.stamp(cx - 13, cy - 1, LOGS, LOGS_PAL);
    pc.stamp(cx - 9, cy + 2, LOGS, LOGS_PAL);
    return finish(pc, cx, cy);
  },

  farm: () => {
    const { pc, cx, cy } = tileCanvas(10);
    // Pole s klasmi v radoch.
    pc.fillDiamond(cx, cy, HW - 1, (x, y) => {
      const row = (((x >> 1) + y) & 3) < 2;
      if (!row) return P.soilDark;
      return pixelNoise(x, y, 77) < 0.25 ? P.wheatLight : P.wheat;
    });
    // Stodola v zadnom rohu.
    isoBox(pc, cx, cy - 4, 5, 5, { top: P.roof, left: P.roof, right: P.roofShade });
    hipRoof(pc, cx, cy - 4, 5, 5, 4, P.roofShade, P.roofDark);
    return finish(pc, cx, cy);
  },

  quarry: () => {
    const { pc, cx, cy } = tileCanvas(6);
    pc.fillDiamond(cx, cy, 13, dither([P.stoneDark, P.stoneDeep], [0.7, 0.3], 5));
    pc.fillDiamond(cx, cy + 1, 8, P.stoneDeep);
    pc.stamp(cx - 10, cy - 6, BOULDER_BIG, BOULDER_PAL);
    pc.stamp(cx + 4, cy - 5, BOULDER_BIG, BOULDER_PAL);
    pc.stamp(cx - 2, cy + 1, BOULDER, BOULDER_PAL);
    // Kopáč (krompáč) opretý o kameň.
    pc.fillRect(cx + 9, cy - 2, 1, 5, P.woodShade);
    pc.fillRect(cx + 7, cy - 3, 5, 1, P.stoneLight);
    return finish(pc, cx, cy);
  },

  well: () => {
    const { pc, cx, cy } = tileCanvas(16);
    isoBox(pc, cx, cy, 6, 4, { top: P.stone, left: P.stone, right: P.stoneDark });
    pc.fillDiamond(cx, cy - 4, 4, P.waterDeep);
    pc.fillRect(cx - 6, cy - 14, 1, 10, P.woodDark);
    pc.fillRect(cx + 5, cy - 14, 1, 10, P.woodDark);
    hipRoof(pc, cx, cy - 6, 6, 8, 4, P.roof, P.roofShade);
    pc.fillRect(cx - 1, cy - 9, 3, 1, P.woodShade);
    return finish(pc, cx, cy);
  },

  warehouse: () => {
    const { pc, cx, cy } = tileCanvas(16);
    const hw = 13;
    isoBox(pc, cx, cy, hw, 10, { top: P.wood, left: P.wood, right: P.woodShade });
    // Doskové obloženie.
    for (let dx = 3; dx < hw; dx += 3) {
      const [x, y] = leftWall(cx, cy, hw, dx, 10);
      pc.fillRect(x, y + 1, 1, 9, P.woodShade);
    }
    hipRoof(pc, cx, cy, hw, 10, 5, P.stoneDark, P.stoneDeep);
    const [dx, dy] = rightWall(cx, cy, hw, 4, 7);
    pc.stamp(dx, dy, ['dddd', 'dDDd', 'dDDd', 'dDDd', 'dDDd', 'dDDd', 'dDDd'], DETAIL_PAL);
    return finish(pc, cx, cy);
  },

  workshop: () => {
    const { pc, cx, cy } = tileCanvas(20);
    const hw = 11;
    isoBox(pc, cx, cy, hw, 8, { top: P.brick, left: P.brick, right: P.brickShade });
    hipRoof(pc, cx, cy, hw, 8, 7, P.stoneDark, P.stoneDeep);
    pc.stamp(...leftWall(cx, cy, hw, 4, 6), WINDOW, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy, hw, 3, 5), DOOR, DETAIL_PAL);
    // Komín s dymom.
    pc.fillRect(cx + 5, cy - 19, 3, 6, P.stoneDeep);
    pc.set(cx + 6, cy - 21, P.smoke);
    pc.set(cx + 7, cy - 22, P.smoke);
    pc.set(cx + 8, cy - 23, P.smoke);
    return finish(pc, cx, cy);
  },

  school: () => {
    const { pc, cx, cy } = tileCanvas(30);
    const hw = 11;
    isoBox(pc, cx, cy, hw, 13, { top: P.plaster, left: P.plaster, right: P.plasterShade });
    hipRoof(pc, cx, cy, hw, 13, 8, P.purple, P.purpleShade);
    pc.stamp(...leftWall(cx, cy, hw, 3, 10), WINDOW, DETAIL_PAL);
    pc.stamp(...leftWall(cx, cy, hw, 7, 10), WINDOW, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy, hw, 4, 5), DOOR, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy, hw, 8, 10), WINDOW, DETAIL_PAL);
    // Stožiar s vlajkou.
    pc.fillRect(cx, cy - 30, 1, 9, P.woodDark);
    pc.fillRect(cx + 1, cy - 30, 4, 3, P.roof);
    return finish(pc, cx, cy);
  },

  market: () => {
    const { pc, cx, cy } = tileCanvas(12);
    // Dva stánky s pruhovanými markízami.
    for (const [ox, oy] of [
      [-6, -2],
      [6, 2],
    ] as const) {
      isoBox(pc, cx + ox, cy + oy, 5, 4, { top: P.wood, left: P.wood, right: P.woodShade });
      pc.fillRect(cx + ox - 5, cy + oy - 9, 1, 6, P.woodDark);
      pc.fillRect(cx + ox + 4, cy + oy - 9, 1, 6, P.woodDark);
      pc.fillDiamond(cx + ox, cy + oy - 9, 6, (x) => ((x >> 1) & 1 ? P.roof : P.white));
    }
    pc.stamp(cx - 2, cy + 3, ['.oo.', 'oYYo', 'oYYo', '.oo.'], { o: P.woodDark, Y: P.wheat });
    return finish(pc, cx, cy);
  },
};

export function drawBuilding(definitionId: string): PixelSprite {
  const drawer = BUILDINGS[definitionId];
  if (drawer) return drawer();
  const { pc, cx, cy } = tileCanvas(10);
  isoBox(pc, cx, cy, 8, 8, { top: 0xff00ff, left: 0xcc00cc, right: 0x990099 });
  return finish(pc, cx, cy);
}

/** Obrys políčka (1 px) pre zvýraznenie a výber. */
export function drawTileOutline(): PixelSprite {
  const { pc, cx, cy } = tileCanvas(0);
  pc.fillDiamond(cx, cy, HW, P.white);
  // Ponechá len okrajové pixely kosoštvorca.
  const inner = new PixelCanvas(pc.width, pc.height);
  inner.fillDiamond(cx, cy, HW - 2, P.white);
  for (let y = 0; y < pc.height; y++) {
    for (let x = 0; x < pc.width; x++) if (inner.isFilled(x, y)) pc.set(x, y, 0, 0);
  }
  return sprite(pc, cx, cy);
}

/** Výstražná bublina „!“; kotva v dolnom hrote. */
export function drawMarker(): PixelSprite {
  const pc = new PixelCanvas(9, 12);
  pc.stamp(
    0,
    0,
    [
      '.ooooooo.',
      'oRRRWRRRo',
      'oRRRWRRRo',
      'oRRRWRRRo',
      'oRRRWRRRo',
      'oRRRRRRRo',
      'oRRRWRRRo',
      '.ooooooo.',
      '...oRo...',
      '....o....',
    ],
    { o: P.ink, R: P.roof, W: P.white },
  );
  return { canvas: pc, anchorX: 4, anchorY: 10 };
}
