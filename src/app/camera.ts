/** Most medzi rozhraním (minimapa) a rendererom, ktorý sa načítava asynchrónne. */
let centerFn: ((wx: number, wy: number) => void) | null = null;

export function registerCameraTarget(fn: ((wx: number, wy: number) => void) | null): void {
  centerFn = fn;
}

export function centerCamera(wx: number, wy: number): void {
  centerFn?.(wx, wy);
}
