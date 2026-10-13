import type { GameData } from '@/engine/core/definitions';
import type { GameState } from '@/types';
import { AUTOSAVE_SLOT_ID, CivilisDatabase, type SlotId, type StoredSlot } from './db';
import { gameStateSchema } from './gameStateSchema';
import { SaveError, migrateGameState } from './migrations';

export interface SlotInfo {
  id: SlotId;
  name: string;
  savedAt: string;
  day: number;
  population: number;
}

/** Formát exportovaného súboru. */
interface ExportFile {
  format: 'civilis-save';
  exportedAt: string;
  gameState: GameState;
}

/** Overí, že stav odkazuje iba na budovy a technológie z aktuálnych herných dát. */
export function checkReferences(state: GameState, data: GameData): GameState {
  for (const building of state.city.buildings) {
    if (!data.buildingsById.has(building.definitionId)) {
      throw new SaveError('invalid_state', `neznáma budova ${building.definitionId}`);
    }
    const tile = state.world.tiles[building.position.y * state.world.width + building.position.x];
    if (tile?.buildingId !== building.id) {
      throw new SaveError('invalid_state', `políčko budovy ${building.id} nesedí`);
    }
  }
  const techIds = [
    ...state.research.completedTechnologyIds,
    state.research.activeTechnologyId ?? [],
  ].flat();
  for (const id of techIds) {
    if (!data.technologiesById.has(id))
      throw new SaveError('invalid_state', `neznáma technológia ${id}`);
  }
  return state;
}

export class SaveService {
  constructor(
    private readonly data: GameData,
    private readonly db: CivilisDatabase = new CivilisDatabase(),
  ) {}

  /**
   * Uloží stav do pozície. Stav sa pred zápisom zvaliduje a zapíše jednou transakciou
   * (IndexedDB je atomická) — neúspešný zápis nepoškodí predchádzajúce uloženie.
   */
  async save(slotId: SlotId, state: GameState, now: string, name?: string): Promise<SlotInfo> {
    const gameState: GameState = { ...structuredClone(state), lastSavedAt: now };
    const validation = gameStateSchema.safeParse(gameState);
    if (!validation.success)
      throw new SaveError('invalid_state', validation.error.issues[0]?.message);

    const record: StoredSlot = {
      id: slotId,
      name: name ?? (slotId === AUTOSAVE_SLOT_ID ? 'Automatické uloženie' : gameState.city.name),
      savedAt: now,
      gameState,
      summary: {
        day: gameState.simulation.day,
        population: gameState.city.population.total,
        cityName: gameState.city.name,
      },
    };
    await this.db.transaction('rw', this.db.saves, () => this.db.saves.put(record));
    return toInfo(record);
  }

  /** Načíta, zmigruje a zvaliduje stav. Vráti null, ak je pozícia prázdna. */
  async load(slotId: SlotId): Promise<GameState | null> {
    const record = await this.db.saves.get(slotId);
    return record ? checkReferences(migrateGameState(record.gameState), this.data) : null;
  }

  async list(): Promise<SlotInfo[]> {
    const records = await this.db.saves.toArray();
    return records.map(toInfo);
  }

  async remove(slotId: SlotId): Promise<void> {
    await this.db.saves.delete(slotId);
  }

  /** JSON reťazec na export. */
  exportJson(state: GameState, now: string): string {
    const file: ExportFile = { format: 'civilis-save', exportedAt: now, gameState: state };
    return JSON.stringify(file);
  }

  /** Načíta exportovaný JSON (alebo holý GameState) a vráti zmigrovaný stav. */
  importJson(text: string): GameState {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SaveError('invalid_format', 'neplatný JSON');
    }
    const payload =
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { format?: unknown }).format === 'civilis-save'
        ? (parsed as { gameState: unknown }).gameState
        : parsed;
    return checkReferences(migrateGameState(payload), this.data);
  }
}

function toInfo(record: StoredSlot): SlotInfo {
  return {
    id: record.id as SlotId,
    name: record.name,
    savedAt: record.savedAt,
    day: record.summary.day,
    population: record.summary.population,
  };
}
