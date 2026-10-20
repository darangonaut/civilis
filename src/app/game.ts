import { gameData } from '@/data';
import { createNewGame } from '@/engine';
import { AUTOSAVE_SLOT_ID } from '@/persistence/db';
import { SaveService } from '@/persistence/saveService';
import { takeUnloadSnapshot } from '@/persistence/unloadSnapshot';
import type { DifficultyId, GameState } from '@/types';
import { GameController } from './GameController';
import { createGameId } from './ids';

const params = new URLSearchParams(window.location.search);

function seedFromUrl(): number | null {
  const value = params.get('seed');
  const seed = value === null ? NaN : Number(value);
  return Number.isInteger(seed) ? seed : null;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

export function createFreshGame(
  seed: number = randomSeed(),
  difficulty: DifficultyId = 'normal',
): GameState {
  return createNewGame(gameData, {
    seed,
    difficulty,
    gameId: createGameId(),
    now: new Date().toISOString(),
  });
}

function applyUrlOverrides(state: GameState): GameState {
  // `?paused` spustí hru v pauze (používajú E2E testy).
  if (params.has('paused')) state.simulation.speed = 0;
  return state;
}

/** Aktuálna hra. Pri štarte ju `initializeGame` nahradí automatickým uložením, ak existuje. */
export const controller = new GameController(
  gameData,
  applyUrlOverrides(createFreshGame(seedFromUrl() ?? undefined)),
);

export const saveService = new SaveService(gameData);

export type InitResult = 'new' | 'restored' | 'restore_failed';

/**
 * Obnoví rozohranú hru z automatického uloženia, aby sa pri obnovení stránky nič nestratilo.
 * Parameter `?seed=N` alebo `?new` vždy založí novú hru.
 */
export async function initializeGame(): Promise<InitResult> {
  if (seedFromUrl() !== null || params.has('new')) return 'new';
  try {
    const snapshot = takeUnloadSnapshot();
    if (snapshot !== null) {
      const state = saveService.importJson(snapshot);
      await saveService.save(AUTOSAVE_SLOT_ID, state, new Date().toISOString());
      controller.load(applyUrlOverrides(state));
      return 'restored';
    }
    const saved = await saveService.load(AUTOSAVE_SLOT_ID);
    if (!saved) return 'new';
    controller.load(applyUrlOverrides(saved));
    return 'restored';
  } catch (error) {
    console.error('Automatické uloženie sa nepodarilo načítať', error);
    return 'restore_failed';
  }
}
