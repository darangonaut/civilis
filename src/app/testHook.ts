import type { GameRenderer } from '@/renderer/GameRenderer';
import type { CivilisTestHook } from '@/types/testHook';
import { gameData } from '@/data';
import { DEFAULT_BUILDING_PRIORITY, footprint, tileIndex } from '@/engine';
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
    grantForTest: ({
      technologies = [],
      resources = {},
      milestones = [],
      pendingEvent,
      finished,
      buildings = [],
    }) => {
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
      if (pendingEvent) state.events.pending = pendingEvent;
      if (finished) {
        state.milestones.completedIds = gameData.milestones.map((m) => m.id);
        state.achievements.finishedDay = state.simulation.day;
      }
      buildings.forEach(({ definitionId, position }, i) => {
        const id = `test${state.city.buildings.length + i + 1}`;
        state.city.buildings.push({
          id,
          definitionId,
          position,
          enabled: true,
          priority: DEFAULT_BUILDING_PRIORITY,
          level: 1,
        });
        for (const p of footprint(gameData.buildingsById.get(definitionId)!, position)) {
          state.world.tiles[tileIndex(state.world, p.x, p.y)]!.buildingId = id;
        }
      });
      controller.load(state);
    },
  };
  window.__civilis = hook;
  return () => {
    delete window.__civilis;
  };
}
