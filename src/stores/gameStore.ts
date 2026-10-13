import { create } from 'zustand';

/**
 * Engine mení stav na mieste, preto store nesie iba číslo revízie, ktoré sa zvýši
 * pri každej zmene stavu. Samotný stav číta `useGameState` z Game Controllera.
 */
export const useGameStore = create<{ revision: number }>()(() => ({ revision: 0 }));

export function bumpGameRevision(): void {
  useGameStore.setState((s) => ({ revision: s.revision + 1 }));
}
