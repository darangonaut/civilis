/** Most medzi rozhraním (minimapa, tlačidlá zoomu) a rendererom, ktorý sa načítava asynchrónne. */
export interface CameraTarget {
  centerOnWorld(wx: number, wy: number): void;
  zoomStep(direction: 1 | -1): void;
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
