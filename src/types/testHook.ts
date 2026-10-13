import type { GameState } from './game';
import type { Position } from './world';

/** Rozhranie pre E2E testy. Aktivuje sa len s parametrom `?e2e` v URL. */
export interface CivilisTestHook {
  getState(): Readonly<GameState>;
  canPlace(buildingId: string, position: Position): boolean;
  tileToClient(position: Position): { x: number; y: number };
  /** Odsimuluje zadaný počet dní naraz. */
  advanceDays(days: number): void;
}

declare global {
  interface Window {
    __civilis?: CivilisTestHook;
  }
}
