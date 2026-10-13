import type { CommandResult, GameCommand, GameEngine, GameState } from '@/types';
import { refreshDerivedState } from '../economy/analysis';
import { simulateDay } from '../economy/simulateDay';
import { executeCommand } from './commands';
import type { GameData } from './definitions';

class SimulationEngine implements GameEngine {
  private state: GameState;

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
    simulateDay(this.state, this.data);
  }

  serialize(): GameState {
    return structuredClone(this.state);
  }

  load(state: GameState): void {
    this.state = structuredClone(state);
    // Odvodené hodnoty sa po načítaní vždy prepočítajú zo stavu.
    refreshDerivedState(this.state, this.data);
  }
}

export function createGameEngine(data: GameData, initialState: GameState): GameEngine {
  return new SimulationEngine(data, initialState);
}
