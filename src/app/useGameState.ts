import { bumpGameRevision, useGameStore } from '@/stores/gameStore';
import type { GameState } from '@/types';
import { controller } from './game';

controller.subscribe(bumpGameRevision);

/** Číta herný stav a prekreslí komponent pri každej zmene stavu. */
export function useGameState<T>(selector: (state: Readonly<GameState>) => T): T {
  useGameStore((s) => s.revision);
  return selector(controller.state);
}
