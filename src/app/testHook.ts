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
    grantForTest: ({ technologies = [], resources = {}, milestones = [] }) => {
      const state = controller.serialize();
      state.research.completedTechnologyIds.push(
        ...technologies.filter((id) => !state.research.completedTechnologyIds.includes(id)),
      );
      for (const [id, amount] of Object.entries(resources)) {
        state.city.economy.resources[id as keyof typeof resources] += amount;
      }
      state.milestones.completedIds.push(
        ...milestones.filter((id) => !state.milestones.completedIds.includes(id)),
      );
      controller.load(state);
    },
  };
  window.__civilis = hook;
  return () => {
    delete window.__civilis;
  };
}
