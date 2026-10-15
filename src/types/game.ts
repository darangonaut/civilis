import type { BuildingInstance } from './buildings';
import type { ResourceId } from './resources';
import type { EventsState } from './events';
import type { Resources } from './resources';
import type { MilestoneState, ResearchState } from './research';
import type { Position, World } from './world';

export interface HappinessFactors {
  food: number;
  housing: number;
  water: number;
  education: number;
  /** Podiel bývania v dosahu parkov a dekorácií (bonus navyše, schéma v6). */
  leisure: number;
  /** Zásobenie domov tovarom 0–100 (schéma v8). */
  goods: number;
  /** Podiel bývania mimo znečistenia 0–100 (schéma v8). */
  environment: number;
}

export interface PopulationState {
  total: number;
  housingCapacity: number;
  availableWorkers: number;
  employedWorkers: number;
  happiness: number;
  /** Zložky spokojnosti z posledného dňa (0–100). Rozšírenie oproti špecifikácii. */
  happinessFactors: HappinessFactors;
  /** Rozpracovaný prírastok (0–1) — zlomky obyvateľov z plynulého rastu (schéma v2). */
  growthProgress: number;
}

export interface EconomyState {
  resources: Resources;
  money: number;

  storageCapacity: number;

  dailyIncome: number;
  dailyExpenses: number;

  dailyProduction: Partial<Resources>;
  dailyConsumption: Partial<Resources>;
}

export interface CityState {
  name: string;
  population: PopulationState;
  economy: EconomyState;
  buildings: BuildingInstance[];
}

export const SIMULATION_SPEEDS = [0, 1, 2, 4] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

/** Jediný autoritatívny stav hry. */
export interface GameState {
  schemaVersion: number;
  gameId: string;
  createdAt: string;
  lastSavedAt: string;

  simulation: {
    day: number;
    speed: SimulationSpeed;
    seed: number;
  };

  world: World;
  city: CityState;
  research: ResearchState;
  milestones: MilestoneState;
  /** Obchod: automatický predaj prebytkov a súčet zarobených peňazí (schéma v6). */
  trade: TradeState;
  /** Úspechy a deň dohrania (schéma v6). */
  achievements: AchievementState;
  /** Náhodné udalosti (schéma v7). */
  events: EventsState;
}

export interface TradeState {
  autoSell: ResourceId[];
  /** Peniaze zarobené predajom za celú hru. */
  earned: number;
}

export interface AchievementState {
  completedIds: string[];
  /** Deň splnenia posledného míľnika (null = ešte nedohrané). */
  finishedDay: number | null;
}

export interface SaveSlot {
  id: string;
  name: string;
  savedAt: string;
  gameState: GameState;
}

export type GameCommand =
  | {
      type: 'PLACE_BUILDING';
      buildingId: string;
      position: Position;
      /** Rozšírenie: postaviť rovno na vyššej úrovni (predvolene 1). */
      level?: number;
    }
  | { type: 'DEMOLISH_BUILDING'; instanceId: string }
  | { type: 'SET_BUILDING_PRIORITY'; instanceId: string; priority: number }
  /** Rozšírenie oproti špecifikácii: pozastavenie / spustenie budovy (pole `enabled`). */
  | { type: 'SET_BUILDING_ENABLED'; instanceId: string; enabled: boolean }
  /** Rozšírenie oproti špecifikácii: poradie výskumu. */
  | { type: 'SET_RESEARCH_QUEUE'; technologyIds: string[] }
  /** Rozšírenie oproti špecifikácii: vylepšenie budovy na ďalšiu úroveň. */
  | { type: 'UPGRADE_BUILDING'; instanceId: string }
  | { type: 'START_RESEARCH'; technologyId: string }
  /** Rozšírenie: obchod — kladné množstvo = nákup, záporné = predaj. */
  | { type: 'TRADE'; resource: ResourceId; amount: number }
  /** Rozšírenie: automatický predaj prebytkov suroviny. */
  | { type: 'SET_AUTO_SELL'; resource: ResourceId; enabled: boolean }
  /** Rozšírenie: rozhodnutie o čakajúcej udalosti. */
  | { type: 'RESOLVE_EVENT'; choiceId: string }
  /** Rozšírenie: zapnutie / vypnutie náhodných udalostí. */
  | { type: 'SET_EVENTS_ENABLED'; enabled: boolean }
  /** Rozšírenie oproti špecifikácii: aj rýchlosť je súčasť herného stavu. */
  | { type: 'SET_SPEED'; speed: SimulationSpeed };

export type CommandResult = { success: true } | { success: false; reason: string };

export interface GameEngine {
  getState(): Readonly<GameState>;
  execute(command: GameCommand): CommandResult;
  tick(): void;
  serialize(): GameState;
  load(state: GameState): void;
}
