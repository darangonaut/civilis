import type { BuildingInstance } from './buildings';
import type { Resources } from './resources';
import type { MilestoneState, ResearchState } from './research';
import type { Position, World } from './world';

export interface HappinessFactors {
  food: number;
  housing: number;
  water: number;
  education: number;
}

export interface PopulationState {
  total: number;
  housingCapacity: number;
  availableWorkers: number;
  employedWorkers: number;
  happiness: number;
  /** Zložky spokojnosti z posledného dňa (0–100). Rozšírenie oproti špecifikácii. */
  happinessFactors: HappinessFactors;
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
}

export interface SaveSlot {
  id: string;
  name: string;
  savedAt: string;
  gameState: GameState;
}

export type GameCommand =
  | { type: 'PLACE_BUILDING'; buildingId: string; position: Position }
  | { type: 'DEMOLISH_BUILDING'; instanceId: string }
  | { type: 'SET_BUILDING_PRIORITY'; instanceId: string; priority: number }
  | { type: 'START_RESEARCH'; technologyId: string }
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
