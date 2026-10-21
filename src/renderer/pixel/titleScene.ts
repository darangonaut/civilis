import type { Language } from '@/stores/languageStore';
import { PixelCanvas, pixelNoise, type Rgb } from './PixelCanvas';
import { drawBuilding, drawTerrain, P, PX_TILE_H, PX_TILE_W } from './sprites';

/** Úvodná scéna: cesta civilizácie od chatrče po raketu pod svitajúcou oblohou. */
export const TITLE_WIDTH = 320;
export const TITLE_HEIGHT = 180;
const HORIZON = 112;

const SKY: readonly [number, Rgb][] = [
  [0, 0x181425],
  [30, 0x262b44],
  [55, 0x3a2a5a],
  [78, 0x68386c],
  [94, 0xb55088],
  [104, 0xe4826a],
  [HORIZON, 0xfeae34],
];

function skyColor(y: number, x: number): Rgb {
  for (let i = SKY.length - 1; i >= 0; i--) {
    const [from, color] = SKY[i]!;
    if (y >= from) {
      // Pásy oblohy sa prelínajú ditheringom na hranici.
      const next = SKY[i + 1];
      if (next && next[0] - y <= 2 && ((x + y) & 1) === 0) return next[1];
      return color;
    }
  }
  return SKY[0]![1];
}

function disc(pc: PixelCanvas, cx: number, cy: number, r: number, light: Rgb, dark: Rgb): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      pc.set(cx + x, cy + y, x + y > r / 3 ? dark : light);
    }
  }
}

export function drawTitleScene(): PixelCanvas {
  const pc = new PixelCanvas(TITLE_WIDTH, TITLE_HEIGHT);
  for (let y = 0; y < HORIZON + 8; y++)
    for (let x = 0; x < TITLE_WIDTH; x++) pc.set(x, y, skyColor(y, x));
  // Hviezdy hore na oblohe.
  for (let y = 0; y < 70; y++)
    for (let x = 0; x < TITLE_WIDTH; x++)
      if (pixelNoise(x, y, 4242) < 0.006 * (1 - y / 70)) pc.set(x, y, P.white);
  // Planéty ságy: Mars a Proxima b.
  disc(pc, 262, 26, 8, 0xe08a55, 0xa64a2c);
  pc.set(259, 23, 0xffd0a0);
  disc(pc, 292, 50, 5, 0xb58ad6, 0x6b4a9e);
  // Krajina: rad políčok trávy s lesom po okrajoch a vodou vpravo.
  const terrainAt = (col: number): Parameters<typeof drawTerrain>[0] =>
    col < 2 ? 'forest' : col > 8 ? 'water' : 'grass';
  const rows = Math.ceil((TITLE_HEIGHT - HORIZON + 8) / (PX_TILE_H / 2)) + 1;
  for (let row = 0; row < rows; row++) {
    for (let col = -1; col < 22; col++) {
      const tile = drawTerrain(terrainAt(col + (row % 2)), (col + row) & 3).canvas;
      const x = col * PX_TILE_W + (row % 2 ? PX_TILE_W / 2 : 0) - 16;
      const y = HORIZON - 6 + row * (PX_TILE_H / 2) - (tile.height - PX_TILE_H - 2);
      pc.blit(tile, x, y);
    }
  }
  // Budovy z jednotlivých ér zľava doprava.
  const buildings: [string, number][] = [
    ['house', 52],
    ['farm', 76],
    ['temple', 102],
    ['castle', 136],
    ['steelworks', 172],
    ['house@8', 198],
    ['house@10', 222],
    ['space_port', 250],
  ];
  for (const [key, x] of buildings) {
    const { canvas, anchorX, anchorY } = drawBuilding(key);
    pc.blit(canvas, x - anchorX, HORIZON + 22 - anchorY);
  }
  return pc;
}

/** Pixelové písmo 5 × 7 pre logo. */
const GLYPHS: Record<string, string[]> = {
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
};

/** Logo CIVILIS: zlaté písmená s obrysom a tieňom (každý bod písma = 2 × 2 pixely). */
export function drawLogo(text = 'CIVILIS'): PixelCanvas {
  const scale = 2;
  const gap = 1;
  const width =
    [...text].reduce((w, ch) => w + (GLYPHS[ch]![0]!.length + gap) * scale, 0) - gap * scale;
  const pc = new PixelCanvas(width + 6, 7 * scale + 7);
  const letters = new PixelCanvas(width, 7 * scale);
  let cursor = 0;
  for (const ch of text) {
    const glyph = GLYPHS[ch]!;
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) {
        if (row[gx] !== '#') continue;
        const color = gy < 2 ? P.wheatLight : gy < 5 ? P.wheat : 0xe07a2a;
        letters.fillRect(cursor + gx * scale, gy * scale, scale, scale, color);
      }
    });
    cursor += (glyph[0]!.length + gap) * scale;
  }
  // Tieň, potom písmená s obrysom.
  const shadow = new PixelCanvas(width, 7 * scale);
  for (let y = 0; y < letters.height; y++)
    for (let x = 0; x < letters.width; x++)
      if (letters.isFilled(x, y)) shadow.set(x, y, P.roofDark);
  pc.blit(shadow, 3, 4);
  pc.blit(letters, 2, 2);
  pc.outline(P.ink);
  return pc;
}

/** Pixelové vlajky jazykov (16 × 11). */
export function drawFlag(language: Language): PixelCanvas {
  const pc = new PixelCanvas(16, 11);
  const white = P.white;
  const red = 0xd52b1e;
  const blue = 0x0b4ea2;
  if (language === 'sk') {
    pc.fillRect(0, 0, 16, 4, white);
    pc.fillRect(0, 4, 16, 3, blue);
    pc.fillRect(0, 7, 16, 4, red);
    // Štít s dvojkrížom na trojvrší.
    pc.stamp(3, 2, ['wwwww', 'wrWrw', 'wWWWw', 'wrWrw', 'wbbbw', '.wbw.', '..w..'], {
      w: white,
      r: red,
      W: white,
      b: blue,
    });
  } else if (language === 'cs') {
    pc.fillRect(0, 0, 16, 5, white);
    pc.fillRect(0, 5, 16, 6, red);
    for (let y = 0; y < 11; y++) {
      const reach = Math.round(8 * (1 - Math.abs(y - 5) / 5.5));
      pc.fillRect(0, y, reach, 1, blue);
    }
  } else {
    pc.fillRect(0, 0, 16, 11, 0x012169);
    for (let i = 0; i < 16; i++) {
      const y = Math.round((i * 10) / 15);
      pc.set(i, y, white);
      pc.set(i, 10 - y, white);
    }
    pc.fillRect(0, 4, 16, 3, white);
    pc.fillRect(6, 0, 4, 11, white);
    pc.fillRect(0, 5, 16, 1, 0xc8102e);
    pc.fillRect(7, 0, 2, 11, 0xc8102e);
  }
  pc.outline(P.ink);
  return pc;
}
