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

/** Výška plátna nad políčkom pre všetky budovy (spoločná, aby varianty mohli pridávať detaily). */
const BUILDING_TOP = 44;

type Painter = (pc: PixelCanvas, cx: number, cy: number) => void;

const LOG_PILE = (pc: PixelCanvas, x: number, y: number) => pc.stamp(x, y, LOGS, LOGS_PAL);

const paintHouse: Painter = (pc, cx, cy) => {
  const hw = 10;
  isoBox(pc, cx, cy, hw, 9, { top: P.plaster, left: P.plaster, right: P.plasterShade });
  hipRoof(pc, cx, cy, hw, 9, 9, P.roof, P.roofShade);
  pc.stamp(...leftWall(cx, cy, hw, 4, 7), WINDOW, DETAIL_PAL);
  pc.stamp(...rightWall(cx, cy, hw, 4, 5), DOOR, DETAIL_PAL);
  pc.fillRect(cx + 4, cy - 21, 2, 4, P.brickShade);
};

const paintLumberjack: Painter = (pc, cx, cy) => {
  const hw = 8;
  isoBox(pc, cx + 2, cy - 1, hw, 7, { top: P.wood, left: P.wood, right: P.woodShade });
  hipRoof(pc, cx + 2, cy - 1, hw, 7, 6, P.woodShade, P.woodDark);
  pc.stamp(...rightWall(cx + 2, cy - 1, hw, 3, 4), DOOR, DETAIL_PAL);
  LOG_PILE(pc, cx - 13, cy - 1);
  LOG_PILE(pc, cx - 9, cy + 2);
};

const paintFarm =
  (irrigated: boolean): Painter =>
  (pc, cx, cy) => {
    pc.fillDiamond(cx, cy, HW - 1, (x, y) => {
      const band = ((x >> 1) + y) & 7;
      if (irrigated && band === 0) return P.water;
      if ((band & 3) >= 2) return P.soilDark;
      return pixelNoise(x, y, 77) < 0.25 ? P.wheatLight : P.wheat;
    });
    isoBox(pc, cx, cy - 4, 5, 5, { top: P.roof, left: P.roof, right: P.roofShade });
    hipRoof(pc, cx, cy - 4, 5, 5, 4, P.roofShade, P.roofDark);
    if (irrigated) {
      // Veterné koleso čerpadla.
      pc.fillRect(cx + 9, cy - 10, 1, 9, P.woodDark);
      pc.stamp(cx + 6, cy - 13, ['w.w.w', '.www.', 'wwHww', '.www.', 'w.w.w'], {
        w: P.plaster,
        H: P.woodDark,
      });
    }
  };

const paintQuarry: Painter = (pc, cx, cy) => {
  pc.fillDiamond(cx, cy, 13, dither([P.stoneDark, P.stoneDeep], [0.7, 0.3], 5));
  pc.fillDiamond(cx, cy + 1, 8, P.stoneDeep);
  pc.stamp(cx - 10, cy - 6, BOULDER_BIG, BOULDER_PAL);
  pc.stamp(cx + 4, cy - 5, BOULDER_BIG, BOULDER_PAL);
  pc.stamp(cx - 2, cy + 1, BOULDER, BOULDER_PAL);
  pc.fillRect(cx + 9, cy - 2, 1, 5, P.woodShade);
  pc.fillRect(cx + 7, cy - 3, 5, 1, P.stoneLight);
};

const paintWarehouse =
  (big: boolean): Painter =>
  (pc, cx, cy) => {
    const hw = big ? 14 : 13;
    const h = big ? 13 : 10;
    if (big) isoBox(pc, cx, cy, hw, 4, { top: P.stone, left: P.stone, right: P.stoneDark });
    isoBox(pc, cx, cy - (big ? 4 : 0), hw, h - (big ? 4 : 0), {
      top: P.wood,
      left: P.wood,
      right: P.woodShade,
    });
    for (let dx = 3; dx < hw; dx += 3) {
      const [x, y] = leftWall(cx, cy, hw, dx, h);
      pc.fillRect(x, y + 1, 1, big ? 8 : 9, P.woodShade);
    }
    hipRoof(
      pc,
      cx,
      cy,
      hw,
      h,
      big ? 7 : 5,
      big ? P.roof : P.stoneDark,
      big ? P.roofShade : P.stoneDeep,
    );
    const [dx, dy] = rightWall(cx, cy, hw, 4, 7);
    pc.stamp(dx, dy, ['dddd', 'dDDd', 'dDDd', 'dDDd', 'dDDd', 'dDDd', 'dDDd'], DETAIL_PAL);
    if (big) pc.stamp(...rightWall(cx, cy, hw, 9, 12), ['ddd', 'dDd', 'dDd'], DETAIL_PAL);
  };

const paintWorkshop: Painter = (pc, cx, cy) => {
  const hw = 11;
  isoBox(pc, cx, cy, hw, 8, { top: P.brick, left: P.brick, right: P.brickShade });
  hipRoof(pc, cx, cy, hw, 8, 7, P.stoneDark, P.stoneDeep);
  pc.stamp(...leftWall(cx, cy, hw, 4, 6), WINDOW, DETAIL_PAL);
  pc.stamp(...rightWall(cx, cy, hw, 3, 5), DOOR, DETAIL_PAL);
  pc.fillRect(cx + 5, cy - 19, 3, 6, P.stoneDeep);
  pc.set(cx + 6, cy - 21, P.smoke);
  pc.set(cx + 7, cy - 22, P.smoke);
  pc.set(cx + 8, cy - 23, P.smoke);
};

const paintSchool: Painter = (pc, cx, cy) => {
  const hw = 11;
  isoBox(pc, cx, cy, hw, 13, { top: P.plaster, left: P.plaster, right: P.plasterShade });
  hipRoof(pc, cx, cy, hw, 13, 8, P.purple, P.purpleShade);
  pc.stamp(...leftWall(cx, cy, hw, 3, 10), WINDOW, DETAIL_PAL);
  pc.stamp(...leftWall(cx, cy, hw, 7, 10), WINDOW, DETAIL_PAL);
  pc.stamp(...rightWall(cx, cy, hw, 4, 5), DOOR, DETAIL_PAL);
  pc.stamp(...rightWall(cx, cy, hw, 8, 10), WINDOW, DETAIL_PAL);
  pc.fillRect(cx, cy - 30, 1, 9, P.woodDark);
  pc.fillRect(cx + 1, cy - 30, 4, 3, P.roof);
};

const paintMarket =
  (stalls: number): Painter =>
  (pc, cx, cy) => {
    const spots: [number, number][] =
      stalls >= 3
        ? [
            [-7, -1],
            [0, -4],
            [7, 1],
          ]
        : [
            [-6, -2],
            [6, 2],
          ];
    for (const [ox, oy] of spots) {
      isoBox(pc, cx + ox, cy + oy, 5, 4, { top: P.wood, left: P.wood, right: P.woodShade });
      pc.fillRect(cx + ox - 5, cy + oy - 9, 1, 6, P.woodDark);
      pc.fillRect(cx + ox + 4, cy + oy - 9, 1, 6, P.woodDark);
      pc.fillDiamond(cx + ox, cy + oy - 9, 6, (x) => ((x >> 1) & 1 ? P.roof : P.white));
    }
    pc.stamp(cx - 2, cy + 3, ['.oo.', 'oYYo', 'oYYo', '.oo.'], { o: P.woodDark, Y: P.wheat });
  };

/** Kreslenie budov podľa kľúča sprite-u (`id`, `id@úroveň`, `id+` = vzhľad po technológii). */
const PAINTERS: Record<string, Painter> = {
  house: paintHouse,

  'house@2': (pc, cx, cy) => {
    // Murovaný dom: kamenný, väčší, škridlová strecha, dve okná.
    const hw = 11;
    isoBox(pc, cx, cy, hw, 11, { top: P.stoneLight, left: P.stoneLight, right: P.stone });
    for (let dx = 2; dx < hw; dx += 4) {
      const [x, y] = leftWall(cx, cy, hw, dx, 6);
      pc.fillRect(x, y, 2, 1, P.stone);
    }
    hipRoof(pc, cx, cy, hw, 11, 10, P.roof, P.roofShade);
    pc.stamp(...leftWall(cx, cy, hw, 3, 8), WINDOW, DETAIL_PAL);
    pc.stamp(...leftWall(cx, cy, hw, 8, 8), WINDOW, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy, hw, 4, 5), DOOR, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy, hw, 8, 9), WINDOW, DETAIL_PAL);
    pc.fillRect(cx - 5, cy - 25, 2, 5, P.stoneDeep);
  },

  'house@3': (pc, cx, cy) => {
    // Meštiansky dom: dvojpodlažný, tehlové prízemie, omietnuté poschodie, tmavá strecha.
    const hw = 12;
    isoBox(pc, cx, cy, hw, 8, { top: P.brick, left: P.brick, right: P.brickShade });
    isoBox(pc, cx, cy - 8, hw, 9, { top: P.plaster, left: P.plaster, right: P.plasterShade });
    hipRoof(pc, cx, cy, hw, 17, 10, P.purpleShade, P.ink);
    for (const dx of [3, 8]) {
      pc.stamp(...leftWall(cx, cy, hw, dx, 6), WINDOW, DETAIL_PAL);
      pc.stamp(...leftWall(cx, cy, hw, dx, 14), WINDOW, DETAIL_PAL);
    }
    pc.stamp(...rightWall(cx, cy, hw, 4, 5), DOOR, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy, hw, 9, 14), WINDOW, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy, hw, 4, 14), WINDOW, DETAIL_PAL);
    // Balkón s kvetmi.
    const [bx, by] = rightWall(cx, cy, hw, 3, 9);
    pc.fillRect(bx, by, 5, 1, P.woodDark);
    pc.set(bx + 1, by - 1, P.roof);
    pc.set(bx + 3, by - 1, P.glow);
  },

  lumberjack: paintLumberjack,
  'lumberjack+': (pc, cx, cy) => {
    paintLumberjack(pc, cx, cy);
    // Píla: kotúč so zubami a kopa dosiek.
    pc.stamp(cx + 5, cy - 4, ['.s.s.', 'sSSSs', '.SoS.', 'sSSSs', '.s.s.'], {
      s: P.stone,
      S: P.stoneLight,
      o: P.stoneDeep,
    });
    pc.stamp(cx - 2, cy + 3, ['pppppp', 'PPPPPP', 'pppppp'], { p: P.soilLight, P: P.wood });
  },

  farm: paintFarm(false),
  'farm+': paintFarm(true),

  quarry: paintQuarry,
  'quarry+': (pc, cx, cy) => {
    paintQuarry(pc, cx, cy);
    // Drevený žeriav s lanom a otesané bloky.
    pc.fillRect(cx - 8, cy - 22, 1, 18, P.woodDark);
    pc.fillRect(cx - 8, cy - 22, 12, 1, P.woodDark);
    pc.fillRect(cx + 3, cy - 21, 1, 8, P.stoneDeep);
    pc.stamp(cx + 1, cy - 13, ['SSSS', 'SLLS', 'SSSS'], { S: P.stoneDark, L: P.stoneLight });
    pc.stamp(cx - 13, cy + 1, ['LLL', 'SSS'], { S: P.stone, L: P.stoneLight });
  },

  well: (pc, cx, cy) => {
    isoBox(pc, cx, cy, 6, 4, { top: P.stone, left: P.stone, right: P.stoneDark });
    pc.fillDiamond(cx, cy - 4, 4, P.waterDeep);
    pc.fillRect(cx - 6, cy - 14, 1, 10, P.woodDark);
    pc.fillRect(cx + 5, cy - 14, 1, 10, P.woodDark);
    hipRoof(pc, cx, cy - 6, 6, 8, 4, P.roof, P.roofShade);
    pc.fillRect(cx - 1, cy - 9, 3, 1, P.woodShade);
  },

  warehouse: paintWarehouse(false),
  'warehouse@2': paintWarehouse(true),

  workshop: paintWorkshop,
  'workshop+': (pc, cx, cy) => {
    paintWorkshop(pc, cx, cy);
    // Kováčska vyhňa: žeravý otvor a nákova.
    const [fx, fy] = leftWall(cx, cy, 11, 8, 4);
    pc.stamp(fx, fy, ['ooo', 'oGo', 'GGG'], { o: P.stoneDeep, G: P.glow });
    pc.stamp(cx - 13, cy + 1, ['.SSSS', 'SSSS.', '..S..', '.SSS.'], { S: P.stoneDeep });
  },

  school: paintSchool,
  'school+': (pc, cx, cy) => {
    paintSchool(pc, cx, cy);
    // Zvonica na streche.
    isoBox(pc, cx - 4, cy - 24, 3, 6, { top: P.plaster, left: P.plaster, right: P.plasterShade });
    pc.set(cx - 4, cy - 26, P.wheat);
    pc.fillDiamond(cx - 4, cy - 31, 4, P.purpleShade);
  },

  'house@4': (pc, cx, cy) => {
    // Vila: biela omietka, stĺporadie, terakotová strecha, záhradka.
    const hw = 13;
    pc.fillDiamond(cx, cy + 1, 15, (x, y) => (pixelNoise(x, y, 9) < 0.3 ? P.grassLight : P.grass));
    isoBox(pc, cx, cy - 1, hw, 12, { top: P.white, left: P.white, right: P.plaster });
    for (const dx of [2, 6, 10]) {
      const [x, y] = rightWall(cx, cy - 1, hw, dx, 12);
      pc.fillRect(x, y, 1, 11, P.plasterShade);
    }
    hipRoof(pc, cx, cy - 1, hw, 12, 9, P.brick, P.brickShade);
    pc.stamp(...leftWall(cx, cy - 1, hw, 4, 9), WINDOW, DETAIL_PAL);
    pc.stamp(...leftWall(cx, cy - 1, hw, 9, 9), WINDOW, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy - 1, hw, 4, 5), DOOR, DETAIL_PAL);
    pc.stamp(cx - 14, cy + 1, ['.o.', 'oRo', '.o.'], { o: P.leafDark, R: P.roof });
  },

  'house@5': (pc, cx, cy) => {
    // Patricijský dom: trojpodlažný, kamenný sokel, modrá strecha, vežička.
    const hw = 13;
    isoBox(pc, cx, cy, hw, 7, { top: P.stone, left: P.stone, right: P.stoneDark });
    isoBox(pc, cx, cy - 7, hw, 14, { top: P.plaster, left: P.plaster, right: P.plasterShade });
    hipRoof(pc, cx, cy, hw, 21, 9, P.waterDeep, P.stoneDeep);
    for (const up of [11, 18]) {
      for (const dx of [3, 7, 11]) pc.stamp(...leftWall(cx, cy, hw, dx, up), WINDOW, DETAIL_PAL);
      for (const dx of [4, 9]) pc.stamp(...rightWall(cx, cy, hw, dx, up), WINDOW, DETAIL_PAL);
    }
    pc.stamp(...rightWall(cx, cy, hw, 4, 5), DOOR, DETAIL_PAL);
    isoBox(pc, cx + 6, cy - 22, 3, 8, { top: P.plaster, left: P.plaster, right: P.plasterShade });
    pc.fillDiamond(cx + 6, cy - 31, 4, P.waterDeep);
    pc.set(cx + 6, cy - 34, P.glow);
  },

  brickworks: (pc, cx, cy) => {
    // Tehelňa: hlinená pec s kupolou, komín, kopa tehál.
    const hw = 11;
    isoBox(pc, cx, cy, hw, 8, { top: P.brick, left: P.brick, right: P.brickShade });
    hipRoof(pc, cx, cy, hw, 8, 5, P.soilDark, P.woodDark);
    const [fx, fy] = leftWall(cx, cy, hw, 4, 5);
    pc.stamp(fx, fy, ['ooo', 'oGo', 'GGG'], { o: P.stoneDeep, G: P.glow });
    pc.fillRect(cx + 5, cy - 22, 3, 10, P.brickShade);
    pc.set(cx + 6, cy - 24, P.smoke);
    pc.set(cx + 7, cy - 26, P.smoke);
    pc.stamp(cx - 14, cy, ['rrrr', 'RRRR', 'rrrr', 'RRRR'], { r: P.brick, R: P.brickShade });
  },

  fishery: (pc, cx, cy) => {
    // Rybárska chata na mólach nad vodou a loďka.
    pc.fillDiamond(cx, cy, HW - 2, (x, y) => ((x + y) % 4 === 0 ? P.woodShade : P.wood));
    for (const [dx, dy] of [
      [-10, 2],
      [10, 2],
      [0, 6],
    ])
      pc.fillRect(cx + dx! - 1, cy + dy!, 2, 3, P.woodDark);
    isoBox(pc, cx - 2, cy - 2, 6, 6, { top: P.wood, left: P.wood, right: P.woodShade });
    hipRoof(pc, cx - 2, cy - 2, 6, 6, 5, P.waterDeep, P.stoneDeep);
    pc.stamp(cx + 4, cy - 1, ['.WWWW.', 'WwwwwW', '.WWWW.'], { W: P.woodDark, w: P.wood });
    pc.fillRect(cx + 6, cy - 7, 1, 6, P.woodDark);
    pc.stamp(cx + 7, cy - 7, ['ww', 'www', 'ww'], { w: P.plaster });
  },

  aqueduct: (pc, cx, cy) => {
    // Kamenné oblúky s vodným žľabom navrchu.
    isoBox(pc, cx, cy, 13, 12, { top: P.stoneLight, left: P.stoneLight, right: P.stone });
    pc.fillDiamond(cx, cy - 12, 9, P.water);
    for (const dx of [3, 9]) {
      const [x, y] = leftWall(cx, cy, 13, dx, 8);
      pc.fillRect(x, y, 3, 8, P.stoneDeep);
      pc.set(x + 1, y - 1, P.stoneDeep);
    }
    for (const dx of [3, 9]) {
      const [x, y] = rightWall(cx, cy, 13, dx, 8);
      pc.fillRect(x, y, 3, 8, P.stoneDeep);
      pc.set(x + 1, y - 1, P.stoneDeep);
    }
  },

  temple: (pc, cx, cy) => {
    // Chrám: podstavec, stĺpy, trojuholníkový štít.
    const hw = 13;
    isoBox(pc, cx, cy, hw, 3, { top: P.stoneLight, left: P.stoneLight, right: P.stone });
    isoBox(pc, cx, cy - 3, hw - 2, 11, { top: P.white, left: P.plaster, right: P.plasterShade });
    for (const dx of [1, 4, 7, 10]) {
      const [x, y] = leftWall(cx, cy - 3, hw - 2, dx, 11);
      pc.fillRect(x, y, 1, 11, P.white);
      const [rx, ry] = rightWall(cx, cy - 3, hw - 2, dx, 11);
      pc.fillRect(rx, ry, 1, 11, P.white);
    }
    hipRoof(pc, cx, cy - 3, hw - 2, 11, 7, P.white, P.stone);
    pc.set(cx, cy - 22, P.glow);
  },

  mine: (pc, cx, cy) => {
    // Baňa v kopci: vstup do štôlne s výdrevou, vozík s rudou.
    pc.fillPolygon(
      [
        [cx - 13, cy + 2],
        [cx - 4, cy - 9],
        [cx + 3, cy - 11],
        [cx + 13, cy + 2],
        [cx, cy + 7],
      ],
      (x) => (x < cx ? P.hillLight : P.hillDark),
    );
    pc.stamp(cx - 4, cy - 6, ['WWWWWWW', 'W.....W', 'W.ooo.W', 'W.ooo.W', 'W.ooo.W'], {
      W: P.woodDark,
      o: P.ink,
    });
    pc.stamp(cx + 4, cy, ['.ssss.', 'sSDSSs', 'oooooo', '.o..o.'], {
      s: P.stoneDeep,
      S: P.stone,
      D: P.brickShade,
      o: P.ink,
    });
  },

  smelter: (pc, cx, cy) => {
    // Huta: kamenná pec, vysoký komín, žeravé železo.
    const hw = 11;
    isoBox(pc, cx, cy, hw, 10, { top: P.stoneDark, left: P.stoneDark, right: P.stoneDeep });
    hipRoof(pc, cx, cy, hw, 10, 4, P.stoneDeep, P.ink);
    pc.fillRect(cx - 4, cy - 30, 4, 18, P.brickShade);
    pc.fillRect(cx - 4, cy - 30, 4, 1, P.ink);
    pc.set(cx - 3, cy - 32, P.smoke);
    pc.set(cx - 2, cy - 33, P.smoke);
    const [fx, fy] = leftWall(cx, cy, hw, 6, 6);
    pc.stamp(fx, fy, ['oooo', 'oGGo', 'GGGG'], { o: P.ink, G: P.wheat });
    pc.stamp(cx + 6, cy + 1, ['.ii.', 'iIIi'], { i: P.stoneDeep, I: P.stoneLight });
  },

  university: (pc, cx, cy) => {
    // Univerzita: veľká budova s kupolou a hodinami.
    const hw = 14;
    isoBox(pc, cx, cy, hw, 14, { top: P.brick, left: P.brick, right: P.brickShade });
    hipRoof(pc, cx, cy, hw, 14, 6, P.stoneDark, P.stoneDeep);
    for (const dx of [3, 7, 11]) pc.stamp(...leftWall(cx, cy, hw, dx, 11), WINDOW, DETAIL_PAL);
    for (const dx of [6, 10]) pc.stamp(...rightWall(cx, cy, hw, dx, 11), WINDOW, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy, hw, 3, 5), DOOR, DETAIL_PAL);
    isoBox(pc, cx, cy - 18, 5, 7, { top: P.plaster, left: P.plaster, right: P.plasterShade });
    pc.fillDiamond(cx, cy - 27, 5, P.grass);
    pc.fillDiamond(cx, cy - 29, 3, P.grassLight);
    pc.set(cx - 3, cy - 21, P.glow);
  },

  cathedral: (pc, cx, cy) => {
    // Katedrála: loď, dve veže so špicami, ružicové okno.
    const hw = 15;
    isoBox(pc, cx, cy, hw, 16, { top: P.stoneLight, left: P.stoneLight, right: P.stone });
    hipRoof(pc, cx, cy, hw, 16, 8, P.stoneDeep, P.ink);
    for (const dx of [3, 7, 11]) {
      const [x, y] = leftWall(cx, cy, hw, dx, 13);
      pc.fillRect(x, y, 2, 6, P.waterDeep);
      pc.set(x, y - 1, P.waterDeep);
    }
    pc.stamp(
      ...rightWall(cx, cy, hw, 4, 7),
      ['dddd', 'dDDd', 'dDDd', 'dDDd', 'dDDd', 'dDDd'],
      DETAIL_PAL,
    );
    pc.stamp(...rightWall(cx, cy, hw, 4, 13), ['.ww.', 'wgww', '.ww.'], {
      w: P.waterDeep,
      g: P.glow,
    });
    for (const ox of [-9, 9]) {
      isoBox(pc, cx + ox, cy - 2 + Math.abs(ox) / 3, 4, 26, {
        top: P.stoneLight,
        left: P.stoneLight,
        right: P.stone,
      });
      pc.fillPolygon(
        [
          [cx + ox - 4, cy - 28 + Math.abs(ox) / 3],
          [cx + ox + 4, cy - 28 + Math.abs(ox) / 3],
          [cx + ox, cy - 40 + Math.abs(ox) / 3],
        ],
        (x) => (x < cx + ox ? P.stoneDark : P.stoneDeep),
      );
    }
  },

  market: paintMarket(2),
  'market+': (pc, cx, cy) => {
    paintMarket(3)(pc, cx, cy);
    pc.fillRect(cx + 11, cy - 16, 1, 14, P.woodDark);
    pc.stamp(cx + 12, cy - 16, ['yy', 'rr', 'yy'], { y: P.wheat, r: P.roof });
  },
};

const FLAT: Record<string, Painter> = {
  // Hlinený chodník (pred Kamenárstvom).
  road: (pc, cx, cy) => {
    pc.fillDiamond(cx, cy, HW, (x, y) => {
      const rut = ((x >> 1) + y) % 8 === 2 || ((x >> 1) + y) % 8 === 5;
      if (rut) return P.soilDark;
      return pixelNoise(x, y, 41) < 0.1 ? P.soilLight : P.soil;
    });
  },
  // Dláždená cesta (po Kamenárstve).
  'road+': (pc, cx, cy) => {
    pc.fillDiamond(cx, cy, HW, (x, y) => {
      const joint = (x + 2 * y) % 6 === 0 || (x - 2 * y + 600) % 8 === 0;
      if (joint) return P.roadDark;
      return pixelNoise(x, y, 31) < 0.08 ? P.roadLight : P.road;
    });
  },
};

/** Technológia, ktorá zmení vzhľad budovy (rozpoznávací znak „+“ v kľúči sprite-u). */
export const TECH_LOOKS: Readonly<Record<string, string>> = {
  road: 'masonry',
  lumberjack: 'woodworking',
  farm: 'irrigation',
  quarry: 'masonry',
  workshop: 'labor_organization',
  school: 'education',
  market: 'city_administration',
};

/** Kľúč sprite-u podľa typu, úrovne a preskúmaných technológií. */
export function buildingSpriteKey(
  definitionId: string,
  level: number,
  completedTechnologyIds: readonly string[],
): string {
  if (level > 1 && PAINTERS[`${definitionId}@${level}`]) return `${definitionId}@${level}`;
  const tech = TECH_LOOKS[definitionId];
  if (tech && completedTechnologyIds.includes(tech)) return `${definitionId}+`;
  return definitionId;
}

export function drawBuilding(key: string): PixelSprite {
  const flat = FLAT[key];
  if (flat) {
    const { pc, cx, cy } = tileCanvas(0);
    flat(pc, cx, cy);
    return sprite(pc, cx, cy);
  }
  const { pc, cx, cy } = tileCanvas(BUILDING_TOP);
  const painter = PAINTERS[key];
  if (painter) painter(pc, cx, cy);
  else isoBox(pc, cx, cy, 8, 8, { top: 0xff00ff, left: 0xcc00cc, right: 0x990099 });
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

export type MarkerKind =
  'road' | 'workers' | 'understaffed' | 'goods' | 'money' | 'storage' | 'upgrade';

const MARKER_GLYPHS: Record<MarkerKind, { bubble: Rgb; glyph: string[] }> = {
  // Cesta s prerušovanou stredovou čiarou.
  road: { bubble: P.roof, glyph: ['w...w', 'w.y.w', 'w...w', 'w.y.w', 'w...w'] },
  // Postavička.
  workers: { bubble: P.roof, glyph: ['.www.', '.www.', 'wwwww', '.www.', '.w.w.'] },
  understaffed: { bubble: 0xf77622, glyph: ['.www.', '.www.', 'wwwww', '.www.', '.w.w.'] },
  // Debnička (chýba surovina alebo nástroje).
  goods: { bubble: P.roof, glyph: ['wwwww', 'w.w.w', 'wwwww', 'w.w.w', 'wwwww'] },
  // Minca.
  money: { bubble: P.roof, glyph: ['.yyy.', 'yyoyy', 'yoyyy', 'yyoyy', '.yyy.'] },
  // Plný sklad — tmavá debna na žltej.
  storage: { bubble: P.wheat, glyph: ['ooooo', 'o.o.o', 'ooooo', 'o.o.o', 'ooooo'] },
  // Šípka hore — budova sa dá vylepšiť.
  upgrade: { bubble: 0x3e8948, glyph: ['..w..', '.www.', 'wwwww', '..w..', '..w..'] },
};

/** Bublina so symbolom nad budovou; kotva v dolnom hrote. */
export function drawMarker(kind: MarkerKind): PixelSprite {
  const { bubble, glyph } = MARKER_GLYPHS[kind];
  const pc = new PixelCanvas(9, 10);
  pc.stamp(
    0,
    0,
    [
      '.ooooooo.',
      'oBBBBBBBo',
      'oBBBBBBBo',
      'oBBBBBBBo',
      'oBBBBBBBo',
      'oBBBBBBBo',
      'oBBBBBBBo',
      '.ooooooo.',
      '...oBo...',
      '....o....',
    ],
    { o: P.ink, B: bubble },
  );
  pc.stamp(2, 1, glyph, { w: P.white, y: P.glow, o: P.ink });
  return { canvas: pc, anchorX: 4, anchorY: 9 };
}

// --- Ikony surovín (8 × 8) ------------------------------------------------------------

export type IconKind =
  'food' | 'wood' | 'stone' | 'tools' | 'knowledge' | 'bricks' | 'iron' | 'money';

const ICONS: Record<IconKind, { rows: string[]; pal: Record<string, Rgb> }> = {
  food: {
    rows: [
      '..y.y...',
      '.yYyYy..',
      '..yYy...',
      '.yYyYy..',
      '..yYy...',
      '...g....',
      '...g....',
      '..ggg...',
    ],
    pal: { y: P.wheat, Y: P.wheatLight, g: P.soilDark },
  },
  wood: {
    rows: [
      '........',
      '..oooo..',
      '.oWWWWo.',
      'oWwWWwWo',
      'oWWWWWWo',
      '.oWwwWo.',
      '..oooo..',
      '........',
    ],
    pal: { o: P.woodDark, W: P.wood, w: P.soilLight },
  },
  stone: {
    rows: [
      '........',
      '...oo...',
      '..oLSo..',
      '.oLSSDo.',
      'oLSSSDDo',
      'oSSDDDDo',
      '.oooooo.',
      '........',
    ],
    pal: { o: P.stoneDeep, L: P.stoneLight, S: P.stone, D: P.stoneDark },
  },
  tools: {
    rows: [
      '.ssss...',
      'sSSSSs..',
      '.ss.Ss..',
      '....w...',
      '...w....',
      '..w.....',
      '.w......',
      'w.......',
    ],
    pal: { s: P.stoneDeep, S: P.stoneLight, w: P.wood },
  },
  knowledge: {
    rows: [
      '.pppppp.',
      'pPPPPPPp',
      '.PllllP.',
      '.PPPPPP.',
      '.PllllP.',
      '.PPPPPP.',
      'pPPPPPPp',
      '.pppppp.',
    ],
    pal: { p: P.plasterDark, P: P.plaster, l: P.woodShade },
  },
  bricks: {
    rows: [
      '........',
      'rrrRrrrR',
      'RRRRRRRR',
      'rRrrrRrr',
      'RRRRRRRR',
      'rrrRrrrR',
      'RRRRRRRR',
      '........',
    ],
    pal: { r: P.brick, R: P.brickShade },
  },
  iron: {
    rows: [
      '........',
      '........',
      '..LLLL..',
      '.LSSSSL.',
      'LSSSSSSD',
      'DDDDDDDD',
      '........',
      '........',
    ],
    pal: { L: P.stoneLight, S: P.stone, D: P.stoneDeep },
  },
  money: {
    rows: [
      '..oooo..',
      '.oyyyyo.',
      'oyYyyyyo',
      'oyYyyyyo',
      'oyyyyyyo',
      'oyyyyyYo',
      '.oyyyyo.',
      '..oooo..',
    ],
    pal: { o: 0xb86f00, y: P.wheat, Y: P.wheatLight },
  },
};

export function drawIcon(kind: IconKind): PixelCanvas {
  const pc = new PixelCanvas(8, 8);
  pc.stamp(0, 0, ICONS[kind].rows, ICONS[kind].pal);
  return pc;
}
