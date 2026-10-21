import { tileToWorld } from '@/renderer/iso';
/** Most medzi rozhraním (minimapa, tlačidlá zoomu) a rendererom, ktorý sa načítava asynchrónne. */
export interface CameraTarget {
  centerOnWorld(wx: number, wy: number): void;
  zoomStep(direction: 1 | -1): void;
  /** Dotyková stavba: postaviť / zrušiť označené políčka. */
  confirmBuild(): void;
  clearPendingBuild(): void;
}

let target: CameraTarget | null = null;

export function registerCameraTarget(next: CameraTarget | null): void {
  target = next;
}

export function centerCamera(wx: number, wy: number): void {
  target?.centerOnWorld(wx, wy);
}

export function zoomCamera(direction: 1 | -1): void {
  target?.zoomStep(direction);
}

export function confirmPendingBuild(): void {
  target?.confirmBuild();
}

export function clearPendingBuild(): void {
  target?.clearPendingBuild();
}

/** Presunie kameru na stred budovy (pôdorys `size` × `size` od `position`). */
export function centerOnTile(position: { x: number; y: number }, size = 1): void {
  const offset = (size - 1) / 2;
  const world = tileToWorld(position.x + offset, position.y + offset);
  centerCamera(world.x, world.y);
}
