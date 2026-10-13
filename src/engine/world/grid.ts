import type { BuildingDefinition, Position, Tile, World } from '@/types';

export function tileIndex(world: Pick<World, 'width'>, x: number, y: number): number {
  return y * world.width + x;
}

export function isInBounds(world: Pick<World, 'width' | 'height'>, x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < world.width &&
    y < world.height
  );
}

export function getTile(world: World, x: number, y: number): Tile | undefined {
  return isInBounds(world, x, y) ? world.tiles[tileIndex(world, x, y)] : undefined;
}

/** Políčka, ktoré budova zaberá. `position` je ľavý horný roh (najmenšie x a y). */
export function footprint(
  definition: Pick<BuildingDefinition, 'size'>,
  position: Position,
): Position[] {
  const positions: Position[] = [];
  for (let dy = 0; dy < definition.size.height; dy++) {
    for (let dx = 0; dx < definition.size.width; dx++) {
      positions.push({ x: position.x + dx, y: position.y + dy });
    }
  }
  return positions;
}

/** Ortogonálni susedia (4-okolie) v rámci mapy. */
export function neighbors4(world: Pick<World, 'width' | 'height'>, position: Position): Position[] {
  const { x, y } = position;
  return [
    { x, y: y - 1 },
    { x: x + 1, y },
    { x, y: y + 1 },
    { x: x - 1, y },
  ].filter((p) => isInBounds(world, p.x, p.y));
}
