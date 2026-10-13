import { gameData } from '@/data';
import { createNewGame } from '@/engine';
import { GameController } from './GameController';

function seedFromUrl(): number | null {
  const value = new URLSearchParams(window.location.search).get('seed');
  const seed = value === null ? NaN : Number(value);
  return Number.isInteger(seed) ? seed : null;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

function createInitialState() {
  const state = createNewGame(gameData, {
    seed: seedFromUrl() ?? randomSeed(),
    gameId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  // `?paused` spustí hru v pauze (používajú E2E testy).
  if (new URLSearchParams(window.location.search).has('paused')) state.simulation.speed = 0;
  return state;
}

/** Aktuálna hra. Ukladanie a načítanie pribudne v etape 6. */
export const controller = new GameController(gameData, createInitialState());
