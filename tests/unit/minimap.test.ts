import { describe, expect, it } from 'vitest';
import { createNewGame } from '@/engine/core/newGame';
import { tileToWorld } from '@/renderer/iso';
import { minimapLayout, minimapToWorld, viewToMinimap } from '@/renderer/minimap';
import { testData } from '../helpers/gameData';

describe('minimapa', () => {
  const state = createNewGame(testData, { seed: 7, gameId: 'm', now: 'x' });
  const layout = minimapLayout(state, 272);

  it('celá mapa sa zmestí do šírky', () => {
    expect(layout.width).toBeLessThanOrEqual(273);
    expect(layout.height).toBeCloseTo(layout.width / 2, 0);
  });

  it('klik na minimapu a výhľad kamery sú navzájom inverzné', () => {
    const center = tileToWorld(40, 20);
    const rect = viewToMinimap(
      { minX: center.x - 10, maxX: center.x + 10, minY: center.y - 10, maxY: center.y + 10 },
      state,
      layout,
    );
    const back = minimapToWorld(rect.x + rect.w / 2, rect.y + rect.h / 2, state, layout);
    expect(back.x).toBeCloseTo(center.x, 5);
    expect(back.y).toBeCloseTo(center.y, 5);
  });
});
