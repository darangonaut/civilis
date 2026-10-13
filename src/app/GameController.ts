import {
  analyzeCity,
  createGameEngine,
  validatePlacement,
  type CityAnalysis,
  type CivilisEngine,
  type GameData,
  type GameEvent,
} from '@/engine';
import type { CommandResult, GameCommand, GameState, Position, SimulationSpeed } from '@/types';
import { GameLoop } from './gameLoop';

type Listener = () => void;
type EventListener = (events: GameEvent[]) => void;

/**
 * Jediný vstupný bod UI a renderera do enginu. Posiela príkazy, riadi hernú slučku
 * a po každej zmene stavu upozorní odberateľov.
 */
export class GameController {
  private readonly engine: CivilisEngine;
  private readonly listeners = new Set<Listener>();
  private readonly eventListeners = new Set<EventListener>();
  private readonly loop: GameLoop;
  private cachedAnalysis: CityAnalysis | null = null;
  /** Rýchlosť, na ktorú sa vráti medzerník po pauze. */
  private resumeSpeed: Exclude<SimulationSpeed, 0> = 1;

  constructor(
    private readonly data: GameData,
    initialState: GameState,
  ) {
    this.engine = createGameEngine(data, initialState);
    this.loop = new GameLoop(
      () => this.engine.getState().simulation.speed,
      () => this.tick(),
    );
  }

  get state(): Readonly<GameState> {
    return this.engine.getState();
  }

  /** Stav budov (pripojenie, pracovníci, problémy) pre aktuálny stav hry. */
  get analysis(): CityAnalysis {
    this.cachedAnalysis ??= analyzeCity(this.engine.getState(), this.data);
    return this.cachedAnalysis;
  }

  execute(command: GameCommand): CommandResult {
    const result = this.engine.execute(command);
    if (result.success) this.notify();
    return result;
  }

  canPlace(buildingId: string, position: Position): CommandResult {
    return validatePlacement(this.engine.getState(), this.data, buildingId, position);
  }

  setSpeed(speed: SimulationSpeed): void {
    if (speed !== 0) this.resumeSpeed = speed;
    this.execute({ type: 'SET_SPEED', speed });
  }

  togglePause(): void {
    this.setSpeed(this.state.simulation.speed === 0 ? this.resumeSpeed : 0);
  }

  tick(): void {
    this.engine.tick();
    this.notify();
    const events = this.engine.takeEvents();
    if (events.length > 0) this.eventListeners.forEach((listener) => listener(events));
  }

  /** Odber udalostí zo simulácie (dokončený výskum, míľnik, hlad…). */
  onEvents(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  startLoop(): void {
    this.loop.start();
  }

  stopLoop(): void {
    this.loop.stop();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.cachedAnalysis = null;
    this.listeners.forEach((listener) => listener());
  }
}
