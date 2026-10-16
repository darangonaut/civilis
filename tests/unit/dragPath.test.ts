import { describe, expect, it } from 'vitest';
import { buildingsInArea, dragPositions, dragShapeFor, MAX_DRAG_TILES } from '@/renderer/dragPath';

describe('ťahanie pri stavbe', () => {
  it('cesta je lomená čiara: najprv x, potom y', () => {
    expect(dragPositions('line', { x: 2, y: 2 }, { x: 4, y: 4 })).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 3 },
      { x: 4, y: 4 },
    ]);
  });

  it('čiara funguje aj opačným smerom a pre jedno políčko', () => {
    expect(dragPositions('line', { x: 3, y: 5 }, { x: 1, y: 5 })).toEqual([
      { x: 3, y: 5 },
      { x: 2, y: 5 },
      { x: 1, y: 5 },
    ]);
    expect(dragPositions('line', { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([{ x: 1, y: 1 }]);
    expect(dragPositions('line', { x: 1, y: 3 }, { x: 1, y: 1 })).toEqual([
      { x: 1, y: 3 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
    ]);
  });

  it('ostatné budovy vyplnia obdĺžnik', () => {
    const area = dragPositions('area', { x: 5, y: 5 }, { x: 4, y: 7 });
    expect(area).toHaveLength(6);
    expect(area[0]).toEqual({ x: 5, y: 5 });
    expect(new Set(area.map((p) => `${p.x},${p.y}`)).size).toBe(6);
  });

  it('počet políčok je obmedzený', () => {
    expect(dragPositions('area', { x: 0, y: 0 }, { x: 63, y: 63 })).toHaveLength(MAX_DRAG_TILES);
    expect(dragShapeFor('road')).toBe('line');
    expect(dragShapeFor('farm')).toBe('area');
  });

  it('búranie: budovy v obdĺžniku, každá raz a v poradí po riadkoch', () => {
    // Mapa 4 × 3: div 2 × 2 „b1“ na (1, 0), „b2“ na (0, 2), „b3“ na (3, 2) mimo výberu.
    const tiles: { buildingId?: string }[] = Array.from({ length: 12 }, () => ({}));
    for (const i of [1, 2, 5, 6]) tiles[i]!.buildingId = 'b1';
    tiles[8]!.buildingId = 'b2';
    tiles[11]!.buildingId = 'b3';
    const world = { width: 4, tiles };
    expect(buildingsInArea(world, { x: 2, y: 2 }, { x: 0, y: 1 })).toEqual(['b2', 'b1']);
    expect(buildingsInArea(world, { x: 3, y: 0 }, { x: 3, y: 0 })).toEqual([]);
  });
});
