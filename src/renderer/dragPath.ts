import type { Position, Tile } from '@/types';

/** Najviac toľko políčok naraz (ochrana pred omylom cez celú mapu). */
export const MAX_DRAG_TILES = 256;

export type DragShape = 'line' | 'area';

/** Cesty sa kreslia ako čiara, ostatné budovy vypĺňajú obdĺžnik. */
export function dragShapeFor(buildingId: string): DragShape {
  return buildingId === 'road' ? 'line' : 'area';
}

/**
 * Políčka medzi začiatkom a koncom ťahania.
 * `line`: lomená čiara — najprv po osi x, potom po osi y (ako v SimCity).
 * `area`: všetky políčka obdĺžnika, po riadkoch od začiatku.
 */
export function dragPositions(shape: DragShape, start: Position, end: Position): Position[] {
  const positions: Position[] = [];
  const stepX = Math.sign(end.x - start.x) || 1;
  const stepY = Math.sign(end.y - start.y) || 1;
  if (shape === 'line') {
    for (let x = start.x; x !== end.x + stepX; x += stepX) positions.push({ x, y: start.y });
    for (let y = start.y + stepY; y !== end.y + stepY && start.y !== end.y; y += stepY)
      positions.push({ x: end.x, y });
  } else {
    for (let y = start.y; y !== end.y + stepY; y += stepY) {
      for (let x = start.x; x !== end.x + stepX; x += stepX) positions.push({ x, y });
    }
  }
  return positions.slice(0, MAX_DRAG_TILES);
}

/** Budovy (ID inštancií) na políčkach obdĺžnika — po riadkoch od začiatku, každá raz. */
export function buildingsInArea(
  world: { width: number; tiles: readonly Pick<Tile, 'buildingId'>[] },
  start: Position,
  end: Position,
): string[] {
  const ids = new Set<string>();
  for (const { x, y } of dragPositions('area', start, end)) {
    const id = world.tiles[y * world.width + x]?.buildingId;
    if (id) ids.add(id);
  }
  return [...ids];
}
