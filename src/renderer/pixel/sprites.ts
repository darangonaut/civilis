import type { ResourceId, TerrainType } from '@/types';
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
  // Hlinený chodník: svetlý piesok, nie červenohnedá ornica (tá patrí úrodnej pôde).
  dirt: 0xd9b97c,
  dirtDark: 0xb08a55,
  dirtLight: 0xecd6a0,
  dirtEdge: 0x7d6a3e,
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
  glow: 0xfff3a8,
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
const BUILDING_TOP = 56;

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

  'house@6': (pc, cx, cy) => {
    // Renesančný palác: symetrická fasáda, arkády, kupola.
    const hw = 14;
    isoBox(pc, cx, cy, hw, 18, { top: P.plaster, left: P.plaster, right: P.plasterShade });
    for (const dx of [2, 6, 10]) {
      const [x, y] = leftWall(cx, cy, hw, dx, 7);
      pc.fillRect(x, y, 2, 6, P.plasterDark);
      pc.stamp(...leftWall(cx, cy, hw, dx, 15), WINDOW, DETAIL_PAL);
    }
    for (const dx of [3, 8]) pc.stamp(...rightWall(cx, cy, hw, dx, 15), WINDOW, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy, hw, 5, 5), DOOR, DETAIL_PAL);
    hipRoof(pc, cx, cy, hw, 18, 6, P.brick, P.brickShade);
    pc.fillDiamond(cx, cy - 27, 5, P.grassDark);
    pc.fillDiamond(cx, cy - 29, 3, P.grass);
  },

  'house@7': (pc, cx, cy) => {
    // Mestský činžiak: štvorpodlažný tehlový blok s plochou strechou a komínmi.
    const hw = 13;
    isoBox(pc, cx, cy, hw, 26, { top: P.stoneDark, left: P.brick, right: P.brickShade });
    for (let up = 6; up < 26; up += 5) {
      for (const dx of [2, 6, 10]) pc.stamp(...leftWall(cx, cy, hw, dx, up), WINDOW, DETAIL_PAL);
      for (const dx of [3, 8]) pc.stamp(...rightWall(cx, cy, hw, dx, up), WINDOW, DETAIL_PAL);
    }
    pc.stamp(...rightWall(cx, cy, hw, 5, 5), DOOR, DETAIL_PAL);
    pc.fillRect(cx - 6, cy - 32, 2, 5, P.stoneDeep);
    pc.fillRect(cx + 5, cy - 31, 2, 5, P.stoneDeep);
  },

  'house@8': (pc, cx, cy) => {
    // Mrakodrap: vysoká oceľovo-sklenená veža.
    const hw = 10;
    isoBox(pc, cx, cy, hw, 40, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
    for (let up = 6; up < 40; up += 4) {
      for (const dx of [2, 5, 8]) {
        const [x, y] = leftWall(cx, cy, hw, dx, up);
        pc.fillRect(x, y, 2, 2, up % 8 ? P.waterLight : P.glow);
        const [rx, ry] = rightWall(cx, cy, hw, dx, up);
        pc.fillRect(rx, ry, 2, 2, P.waterDeep);
      }
    }
    pc.fillRect(cx, cy - 47, 1, 6, P.stoneDeep);
    pc.set(cx, cy - 48, P.roof);
  },

  'house@9': (pc, cx, cy) => {
    // Inteligentný dom: biela moderná budova so zelenou strechou a solárnymi panelmi.
    const hw = 12;
    isoBox(pc, cx, cy, hw, 30, { top: P.grassLight, left: P.white, right: P.plaster });
    for (let up = 5; up < 30; up += 6) {
      const [x, y] = leftWall(cx, cy, hw, 1, up);
      pc.fillRect(x, y - 1, 11, 2, P.waterLight);
      const [rx, ry] = rightWall(cx, cy, hw, 1, up);
      pc.fillRect(rx, ry - 1, 10, 2, P.waterDeep);
    }
    pc.fillDiamond(cx, cy - 30, 7, (x, y) => ((x + y) % 3 === 0 ? P.waterLight : 0x262b44));
  },

  'house@10': (pc, cx, cy) => {
    // Arkológia: stupňovitá megaštruktúra so zeleňou na terasách.
    isoBox(pc, cx, cy, 15, 12, { top: P.grass, left: P.white, right: P.stoneLight });
    isoBox(pc, cx, cy - 12, 11, 12, { top: P.grassLight, left: P.white, right: P.stoneLight });
    isoBox(pc, cx, cy - 24, 7, 12, { top: P.grass, left: P.white, right: P.stoneLight });
    for (const [hw, base] of [
      [15, 0],
      [11, 12],
      [7, 24],
    ] as const) {
      for (let dx = 2; dx < hw; dx += 3) {
        const [x, y] = leftWall(cx, cy - base, hw, dx, base + 7);
        pc.fillRect(x, y, 2, 2, P.waterLight);
      }
    }
    pc.fillRect(cx, cy - 44, 1, 8, P.stoneDeep);
    pc.set(cx, cy - 45, P.waterLight);
  },

  pasture: (pc, cx, cy) => {
    pc.fillDiamond(cx, cy, HW - 1, (x, y) =>
      pixelNoise(x, y, 13) < 0.08 ? P.grassLight : P.grass,
    );
    for (const [dx, dy] of [
      [-7, -2],
      [4, -3],
      [-2, 2],
      [7, 2],
    ])
      pc.stamp(cx + dx! - 2, cy + dy! - 2, ['.ww.', 'wwww', 'kwwk', '.k.k'], {
        w: P.white,
        k: P.ink,
      });
    // Plot
    for (let dx = -14; dx <= 14; dx += 4)
      pc.fillRect(cx + dx, cy + 6 - Math.abs(dx) / 2 - 2, 1, 3, P.woodDark);
  },

  harbor: (pc, cx, cy) => {
    pc.fillDiamond(cx, cy, HW - 3, (x, y) => ((x + y) % 4 === 0 ? P.woodShade : P.wood));
    isoBox(pc, cx - 5, cy - 2, 5, 7, { top: P.brick, left: P.brick, right: P.brickShade });
    hipRoof(pc, cx - 5, cy - 2, 5, 7, 4, P.stoneDark, P.stoneDeep);
    // Plachetnica
    pc.stamp(cx + 1, cy - 2, ['.WWWWWW.', 'WwwwwwwW', '.WWWWWW.'], { W: P.woodDark, w: P.wood });
    pc.fillRect(cx + 4, cy - 18, 1, 16, P.woodDark);
    pc.fillPolygon(
      [
        [cx + 5, cy - 18],
        [cx + 12, cy - 5],
        [cx + 5, cy - 5],
      ],
      P.white,
    );
  },

  printing_house: (pc, cx, cy) => {
    const hw = 12;
    isoBox(pc, cx, cy, hw, 12, { top: P.wood, left: P.plaster, right: P.plasterShade });
    for (let dx = 1; dx < hw; dx += 3) {
      const [x, y] = leftWall(cx, cy, hw, dx, 12);
      pc.fillRect(x, y, 1, 12, P.woodDark);
    }
    hipRoof(pc, cx, cy, hw, 12, 7, P.roofShade, P.roofDark);
    pc.stamp(...leftWall(cx, cy, hw, 5, 9), WINDOW, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy, hw, 4, 5), DOOR, DETAIL_PAL);
    pc.stamp(cx - 14, cy + 1, ['pppp', 'PPPP', 'pppp'], { p: P.white, P: P.plaster });
  },

  observatory: (pc, cx, cy) => {
    isoBox(pc, cx, cy, 12, 10, { top: P.stoneLight, left: P.stoneLight, right: P.stone });
    pc.fillPolygon(
      [
        [cx - 8, cy - 10],
        [cx - 6, cy - 17],
        [cx, cy - 20],
        [cx + 6, cy - 17],
        [cx + 8, cy - 10],
      ],
      (x) => (x < cx ? P.white : P.stoneLight),
    );
    pc.fillRect(cx - 1, cy - 20, 2, 9, P.stoneDeep);
    pc.fillRect(cx + 1, cy - 25, 6, 2, P.woodDark);
    pc.stamp(...rightWall(cx, cy, 12, 4, 5), DOOR, DETAIL_PAL);
  },

  theater: (pc, cx, cy) => {
    const hw = 14;
    isoBox(pc, cx, cy, hw, 16, { top: P.roof, left: P.plaster, right: P.plasterShade });
    for (const dx of [2, 5, 8, 11]) {
      const [x, y] = leftWall(cx, cy, hw, dx, 14);
      pc.fillRect(x, y, 1, 13, P.white);
    }
    hipRoof(pc, cx, cy, hw, 16, 6, P.roof, P.roofShade);
    pc.stamp(...rightWall(cx, cy, hw, 5, 6), ['RRRR', 'RggR', 'RRRR', 'RRRR'], {
      R: P.roofDark,
      g: P.glow,
    });
    pc.fillRect(cx + 10, cy - 26, 1, 6, P.woodDark);
    pc.fillRect(cx + 11, cy - 26, 3, 2, P.wheat);
  },

  coal_mine: (pc, cx, cy) => {
    pc.fillPolygon(
      [
        [cx - 13, cy + 2],
        [cx - 3, cy - 9],
        [cx + 13, cy + 2],
        [cx, cy + 7],
      ],
      (x) => (x < cx ? P.stoneDark : P.stoneDeep),
    );
    // Ťažná veža
    pc.fillRect(cx + 2, cy - 22, 1, 20, P.woodDark);
    pc.fillRect(cx + 8, cy - 22, 1, 20, P.woodDark);
    pc.fillRect(cx + 2, cy - 22, 7, 1, P.woodDark);
    pc.stamp(cx + 3, cy - 26, ['.ooo.', 'o.o.o', '.ooo.'], { o: P.ink });
    pc.stamp(cx - 9, cy - 1, ['.kkkk.', 'kKkKKk', 'oooooo', '.o..o.'], {
      k: P.ink,
      K: 0x262b44,
      o: P.woodDark,
    });
  },

  steelworks: (pc, cx, cy) => {
    const hw = 14;
    isoBox(pc, cx, cy, hw, 12, { top: P.stoneDeep, left: P.stoneDark, right: P.stoneDeep });
    for (const ox of [-6, 0, 6]) {
      pc.fillRect(cx + ox - 1, cy - 34, 3, 22, P.brickShade);
      pc.set(cx + ox, cy - 36, P.smoke);
      pc.set(cx + ox + 1, cy - 38, P.smoke);
    }
    const [fx, fy] = leftWall(cx, cy, hw, 4, 7);
    pc.stamp(fx, fy, ['oooooo', 'oGGGGo', 'GGGGGG'], { o: P.ink, G: P.wheat });
  },

  textile_factory: (pc, cx, cy) => {
    const hw = 14;
    isoBox(pc, cx, cy, hw, 14, { top: P.brick, left: P.brick, right: P.brickShade });
    // Pílová strecha
    for (let dx = -12; dx < 12; dx += 6) {
      pc.fillPolygon(
        [
          [cx + dx, cy - 14 + Math.abs(dx) / 4],
          [cx + dx + 6, cy - 14 + Math.abs(dx) / 4],
          [cx + dx + 6, cy - 19 + Math.abs(dx) / 4],
        ],
        P.stoneDark,
      );
    }
    for (let dx = 2; dx < hw; dx += 3)
      pc.stamp(...leftWall(cx, cy, hw, dx, 10), ['gg', 'ww'], { g: P.glow, w: P.window });
    pc.fillRect(cx + 9, cy - 34, 3, 18, P.brickShade);
    pc.set(cx + 10, cy - 36, P.smoke);
  },

  railway_station: (pc, cx, cy) => {
    pc.fillDiamond(cx, cy + 2, 15, (x, y) =>
      ((x >> 1) + y) % 4 === 0 ? P.stoneDeep : P.stoneDark,
    );
    isoBox(pc, cx - 2, cy - 2, 11, 12, { top: P.brick, left: P.brick, right: P.brickShade });
    hipRoof(pc, cx - 2, cy - 2, 11, 12, 6, P.stoneDark, P.stoneDeep);
    pc.fillDiamond(cx - 2, cy - 22, 3, P.white);
    pc.set(cx - 2, cy - 22, P.ink);
    pc.stamp(cx + 5, cy + 1, ['.KKKK.', 'KrKKKK', 'oo..oo'], {
      K: P.ink,
      r: P.roof,
      o: P.stoneDark,
    });
  },

  waterworks: (pc, cx, cy) => {
    isoBox(pc, cx, cy, 12, 8, { top: P.brick, left: P.brick, right: P.brickShade });
    // Vodojem na stĺpoch
    pc.fillRect(cx - 4, cy - 26, 1, 18, P.stoneDeep);
    pc.fillRect(cx + 4, cy - 26, 1, 18, P.stoneDeep);
    isoBox(pc, cx, cy - 26, 7, 8, { top: P.waterLight, left: P.stoneLight, right: P.stone });
    pc.fillDiamond(cx, cy - 34, 7, P.water);
  },

  exhibition_palace: (pc, cx, cy) => {
    // Výstavný palác: železo a sklo, veľká klenba.
    const hw = 15;
    isoBox(pc, cx, cy, hw, 10, { top: P.waterLight, left: P.stoneLight, right: P.stone });
    pc.fillPolygon(
      [
        [cx - 15, cy - 10],
        [cx - 10, cy - 24],
        [cx, cy - 30],
        [cx + 10, cy - 24],
        [cx + 15, cy - 10],
        [cx, cy - 2],
      ],
      (x, y) => ((x + y) % 4 === 0 ? P.stoneDeep : x < cx ? P.waterLight : P.water),
    );
    pc.fillRect(cx, cy - 38, 1, 8, P.stoneDeep);
    pc.fillRect(cx + 1, cy - 38, 4, 2, P.roof);
  },

  power_plant: (pc, cx, cy) => {
    const hw = 13;
    isoBox(pc, cx, cy, hw, 14, { top: P.stoneDark, left: P.brick, right: P.brickShade });
    for (const ox of [-5, 5]) {
      pc.fillPolygon(
        [
          [cx + ox - 4, cy - 12],
          [cx + ox - 3, cy - 36],
          [cx + ox + 3, cy - 36],
          [cx + ox + 4, cy - 12],
        ],
        P.stoneLight,
      );
      pc.set(cx + ox, cy - 38, P.smoke);
      pc.set(cx + ox + 1, cy - 40, P.smoke);
    }
    pc.stamp(...rightWall(cx, cy, hw, 6, 8), ['.y.', 'yyy', '.y.'], { y: P.glow });
  },

  hospital: (pc, cx, cy) => {
    const hw = 13;
    isoBox(pc, cx, cy, hw, 20, { top: P.white, left: P.white, right: P.plaster });
    for (let up = 6; up < 20; up += 5)
      for (const dx of [2, 6, 10])
        pc.stamp(...leftWall(cx, cy, hw, dx, up), ['ww', 'ww'], { w: P.waterLight });
    pc.stamp(...rightWall(cx, cy, hw, 4, 16), ['.r.', 'rrr', '.r.'], { r: P.roof });
    pc.stamp(...rightWall(cx, cy, hw, 4, 5), DOOR, DETAIL_PAL);
  },

  cold_storage: (pc, cx, cy) => {
    isoBox(pc, cx, cy, 14, 12, { top: P.stoneLight, left: P.white, right: P.stoneLight });
    for (let dx = 2; dx < 14; dx += 3) {
      const [x, y] = leftWall(cx, cy, 14, dx, 12);
      pc.fillRect(x, y + 1, 1, 11, P.stoneLight);
    }
    pc.stamp(...rightWall(cx, cy, 14, 4, 6), ['bbbb', 'bWWb', 'bWWb', 'bWWb'], {
      b: P.waterDeep,
      W: P.waterLight,
    });
  },

  assembly_plant: (pc, cx, cy) => {
    const hw = 15;
    isoBox(pc, cx, cy, hw, 12, { top: P.stoneDark, left: P.stoneLight, right: P.stone });
    for (let dx = 2; dx < hw; dx += 3)
      pc.stamp(...leftWall(cx, cy, hw, dx, 9), ['gg'], { g: P.glow });
    pc.stamp(cx - 13, cy + 2, ['.rrrr.', 'rRrrRr', 'oo..oo'], {
      r: P.roof,
      R: P.waterLight,
      o: P.ink,
    });
    pc.fillRect(cx + 8, cy - 26, 3, 14, P.stoneDeep);
  },

  radio_station: (pc, cx, cy) => {
    isoBox(pc, cx - 3, cy + 1, 8, 7, { top: P.white, left: P.white, right: P.plaster });
    // Anténa
    for (let i = 0; i < 40; i++) {
      const w = Math.max(1, Math.floor((40 - i) / 10));
      pc.fillRect(cx + 5 - Math.floor(w / 2), cy - i, w, 1, i % 6 < 3 ? P.roof : P.white);
    }
    pc.set(cx + 5, cy - 41, P.glow);
  },

  department_store: (pc, cx, cy) => {
    const hw = 14;
    isoBox(pc, cx, cy, hw, 18, { top: P.stoneDark, left: P.plaster, right: P.plasterShade });
    for (let dx = 1; dx < hw; dx += 3)
      pc.stamp(...leftWall(cx, cy, hw, dx, 7), ['WW', 'WW', 'WW'], { W: P.waterLight });
    for (const up of [12, 16])
      for (let dx = 2; dx < hw; dx += 4)
        pc.stamp(...leftWall(cx, cy, hw, dx, up), ['ww'], { w: P.window });
    pc.stamp(...rightWall(cx, cy, hw, 2, 10), ['rwrwrwrw'], { r: P.roof, w: P.white });
  },

  electronics_factory: (pc, cx, cy) => {
    const hw = 15;
    isoBox(pc, cx, cy, hw, 12, { top: P.white, left: P.white, right: P.stoneLight });
    for (let dx = 1; dx < hw; dx += 2) {
      const [x, y] = leftWall(cx, cy, hw, dx, 8);
      pc.fillRect(x, y, 1, 3, P.waterDeep);
    }
    pc.stamp(...rightWall(cx, cy, hw, 4, 9), ['GGGG', 'GyyG', 'GGGG'], { G: 0x265c42, y: P.glow });
  },

  nuclear_plant: (pc, cx, cy) => {
    // Chladiaca veža + reaktorová kupola.
    pc.fillPolygon(
      [
        [cx - 13, cy + 2],
        [cx - 9, cy - 22],
        [cx - 1, cy - 22],
        [cx + 3, cy + 2],
      ],
      (x) => (x < cx - 5 ? P.stoneLight : P.stone),
    );
    pc.fillDiamond(cx - 5, cy - 22, 4, P.stoneDeep);
    pc.set(cx - 5, cy - 25, P.smoke);
    pc.set(cx - 4, cy - 28, P.smoke);
    isoBox(pc, cx + 7, cy + 1, 6, 8, { top: P.white, left: P.white, right: P.stoneLight });
    pc.fillDiamond(cx + 7, cy - 9, 5, P.stoneLight);
    pc.set(cx + 7, cy - 6, P.glow);
  },

  data_center: (pc, cx, cy) => {
    const hw = 13;
    isoBox(pc, cx, cy, hw, 12, { top: P.stoneDark, left: 0x262b44, right: P.ink });
    for (let up = 3; up < 12; up += 3) {
      for (let dx = 1; dx < hw; dx += 2) {
        const [x, y] = leftWall(cx, cy, hw, dx, up);
        pc.set(x, y, (dx + up) % 3 ? P.grassLight : P.waterLight);
      }
    }
    pc.fillRect(cx - 2, cy - 20, 1, 8, P.stoneLight);
    pc.fillRect(cx + 4, cy - 18, 1, 6, P.stoneLight);
  },

  solar_park: (pc, cx, cy) => {
    pc.fillDiamond(cx, cy, HW - 1, (x, y) => (pixelNoise(x, y, 5) < 0.1 ? P.grassLight : P.grass));
    for (const [dx, dy] of [
      [-8, -1],
      [0, -3],
      [8, -1],
      [-4, 3],
      [4, 3],
    ])
      pc.fillDiamond(cx + dx!, cy + dy! - 2, 4, (x, y) => ((x + y) % 2 ? 0x124e89 : 0x262b44));
  },

  vertical_farm: (pc, cx, cy) => {
    const hw = 10;
    isoBox(pc, cx, cy, hw, 34, { top: P.grassLight, left: P.waterLight, right: P.water });
    for (let up = 3; up < 34; up += 4) {
      const [x, y] = leftWall(cx, cy, hw, 0, up);
      pc.fillRect(x, y - 1, 10, 2, P.grass);
      const [rx, ry] = rightWall(cx, cy, hw, 0, up);
      pc.fillRect(rx, ry - 1, 10, 2, P.grassDark);
    }
  },

  robot_factory: (pc, cx, cy) => {
    const hw = 14;
    isoBox(pc, cx, cy, hw, 12, { top: P.stoneLight, left: P.white, right: P.stoneLight });
    pc.stamp(cx - 13, cy - 6, ['..o..', '.ooo.', '..o..', '.o.o.', 'o...o', 'SSSSS'], {
      o: 0xf77622,
      S: P.stoneDeep,
    });
    pc.stamp(...rightWall(cx, cy, hw, 4, 9), ['bbbbbb', 'byybyb', 'bbbbbb'], {
      b: P.waterDeep,
      y: P.glow,
    });
  },

  fusion_reactor: (pc, cx, cy) => {
    isoBox(pc, cx, cy, 15, 8, { top: P.stoneLight, left: P.white, right: P.stoneLight });
    // Prstenec tokamaku so žiarou
    pc.fillDiamond(cx, cy - 14, 12, P.stoneDark);
    pc.fillDiamond(cx, cy - 14, 8, P.waterLight);
    pc.fillDiamond(cx, cy - 14, 5, P.white);
    pc.fillDiamond(cx, cy - 14, 2, P.glow);
  },

  ai_center: (pc, cx, cy) => {
    const hw = 13;
    isoBox(pc, cx, cy, hw, 22, { top: P.ink, left: 0x262b44, right: P.ink });
    for (let up = 4; up < 22; up += 3) {
      const [x, y] = leftWall(cx, cy, hw, 1, up);
      pc.fillRect(x, y, 11, 1, up % 2 ? P.waterLight : 0x124e89);
    }
    pc.fillDiamond(cx, cy - 26, 5, P.waterLight);
    pc.fillDiamond(cx, cy - 26, 2, P.white);
  },

  nano_foundry: (pc, cx, cy) => {
    const hw = 13;
    isoBox(pc, cx, cy, hw, 14, { top: P.purpleShade, left: P.white, right: P.stoneLight });
    pc.fillDiamond(cx, cy - 14, 9, (x, y) => ((x + y) % 3 ? P.purple : P.purpleShade));
    pc.stamp(...rightWall(cx, cy, hw, 4, 10), ['.p.', 'pPp', '.p.'], { p: P.purple, P: P.glow });
  },

  space_port: (pc, cx, cy) => {
    // Štartovacia rampa a raketa.
    pc.fillDiamond(cx, cy, 15, (x, y) => ((x + 2 * y) % 6 === 0 ? P.stoneDeep : P.stoneDark));
    pc.fillRect(cx - 6, cy - 40, 2, 38, P.stoneDeep);
    pc.fillRect(cx - 6, cy - 30, 6, 1, P.stoneDeep);
    pc.fillRect(cx, cy - 44, 4, 40, P.white);
    pc.fillRect(cx + 3, cy - 44, 1, 40, P.stoneLight);
    pc.fillPolygon(
      [
        [cx, cy - 44],
        [cx + 4, cy - 44],
        [cx + 2, cy - 50],
      ],
      P.roof,
    );
    pc.stamp(cx - 2, cy - 8, ['r......r', 'rr....rr'], { r: P.roof });
    pc.set(cx + 1, cy - 2, P.glow);
    pc.set(cx + 2, cy - 1, 0xf77622);
  },

  market: paintMarket(2),
  'market+': (pc, cx, cy) => {
    paintMarket(3)(pc, cx, cy);
    pc.fillRect(cx + 11, cy - 16, 1, 14, P.woodDark);
    pc.stamp(cx + 12, cy - 16, ['yy', 'rr', 'yy'], { y: P.wheat, r: P.roof });
  },
};

// --- Úrovne výrobných budov -------------------------------------------------------------

/** Komín: obdĺžnik šírky 3 px od `top` nadol. */
const chimney = (pc: PixelCanvas, x: number, top: number, h: number, color: Rgb = P.stoneDeep) =>
  pc.fillRect(x, top, 3, h, color);

const CRATES = ['oooo', 'oWWo', 'oWWo', 'oooo'];
const CRATES_PAL = { o: P.woodDark, W: P.wood };
const BRICK_PILE = ['rrrr', 'RRRR', 'rrrr', 'RRRR'];
const BRICK_PAL = { r: P.brick, R: P.brickShade };
const SHEEP = ['.ww.', 'wwww', 'kwwk', '.k.k'];
const SHEEP_PAL = { w: P.white, k: P.ink };
const HAY = ['.yy.', 'yYYy', 'YYYY'];
const HAY_PAL = { y: P.wheatLight, Y: P.wheat };

const pastureGround: Painter = (pc, cx, cy) =>
  pc.fillDiamond(cx, cy, HW - 1, (x, y) => (pixelNoise(x, y, 13) < 0.08 ? P.grassLight : P.grass));

const pastureFence: Painter = (pc, cx, cy) => {
  for (let dx = -14; dx <= 14; dx += 4)
    pc.fillRect(cx + dx, cy + 6 - Math.abs(dx) / 2 - 2, 1, 3, P.woodDark);
};

/** Ťažná veža nad šachtou (drevená alebo oceľová). */
function headframe(pc: PixelCanvas, x: number, top: number, bottom: number, color: Rgb, thick = 1) {
  pc.fillRect(x, top, thick, bottom - top, color);
  pc.fillRect(x + 6, top, thick, bottom - top, color);
  pc.fillRect(x, top, 6 + thick, 1, color);
  for (let y = top + 4; y < bottom - 2; y += 5) pc.fillRect(x, y, 6 + thick, 1, color);
  pc.stamp(x + 1, top - 4, ['.ooo.', 'o.o.o', '.ooo.'], { o: P.ink });
}

const LEVEL_PAINTERS: Record<string, Painter> = {
  'lumberjack@2': (pc, cx, cy) => {
    // Píla: kryté skladisko dosiek vzadu, píla a viac dreva.
    isoBox(pc, cx - 6, cy - 5, 5, 5, { top: P.wood, left: P.wood, right: P.woodShade });
    hipRoof(pc, cx - 6, cy - 5, 5, 5, 4, P.roof, P.roofShade);
    PAINTERS['lumberjack+']!(pc, cx, cy);
    LOG_PILE(pc, cx + 7, cy + 2);
  },
  'lumberjack@3': (pc, cx, cy) => {
    // Lesný závod: tehlová hala s parnou pílou a komínom.
    const hw = 11;
    isoBox(pc, cx + 1, cy - 1, hw, 9, { top: P.brick, left: P.brick, right: P.brickShade });
    hipRoof(pc, cx + 1, cy - 1, hw, 9, 6, P.stoneDark, P.stoneDeep);
    chimney(pc, cx + 6, cy - 27, 15);
    pc.stamp(...leftWall(cx + 1, cy - 1, hw, 3, 7), WINDOW, DETAIL_PAL);
    pc.stamp(...rightWall(cx + 1, cy - 1, hw, 3, 5), DOOR, DETAIL_PAL);
    pc.stamp(
      ...rightWall(cx + 1, cy - 1, hw, 7, 7),
      ['.s.s.', 'sSSSs', '.SoS.', 'sSSSs', '.s.s.'],
      {
        s: P.stone,
        S: P.stoneLight,
        o: P.stoneDeep,
      },
    );
    LOG_PILE(pc, cx - 14, cy);
    LOG_PILE(pc, cx - 10, cy + 3);
    pc.stamp(cx - 4, cy + 4, ['pppppp', 'PPPPPP', 'pppppp'], { p: P.soilLight, P: P.wood });
  },

  'farm@2': (pc, cx, cy) => {
    // Statok: zavlažované polia, veterník a stoh sena.
    paintFarm(true)(pc, cx, cy);
    pc.stamp(cx - 11, cy, HAY, HAY_PAL);
    pc.stamp(cx - 7, cy + 3, HAY, HAY_PAL);
  },
  'farm@3': (pc, cx, cy) => {
    // Mechanizovaná farma: silo a traktor.
    paintFarm(true)(pc, cx, cy);
    isoBox(pc, cx - 9, cy - 3, 3, 14, { top: P.stoneLight, left: P.stoneLight, right: P.stone });
    pc.fillDiamond(cx - 9, cy - 18, 3, P.roof);
    pc.stamp(cx + 1, cy + 2, ['.rr...', '.rRr..', 'rrrrrr', 'kok.kk', '.k...k'], {
      r: P.roof,
      R: P.window,
      k: P.ink,
      o: P.stoneDeep,
    });
  },

  'quarry@2': (pc, cx, cy) => {
    // Veľký lom: drevený žeriav a viac otesaných blokov.
    PAINTERS['quarry+']!(pc, cx, cy);
    pc.stamp(cx + 7, cy + 1, ['LLL', 'SSS'], { S: P.stone, L: P.stoneLight });
    pc.stamp(cx - 6, cy + 4, ['LLLL', 'SSSS'], { S: P.stone, L: P.stoneLight });
  },
  'quarry@3': (pc, cx, cy) => {
    // Strojový lom: oceľový žeriav a parný stroj.
    paintQuarry(pc, cx, cy);
    pc.fillRect(cx - 10, cy - 26, 2, 22, P.stoneDeep);
    pc.fillRect(cx - 10, cy - 26, 16, 2, P.stoneDeep);
    for (let x = cx - 8; x < cx + 6; x += 3) pc.set(x, cy - 24, P.stoneDeep);
    pc.fillRect(cx + 4, cy - 24, 1, 9, P.ink);
    pc.stamp(cx + 2, cy - 15, ['SSSS', 'SLLS', 'SSSS'], { S: P.stoneDark, L: P.stoneLight });
    isoBox(pc, cx + 9, cy, 4, 5, { top: P.brick, left: P.brick, right: P.brickShade });
    chimney(pc, cx + 9, cy - 15, 9, P.ink);
  },

  'workshop@2': (pc, cx, cy) => {
    // Remeselnícka dielňa: vyhňa, debny s tovarom a vývesný štít.
    PAINTERS['workshop+']!(pc, cx, cy);
    pc.stamp(cx + 8, cy + 1, CRATES, CRATES_PAL);
    pc.fillRect(cx + 11, cy - 10, 1, 5, P.woodDark);
    pc.stamp(cx + 12, cy - 10, ['yyy', 'yoy', 'yyy'], { y: P.wheat, o: P.woodDark });
  },
  'workshop@3': (pc, cx, cy) => {
    // Manufaktúra: veľká tehlová hala s radom okien a dvoma komínmi.
    const hw = 13;
    isoBox(pc, cx, cy, hw, 10, { top: P.brick, left: P.brick, right: P.brickShade });
    hipRoof(pc, cx, cy, hw, 10, 6, P.stoneDark, P.stoneDeep);
    for (const dx of [2, 6, 10]) pc.stamp(...leftWall(cx, cy, hw, dx, 8), WINDOW, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy, hw, 3, 5), DOOR, DETAIL_PAL);
    pc.stamp(...rightWall(cx, cy, hw, 8, 8), WINDOW, DETAIL_PAL);
    chimney(pc, cx + 3, cy - 26, 10);
    chimney(pc, cx + 8, cy - 25, 9);
  },

  'brickworks@2': (pc, cx, cy) => {
    // Kruhová pec: druhý komín a viac tehál.
    chimney(pc, cx - 3, cy - 24, 10, P.brickShade);
    PAINTERS.brickworks!(pc, cx, cy);
    pc.stamp(cx + 8, cy + 2, BRICK_PILE, BRICK_PAL);
  },
  'brickworks@3': (pc, cx, cy) => {
    // Parná tehelňa: dlhá hala a vysoký komín.
    const hw = 13;
    isoBox(pc, cx, cy, hw, 9, { top: P.brick, left: P.brick, right: P.brickShade });
    hipRoof(pc, cx, cy, hw, 9, 5, P.soilDark, P.woodDark);
    for (const dx of [3, 8]) {
      const [fx, fy] = leftWall(cx, cy, hw, dx, 5);
      pc.stamp(fx, fy, ['ooo', 'oGo', 'GGG'], { o: P.stoneDeep, G: P.glow });
    }
    chimney(pc, cx + 6, cy - 34, 22, P.brickShade);
    pc.stamp(cx - 15, cy + 1, BRICK_PILE, BRICK_PAL);
    pc.stamp(cx + 9, cy + 3, BRICK_PILE, BRICK_PAL);
  },

  'fishery@2': (pc, cx, cy) => {
    // Rybársky prístav: druhá loďka a sušiak na ryby.
    PAINTERS.fishery!(pc, cx, cy);
    pc.fillRect(cx - 12, cy - 6, 1, 6, P.woodDark);
    pc.fillRect(cx - 7, cy - 8, 1, 6, P.woodDark);
    pc.fillRect(cx - 12, cy - 7, 6, 1, P.woodDark);
    pc.stamp(cx - 11, cy - 6, ['s.s.s', 's.s.s'], { s: P.stoneLight });
    pc.stamp(cx - 6, cy + 4, ['.WWWW.', 'WwwwwW', '.WWWW.'], { W: P.woodDark, w: P.wood });
  },
  'fishery@3': (pc, cx, cy) => {
    // Rybárska flotila: chladiareň na móle a motorová loď.
    pc.fillDiamond(cx, cy, HW - 2, (x, y) => ((x + y) % 4 === 0 ? P.stoneDark : P.stone));
    isoBox(pc, cx - 3, cy - 2, 7, 8, { top: P.white, left: P.white, right: P.stoneLight });
    hipRoof(pc, cx - 3, cy - 2, 7, 8, 3, P.waterDeep, P.stoneDeep);
    pc.stamp(...rightWall(cx - 3, cy - 2, 7, 2, 6), ['ddd', 'dDd', 'dDd'], {
      d: P.stoneDeep,
      D: P.stoneLight,
    });
    pc.stamp(cx + 2, cy, ['...ww...', '..wWww..', 'RRRRRRRR', '.RRRRRR.'], {
      w: P.white,
      W: P.window,
      R: P.roof,
    });
    pc.fillRect(cx + 5, cy - 6, 1, 4, P.ink);
  },

  'mine@2': (pc, cx, cy) => {
    // Hlbinná baňa: drevená ťažná veža nad šachtou.
    headframe(pc, cx + 4, cy - 24, cy - 6, P.woodDark);
    PAINTERS.mine!(pc, cx, cy);
  },
  'mine@3': (pc, cx, cy) => {
    // Strojová baňa: oceľová veža a strojovňa s komínom.
    headframe(pc, cx + 3, cy - 28, cy - 6, P.stoneDeep, 2);
    PAINTERS.mine!(pc, cx, cy);
    isoBox(pc, cx - 10, cy + 1, 4, 5, { top: P.brick, left: P.brick, right: P.brickShade });
    chimney(pc, cx - 11, cy - 14, 9, P.ink);
  },

  'pasture@2': (pc, cx, cy) => {
    // Ovčia farma: stodola a viac oviec.
    pastureGround(pc, cx, cy);
    isoBox(pc, cx + 2, cy - 5, 6, 6, { top: P.wood, left: P.wood, right: P.woodShade });
    hipRoof(pc, cx + 2, cy - 5, 6, 6, 5, P.roof, P.roofShade);
    for (const [dx, dy] of [
      [-9, -2],
      [-4, 1],
      [2, 3],
      [8, 1],
      [-10, 3],
    ])
      pc.stamp(cx + dx! - 2, cy + dy! - 2, SHEEP, SHEEP_PAL);
    pastureFence(pc, cx, cy);
  },
  'pasture@3': (pc, cx, cy) => {
    // Chovná stanica: moderná budova so silom.
    pastureGround(pc, cx, cy);
    isoBox(pc, cx + 2, cy - 4, 8, 7, { top: P.white, left: P.white, right: P.stoneLight });
    hipRoof(pc, cx + 2, cy - 4, 8, 7, 3, P.waterDeep, P.stoneDeep);
    pc.stamp(...leftWall(cx + 2, cy - 4, 8, 3, 6), ['ww', 'ww'], { w: P.window });
    isoBox(pc, cx - 8, cy - 4, 3, 13, { top: P.stoneLight, left: P.stoneLight, right: P.stone });
    pc.fillDiamond(cx - 8, cy - 18, 3, P.waterDeep);
    for (const [dx, dy] of [
      [-4, 2],
      [3, 4],
      [9, 2],
    ])
      pc.stamp(cx + dx! - 2, cy + dy! - 2, SHEEP, SHEEP_PAL);
    pastureFence(pc, cx, cy);
  },

  'coal_mine@2': (pc, cx, cy) => {
    // Hlboká uhoľná baňa: oceľová veža so svetlom a strojovňa.
    PAINTERS.coal_mine!(pc, cx, cy);
    pc.fillRect(cx + 2, cy - 22, 1, 20, P.stoneDeep);
    pc.fillRect(cx + 8, cy - 22, 1, 20, P.stoneDeep);
    for (let y = cy - 18; y < cy - 3; y += 5) pc.fillRect(cx + 2, y, 7, 1, P.stoneDeep);
    pc.set(cx + 5, cy - 21, P.glow);
    isoBox(pc, cx + 11, cy + 1, 3, 5, { top: P.brick, left: P.brick, right: P.brickShade });
  },
  'coal_mine@3': (pc, cx, cy) => {
    // Automatizovaná baňa: dopravník a rameno nakladača.
    PAINTERS['coal_mine@2']!(pc, cx, cy);
    for (let i = 0; i < 10; i++) {
      pc.set(cx - 14 + i, cy - 6 + Math.floor(i / 2), P.stoneDeep);
      pc.set(cx - 14 + i, cy - 7 + Math.floor(i / 2), i % 2 ? P.ink : P.stone);
    }
    pc.fillRect(cx - 4, cy - 12, 1, 6, P.wheat);
    pc.fillRect(cx - 4, cy - 12, 5, 1, P.wheat);
    pc.stamp(cx, cy - 12, ['kk', 'k.'], { k: P.ink });
  },
};
Object.assign(PAINTERS, LEVEL_PAINTERS);

// --- Parky a dekorácie -----------------------------------------------------------------

const FLOWERS: Painter = (pc, cx, cy) => {
  for (const [dx, dy, c] of [
    [-6, 2, P.roof],
    [-4, 3, P.wheatLight],
    [5, 3, P.purple],
    [7, 1, P.roof],
    [1, 5, P.wheatLight],
  ] as const)
    pc.set(cx + dx, cy + dy, c);
};

const DECORATION_PAINTERS: Record<string, Painter> = {
  park: (pc, cx, cy) => {
    // Trávnik s chodníkom, dva stromy a lavička.
    pc.fillDiamond(cx, cy, HW - 1, (x, y) =>
      pixelNoise(x, y, 23) < 0.12 ? P.grassLight : P.grass,
    );
    pc.fillDiamond(cx, cy, HW - 1, (x, y) =>
      Math.abs(x - cx - (y - cy) * 2) <= 1 ? P.dirt : null,
    );
    FLOWERS(pc, cx, cy);
    pc.stamp(cx - 11, cy - 10, TREE, TREE_PAL);
    pc.stamp(cx + 3, cy - 12, TREE, TREE_PAL);
    pc.stamp(cx + 3, cy + 1, ['wwww', 'd..d'], { w: P.wood, d: P.woodDark });
  },
  fountain: (pc, cx, cy) => {
    // Kamenná fontána s vodou a prúdom.
    pc.fillDiamond(cx, cy, HW - 1, (x, y) => (pixelNoise(x, y, 29) < 0.1 ? P.grassLight : P.grass));
    isoBox(pc, cx, cy, 9, 3, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
    pc.fillDiamond(cx, cy - 3, 7, P.water);
    pc.fillRect(cx - 1, cy - 9, 2, 6, P.stone);
    pc.fillRect(cx - 1, cy - 12, 2, 3, P.waterLight);
    for (const [dx, dy] of [
      [-3, -10],
      [3, -10],
      [-4, -7],
      [4, -7],
    ])
      pc.set(cx + dx!, cy + dy!, P.waterLight);
  },
  plaza: (pc, cx, cy) => {
    // Dláždené námestie so stĺpom.
    pc.fillDiamond(cx, cy, HW - 1, (x, y) => {
      const joint = (x + 2 * y) % 6 === 0 || (x - 2 * y + 600) % 6 === 0;
      return joint ? P.stoneDark : pixelNoise(x, y, 37) < 0.1 ? P.stoneLight : P.stone;
    });
    isoBox(pc, cx, cy, 4, 2, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
    pc.fillRect(cx - 1, cy - 20, 3, 18, P.stoneLight);
    pc.fillRect(cx + 1, cy - 20, 1, 18, P.stone);
    pc.stamp(cx - 2, cy - 24, ['.y.', 'yyy', '.y.'], { y: P.wheat });
    FLOWERS(pc, cx, cy);
  },
  statue: (pc, cx, cy) => {
    // Socha na podstavci v záhone.
    pc.fillDiamond(cx, cy, HW - 1, (x, y) =>
      pixelNoise(x, y, 31) < 0.12 ? P.grassLight : P.grass,
    );
    FLOWERS(pc, cx, cy);
    isoBox(pc, cx, cy, 5, 6, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
    pc.stamp(
      cx - 3,
      cy - 13,
      ['..cc..', '..cc..', 'cCCCCc', '.CCCC.', '.CccC.', '.C..C.', '.C..C.'],
      {
        c: 0x3e8948,
        C: 0x2a6b47,
      },
    );
  },
  botanical_garden: (pc, cx, cy) => {
    // Skleník s kupolou a záhony.
    pc.fillDiamond(cx, cy, HW - 1, (x, y) => ((((x >> 1) + y) & 3) === 0 ? P.soilDark : P.grass));
    FLOWERS(pc, cx, cy);
    isoBox(pc, cx + 1, cy - 1, 9, 7, { top: 0x9fe5f5, left: 0x9fe5f5, right: 0x5bb8d9 });
    pc.fillPolygon(
      [
        [cx - 8, cy - 8],
        [cx - 4, cy - 15],
        [cx + 1, cy - 17],
        [cx + 6, cy - 15],
        [cx + 10, cy - 8],
      ],
      (x) => (x < cx + 1 ? 0xc5f0fa : 0x7fd0e8),
    );
    for (let dx = -6; dx <= 8; dx += 4) pc.fillRect(cx + dx, cy - 14, 1, 12, P.white);
    pc.stamp(cx - 2, cy - 8, ['.g.', 'ggg', '.T.'], { g: P.leaf, T: P.trunk });
  },
};
Object.assign(PAINTERS, DECORATION_PAINTERS);

/** Smery napojenia cesty (bity masky): +x, +y, −x, −y v súradniciach mapy. */
export const ROAD_EAST = 1;
export const ROAD_SOUTH = 2;
export const ROAD_WEST = 4;
export const ROAD_NORTH = 8;
/** Rovný úsek pozdĺž osi x — ikona v doku a náhľad stavby. */
const ROAD_STRAIGHT = ROAD_EAST | ROAD_WEST;

/**
 * Cesta ako pás cez políčko, napojený na susedné cesty (`mask`); okolo pásu zostane terén.
 * Súradnice (u, v) sú v jednotkách políčka od stredu, pás má šírku `width`.
 */
function paintRoad(
  pc: PixelCanvas,
  cx: number,
  cy: number,
  mask: number,
  width: number,
  fill: (x: number, y: number) => Rgb,
  edge: Rgb,
): void {
  const half = width / 2;
  // Mimo políčka pás pokračuje len v napojených smeroch — na styku so susedom tak nevznikne okraj.
  const inside = (x: number, y: number) => {
    const sx = (x + 0.5 - cx) / HW;
    const sy = (y + 0.5 - cy) / HH;
    const u = (sx + sy) / 2;
    const v = (sy - sx) / 2;
    const alongU =
      Math.abs(v) <= half &&
      (Math.abs(u) <= half || (u > 0 && mask & ROAD_EAST) || (u < 0 && mask & ROAD_WEST));
    const alongV =
      Math.abs(u) <= half &&
      (Math.abs(v) <= half || (v > 0 && mask & ROAD_SOUTH) || (v < 0 && mask & ROAD_NORTH));
    return Boolean(alongU || alongV);
  };
  pc.fillDiamond(cx, cy, HW, (x, y) => {
    if (!inside(x, y)) return null;
    const border = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    return border ? edge : fill(x, y);
  });
}

const dirtFill = (x: number, y: number): Rgb => {
  const n = pixelNoise(x, y, 41);
  return n < 0.12 ? P.dirtDark : n > 0.9 ? P.dirtLight : P.dirt;
};

const paveFill = (x: number, y: number): Rgb => {
  const joint = (x + 2 * y) % 6 === 0 || (x - 2 * y + 600) % 8 === 0;
  if (joint) return P.roadDark;
  return pixelNoise(x, y, 31) < 0.08 ? P.roadLight : P.road;
};

function roadPainter(mask: number, paved: boolean): Painter {
  return (pc, cx, cy) =>
    paved
      ? paintRoad(pc, cx, cy, mask, 0.62, paveFill, P.stoneDeep)
      : paintRoad(pc, cx, cy, mask, 0.5, dirtFill, P.dirtEdge);
}

const FLAT: Record<string, Painter> = {
  // Hlinený chodník (pred Kamenárstvom) a dláždená cesta (po ňom).
  road: roadPainter(ROAD_STRAIGHT, false),
  'road+': roadPainter(ROAD_STRAIGHT, true),
};

/** Kľúč sprite-u cesty podľa napojenia na susedov, napr. `road+#5`. */
export function roadSpriteKey(baseKey: string, mask: number): string {
  return `${baseKey}#${mask}`;
}

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
  const [base, maskText] = key.split('#');
  const flat = maskText !== undefined ? roadPainter(Number(maskText), base === 'road+') : FLAT[key];
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

export type IconKind = ResourceId | 'money';

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
  cloth: {
    rows: [
      '........',
      '.ppppp..',
      'pPPPPPp.',
      'pPwPwPpp',
      'pPPPPPpP',
      'pPwPwPpP',
      '.pppppPp',
      '......pp',
    ],
    pal: { p: P.purpleShade, P: P.purple, w: P.plaster },
  },
  coal: {
    rows: [
      '........',
      '...oo...',
      '..oKko..',
      '.oKKKKo.',
      'oKkKKKKo',
      'oKKKKkKo',
      '.oooooo.',
      '........',
    ],
    pal: { o: P.ink, K: 0x262b44, k: P.stoneDark },
  },
  electricity: {
    rows: [
      '....yy..',
      '...yy...',
      '..yy....',
      '.yyyyy..',
      '...yy...',
      '..yy....',
      '.yy.....',
      '.y......',
    ],
    pal: { y: P.glow },
  },
  electronics: {
    rows: [
      '.g.g.g..',
      'GGGGGGG.',
      'GkkkkkG.',
      'GkyykkGg',
      'GkkkkkG.',
      'GGGGGGGg',
      '.g.g.g..',
      '........',
    ],
    pal: { G: 0x265c42, g: P.stoneLight, k: 0x193c3e, y: P.glow },
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

// --- Efekty: svetlá, komíny, chodci ----------------------------------------------------

const LIGHT_SOURCES: ReadonlySet<Rgb> = new Set([P.window, P.glow]);
const WARM_LIGHT = 0xffd36b;

/**
 * Mapa svetiel budovy: pixely okien (tmavé sklo a žiarivé body) ako teplé svetlo, zvyšok
 * priehľadný. V noci sa kreslí nad budovou s aditívnym miešaním.
 */
export function drawLights(key: string): PixelSprite {
  const { canvas, anchorX, anchorY } = drawBuilding(key);
  const lights = new PixelCanvas(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const color = canvas.get(x, y);
      if (color !== null && LIGHT_SOURCES.has(color)) lights.set(x, y, WARM_LIGHT);
    }
  }
  return { canvas: lights, anchorX, anchorY };
}

/** Či má mapa svetiel aspoň jeden pixel. */
export function hasLights(sprite: PixelSprite): boolean {
  for (let i = 3; i < sprite.canvas.data.length; i += 4)
    if (sprite.canvas.data[i]! > 0) return true;
  return false;
}

/** Ústia komínov (pixely voči stredu políčka) — odtiaľ stúpa dym, keď budova pracuje. */
export const CHIMNEYS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  house: [[5, -22]],
  'house@2': [[-4, -26]],
  'house@7': [
    [-5, -33],
    [6, -32],
  ],
  workshop: [[6, -20]],
  'workshop+': [[6, -20]],
  'workshop@2': [[6, -20]],
  'workshop@3': [
    [4, -27],
    [9, -26],
  ],
  brickworks: [[6, -23]],
  'brickworks@2': [
    [6, -23],
    [-2, -25],
  ],
  'brickworks@3': [[7, -35]],
  'lumberjack@3': [[7, -28]],
  'quarry@3': [[10, -16]],
  'mine@3': [[-10, -15]],
  smelter: [[-2, -31]],
  steelworks: [
    [-6, -35],
    [0, -35],
    [6, -35],
  ],
  textile_factory: [[10, -35]],
  power_plant: [
    [-5, -37],
    [5, -37],
  ],
  nuclear_plant: [[-5, -24]],
};

const PEOPLE_COLORS: readonly Rgb[] = [P.roof, P.waterDeep, P.grass, P.wheat, P.purple, P.white];

/** Chodec 4 × 7 px (hlava, telo, nohy) s tmavým obrysom pre čitateľnosť. */
export function drawWalker(variant: number): PixelCanvas {
  const pc = new PixelCanvas(5, 8);
  pc.stamp(1, 0, ['.hh.', '.hh.', 'cccc', 'cccc', '.cc.', '.ll.', '.l.l'], {
    h: P.soilLight,
    c: PEOPLE_COLORS[variant % PEOPLE_COLORS.length]!,
    l: P.ink,
  });
  pc.outline(P.ink);
  return pc;
}

/** Auto 8 × 5 px (moderné éry). */
export function drawCar(variant: number): PixelCanvas {
  const pc = new PixelCanvas(10, 7);
  pc.stamp(1, 1, ['..www...', '.cccccc.', 'cccccccc', 'cccccccc', '.o....o.'], {
    w: P.waterLight,
    c: PEOPLE_COLORS[variant % PEOPLE_COLORS.length]!,
    o: P.ink,
  });
  pc.outline(P.ink);
  return pc;
}

/** Obláčik dymu alebo prachu. */
export function drawPuff(color: Rgb): PixelCanvas {
  const pc = new PixelCanvas(5, 5);
  pc.stamp(0, 0, ['.ccc.', 'ccccc', 'ccLcc', 'ccccc', '.ccc.'], { c: color, L: P.white });
  return pc;
}

export const SMOKE_COLOR = 0xe4e9f0;
export const DUST_COLOR = P.soilLight;
export const WATER_KEY_COUNT = 4;
