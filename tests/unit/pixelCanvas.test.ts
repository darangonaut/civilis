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
