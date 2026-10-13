import { describe, expect, it } from 'vitest';
import { nightFactor, nightTint } from '@/renderer/dayNight';
import { drawBuilding, drawLights, hasLights, CHIMNEYS } from '@/renderer/pixel/sprites';

describe('deň a noc', () => {
  it('cez deň je svetlo, v noci tma, prechody sú plynulé', () => {
    expect(nightFactor(0.2)).toBe(0);
    expect(nightFactor(0.75)).toBe(1);
    expect(nightFactor(0.6)).toBeGreaterThan(0);
    expect(nightFactor(0.6)).toBeLessThan(1);
    expect(nightFactor(1.2)).toBe(nightFactor(0.2));
    expect(nightTint(0)).toBe(0xffffff);
    expect(nightTint(1)).toBe(0x5a64a8);
  });

  it('domy majú svetlá v oknách a komíny sú na pixeloch budovy', () => {
    expect(hasLights(drawLights('house'))).toBe(true);
    expect(hasLights(drawLights('road'))).toBe(false);
    for (const [key, chimneys] of Object.entries(CHIMNEYS)) {
      const sprite = drawBuilding(key);
      for (const [dx, dy] of chimneys) {
        // Tesne pod ústím komína musí byť nakreslený pixel (komín), nad ním voľno.
        const x = sprite.anchorX + dx;
        const y = sprite.anchorY + dy;
        expect(sprite.canvas.isFilled(x, y + 2), `${key} [${dx},${dy}]`).toBe(true);
      }
    }
  });
});

describe('svetlá neblikajú tam, kde nemajú', () => {
  it('pole s obilím nemá svetlá (farba okien sa líši od klasov)', () => {
    expect(hasLights(drawLights('farm'))).toBe(false);
    expect(hasLights(drawLights('pasture'))).toBe(false);
  });
});
