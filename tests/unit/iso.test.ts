import { describe, expect, it } from 'vitest';
import { TILE_HEIGHT, TILE_WIDTH, tileToWorld, worldToTile } from '@/renderer/iso';

describe('izometrická projekcia', () => {
  it('stred políčka sa prevedie späť na to isté políčko', () => {
    for (let y = 0; y < 64; y += 7) {
      for (let x = 0; x < 64; x += 5) {
        const world = tileToWorld(x, y);
        expect(worldToTile(world.x, world.y)).toEqual({ x, y });
      }
    }
  });

  it('body vnútri kosoštvorca patria políčku, body za hranou susedovi', () => {
    const center = tileToWorld(10, 10);
    const inside = [
      [TILE_WIDTH / 2 - 2, 0],
      [-(TILE_WIDTH / 2 - 2), 0],
      [0, TILE_HEIGHT / 2 - 1],
      [0, -(TILE_HEIGHT / 2 - 1)],
    ];
    for (const [dx, dy] of inside) {
      expect(worldToTile(center.x + dx!, center.y + dy!)).toEqual({ x: 10, y: 10 });
    }
    // Pravý dolný sused v smere +x.
    expect(worldToTile(center.x + TILE_WIDTH / 4 + 2, center.y + TILE_HEIGHT / 4 + 2)).toEqual({
      x: 11,
      y: 10,
    });
  });
});
