import type { CommandResult, GameCommand, GameEngine, GameState } from '@/types';
import { refreshDerivedState } from '../economy/analysis';
import { simulateDay } from '../economy/simulateDay';
import { executeCommand } from './commands';
import type { GameData } from './definitions';
import type { GameEvent } from './events';

/** GameEngine zo špecifikácie rozšírený o udalosti z posledných krokov. */
export interface CivilisEngine extends GameEngine {
  /** Vráti a vyprázdni udalosti nazbierané od posledného volania. */
  takeEvents(): GameEvent[];
}

class SimulationEngine implements CivilisEngine {
  private state: GameState;
  private events: GameEvent[] = [];

  constructor(
    private readonly data: GameData,
    initialState: GameState,
  ) {
    this.state = structuredClone(initialState);
    refreshDerivedState(this.state, this.data);
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  execute(command: GameCommand): CommandResult {
    return executeCommand(this.state, this.data, command);
  }

  /** Jeden herný deň (simulačný krok). */
  tick(): void {
    this.events.push(...simulateDay(this.state, this.data));
  }

  takeEvents(): GameEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  serialize(): GameState {
    return structuredClone(this.state);
  }

  load(state: GameState): void {
    this.state = structuredClone(state);
    this.events = [];
    // Odvodené hodnoty sa po načítaní vždy prepočítajú zo stavu.
    refreshDerivedState(this.state, this.data);
  }
}

export function createGameEngine(data: GameData, initialState: GameState): CivilisEngine {
  return new SimulationEngine(data, initialState);
}
