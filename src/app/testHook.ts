import type { GameRenderer } from '@/renderer/GameRenderer';
import type { CivilisTestHook } from '@/types/testHook';
import { controller } from './game';

export function installTestHook(renderer: GameRenderer): () => void {
  if (!new URLSearchParams(window.location.search).has('e2e')) return () => {};
  const hook: CivilisTestHook = {
    getState: () => controller.state,
    canPlace: (buildingId, position) => controller.canPlace(buildingId, position).success,
    tileToClient: (position) => renderer.tileToClient(position),
    effectsStats: () => renderer.effectsStats(),
    advanceDays: (days) => {
      for (let i = 0; i < days; i++) controller.tick();
    },
  };
  window.__civilis = hook;
  return () => {
    delete window.__civilis;
  };
}
