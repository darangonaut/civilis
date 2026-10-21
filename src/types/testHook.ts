import type { GameState } from './game';
import type { Resources } from './resources';
import type { PendingEvent } from './events';
import type { Position } from './world';

/** Rozhranie pre E2E testy. Aktivuje sa len s parametrom `?e2e` v URL. */
export interface CivilisTestHook {
  getState(): Readonly<GameState>;
  canPlace(buildingId: string, position: Position): boolean;
  tileToClient(position: Position): { x: number; y: number };
  /** Počty vizuálnych efektov (chodci, častice, svetlá, tma 0–1). */
  effectsStats(): {
    walkers: number;
    particles: number;
    lights: number;
    night: number;
    boats: number;
    grazers: number;
    constructions: number;
  };
  /** Spustí ohňostroj (ako pri novej ére). */
  celebrate(): void;
  /** Odsimuluje zadaný počet dní naraz. */
  advanceDays(days: number): void;
  /** Pridá technológie a suroviny (príprava scenára v teste). */
  grantForTest(grant: {
    technologies?: string[];
    resources?: Partial<Resources>;
    milestones?: string[];
    /** Udalosť čakajúca na rozhodnutie (test karty udalosti). */
    pendingEvent?: PendingEvent;
    /** Splní všetky míľniky a označí hru za dohranú (test kolonizácie). */
    finished?: boolean;
    /** Prepíše časť stavu kolónie (napr. kroniku ságy). */
    colony?: Partial<GameState['colony']>;
    /** Vloží hotové budovy (bez ceny a technológií). */
    buildings?: { definitionId: string; position: Position }[];
  }): void;
}

declare global {
  interface Window {
    __civilis?: CivilisTestHook;
  }
}
