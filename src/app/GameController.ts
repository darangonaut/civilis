import {
  analyzeCity,
  createGameEngine,
  currentEraIndex,
  houseOccupancy,
  serviceCoverageGrid,
  upgradableBuildings,
  validatePlacement,
  type CityAnalysis,
  type CivilisEngine,
  type GameData,
  type GameEvent,
  pollutionGrid,
} from '@/engine';
import type { CommandResult, GameCommand, GameState, Position, SimulationSpeed } from '@/types';
import type { CityActivity } from '@/renderer/effects';
import { SERVICE_TYPES, type ServiceType } from '@/types';
import { GameLoop } from './gameLoop';

/** Od modernej éry jazdia po cestách aj autá. */
const MODERN_ERA_INDEX = 5;

type Listener = () => void;
type EventListener = (events: GameEvent[]) => void;
type DayListener = (day: number) => void;

/**
 * Jediný vstupný bod UI a renderera do enginu. Posiela príkazy, riadi hernú slučku
 * a po každej zmene stavu upozorní odberateľov.
 */
export class GameController {
  private readonly engine: CivilisEngine;
  private readonly listeners = new Set<Listener>();
  private readonly eventListeners = new Set<EventListener>();
  private readonly dayListeners = new Set<DayListener>();
  private readonly loop: GameLoop;
  private cachedAnalysis: CityAnalysis | null = null;
  private cachedUpgradable: Set<string> | null = null;
  private cachedActivity: CityActivity | null = null;
  private cachedGrids: Record<ServiceType, Uint8Array> | null = null;
  private cachedPollution: Float32Array | null = null;
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

  /** Znečistenie políčok (pre vrstvu a inšpektor), cachované na revíziu. */
  get pollution(): Float32Array {
    this.cachedPollution ??= pollutionGrid(this.engine.getState(), this.data, this.analysis);
    return this.cachedPollution;
  }

  /** Budovy, ktoré sa dajú práve vylepšiť. */
  get upgradable(): Set<string> {
    this.cachedUpgradable ??= upgradableBuildings(this.engine.getState(), this.data, this.analysis);
    return this.cachedUpgradable;
  }

  /** Čo sa v meste deje (pre vizuálne efekty): obsadenosť domov, pracujúce budovy, cesty. */
  get activity(): CityActivity {
    if (!this.cachedActivity) {
      const state = this.engine.getState();
      const analysis = this.analysis;
      const working = new Set<string>();
      for (const status of analysis.statuses.values()) {
        if (status.connected && status.efficiency > 0) working.add(status.instanceId);
      }
      this.cachedActivity = {
        occupancy: houseOccupancy(state, this.data, analysis),
        working,
        roadTiles: analysis.roadNetwork,
        cars: currentEraIndex(state, this.data) >= MODERN_ERA_INDEX,
      };
    }
    return this.cachedActivity;
  }

  execute(command: GameCommand): CommandResult {
    const result = this.engine.execute(command);
    if (result.success) this.notify();
    return result;
  }

  /** Overenie stavby (aj rovno na vyššej úrovni) — mriežky služieb sa cachujú na revíziu. */
  canPlace(buildingId: string, position: Position, level = 1): CommandResult {
    if (level > 1) {
      this.cachedGrids ??= Object.fromEntries(
        SERVICE_TYPES.map((type) => [
          type,
          serviceCoverageGrid(this.engine.getState(), this.data, this.analysis, type),
        ]),
      ) as Record<ServiceType, Uint8Array>;
    }
    return validatePlacement(
      this.engine.getState(),
      this.data,
      buildingId,
      position,
      level,
      this.cachedGrids ?? undefined,
    );
  }

  setSpeed(speed: SimulationSpeed): void {
    if (speed !== 0) this.resumeSpeed = speed;
    this.execute({ type: 'SET_SPEED', speed });
  }

  togglePause(): void {
    this.setSpeed(this.state.simulation.speed === 0 ? this.resumeSpeed : 0);
  }

  /** Nahradí aktuálnu hru iným stavom (načítanie, import, nová hra). */
  load(state: GameState): void {
    this.engine.load(state);
    this.resumeSpeed = state.simulation.speed === 0 ? this.resumeSpeed : state.simulation.speed;
    this.notify();
  }

  /** Kópia stavu na uloženie. */
  serialize(): GameState {
    return this.engine.serialize();
  }

  tick(): void {
    this.engine.tick();
    this.notify();
    const events = this.engine.takeEvents();
    if (events.length > 0) this.eventListeners.forEach((listener) => listener(events));
    const day = this.state.simulation.day;
    this.dayListeners.forEach((listener) => listener(day));
  }

  /** Odber konca každého herného dňa (napr. automatické ukladanie). */
  onDayAdvanced(listener: DayListener): () => void {
    this.dayListeners.add(listener);
    return () => this.dayListeners.delete(listener);
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
    this.cachedUpgradable = null;
    this.cachedActivity = null;
    this.cachedGrids = null;
    this.cachedPollution = null;
    this.listeners.forEach((listener) => listener());
  }
}
