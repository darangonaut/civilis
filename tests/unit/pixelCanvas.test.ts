import { describe, expect, it } from 'vitest';
import { PixelCanvas } from '@/renderer/pixel/PixelCanvas';

describe('pixelový rasterizér', () => {
  it('izometrické políčka 32 × 16 sa skladajú bez medzier a prekryvov', () => {
    // Mriežka 4 × 4 políčok nakreslená do jedného plátna; každý pixel smie patriť najviac
    // jednému políčku a vnútro oblasti musí byť pokryté úplne.
    const canvas = new PixelCanvas(200, 120);
    const owner = new Int32Array(200 * 120).fill(-1);
    let overlaps = 0;
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const cx = 100 + (tx - ty) * 16;
        const cy = 20 + (tx + ty) * 8;
        canvas.fillDiamond(cx, cy, 16, (x, y) => {
          const i = y * 200 + x;
          if (owner[i] !== -1) overlaps++;
          owner[i] = ty * 4 + tx;
          return 0xffffff;
        });
      }
    }
    expect(overlaps).toBe(0);
    // Stred medzi štyrmi políčkami (spoločný vrchol) musí byť pokrytý.
    const cx = 100 + (1 - 1) * 16;
    const cy = 20 + (1 + 1) * 8;
    for (let dy = -6; dy <= 6; dy++)
      for (let dx = -6; dx <= 6; dx++) expect(canvas.isFilled(cx + dx, cy + dy)).toBe(true);
  });

  it('políčko 32 × 16 má 256 pixelov a hrany so sklonom 2:1', () => {
    const canvas = new PixelCanvas(32, 16);
    canvas.fillDiamond(16, 8, 16, 0x00ff00);
    let filled = 0;
    const widths: number[] = [];
    for (let y = 0; y < 16; y++) {
      let row = 0;
      for (let x = 0; x < 32; x++) if (canvas.isFilled(x, y)) row++;
      widths.push(row);
      filled += row;
    }
    expect(filled).toBe(256);
    expect(widths).toEqual([2, 6, 10, 14, 18, 22, 26, 30, 30, 26, 22, 18, 14, 10, 6, 2]);
  });

  it('stamp a obrys', () => {
    const canvas = new PixelCanvas(5, 5);
    canvas.stamp(1, 1, ['ab', '.a'], { a: 0xff0000, b: 0x0000ff });
    expect(canvas.get(1, 1)).toBe(0xff0000);
    expect(canvas.get(2, 1)).toBe(0x0000ff);
    expect(canvas.get(1, 2)).toBeNull();
    canvas.outline(0x111111);
    expect(canvas.get(0, 1)).toBe(0x111111);
    expect(canvas.get(1, 2)).toBe(0x111111);
    expect(canvas.get(4, 4)).toBeNull();
  });
});

describe('sprity budov', () => {
  it('každá budova z dát má vlastný sprite (nie náhradný fialový kváder)', async () => {
    const { drawBuilding, buildingSpriteKey, TECH_LOOKS } =
      await import('@/renderer/pixel/sprites');
    const { testData } = await import('../helpers/gameData');
    const isFallback = (key: string) => {
      const { canvas } = drawBuilding(key);
      for (let i = 0; i < canvas.data.length; i += 4) {
        if (canvas.data[i] === 0xff && canvas.data[i + 1] === 0 && canvas.data[i + 2] === 0xff)
          return true;
      }
      return false;
    };
    const keys = new Set<string>();
    for (const b of testData.buildings) {
      for (let level = 1; level <= 1 + (b.levels?.length ?? 0); level++) {
        keys.add(buildingSpriteKey(b.id, level, []));
        keys.add(buildingSpriteKey(b.id, level, Object.values(TECH_LOOKS)));
        // Na Marse má každá budova marťanský vzhľad (vlastný alebo pod kyslíkovou kupolou).
        const mars = buildingSpriteKey(b.id, level, [], 'mars');
        expect(mars, b.id).toMatch(/^mars[:~]/);
        keys.add(mars);
      }
    }
    for (const key of keys) expect(isFallback(key), key).toBe(false);
    // Každá úroveň domu má vlastný vzhľad (nie návrat k základnému domu).
    const house = testData.buildingsById.get('house')!;
    for (let level = 2; level <= 1 + house.levels!.length; level++) {
      expect(buildingSpriteKey('house', level, []), `úroveň ${level}`).toBe(`house@${level}`);
    }
    expect(keys.has('road+')).toBe(true);
  });
});
