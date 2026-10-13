import type { GameState } from './game';
import type { Resources } from './resources';
import type { Position } from './world';

/** Rozhranie pre E2E testy. Aktivuje sa len s parametrom `?e2e` v URL. */
export interface CivilisTestHook {
  getState(): Readonly<GameState>;
  canPlace(buildingId: string, position: Position): boolean;
  tileToClient(position: Position): { x: number; y: number };
  /** Počty vizuálnych efektov (chodci, častice, svetlá, tma 0–1). */
  effectsStats(): { walkers: number; particles: number; lights: number; night: number };
  /** Odsimuluje zadaný počet dní naraz. */
  advanceDays(days: number): void;
  /** Pridá technológie a suroviny (príprava scenára v teste). */
  grantForTest(grant: { technologies?: string[]; resources?: Partial<Resources> }): void;
}

declare global {
  interface Window {
    __civilis?: CivilisTestHook;
  }
}
