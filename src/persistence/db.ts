import Dexie, { type EntityTable } from 'dexie';
import type { SaveSlot } from '@/types';

export const MANUAL_SLOT_IDS = ['slot-1', 'slot-2', 'slot-3'] as const;
export const AUTOSAVE_SLOT_ID = 'autosave';
export type SlotId = (typeof MANUAL_SLOT_IDS)[number] | typeof AUTOSAVE_SLOT_ID;

/** Záznam v databáze; `gameState` je surový, kým neprejde migráciou a validáciou. */
export interface StoredSlot extends Omit<SaveSlot, 'gameState'> {
  gameState: unknown;
  /** Súhrn pre zoznam pozícií bez načítania celého stavu. */
  summary: { day: number; population: number; cityName: string };
}

export class CivilisDatabase extends Dexie {
  saves!: EntityTable<StoredSlot, 'id'>;

  constructor(name = 'civilis') {
    super(name);
    this.version(1).stores({ saves: 'id, savedAt' });
  }
}
