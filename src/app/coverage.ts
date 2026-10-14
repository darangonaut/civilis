import { gameData } from '@/data';
import { effectiveDefinition, footprint, serviceCoverageGrid } from '@/engine';
import type { CoverageOverlay } from '@/renderer/GameRenderer';
import type { ServiceType } from '@/types';
import { controller } from './game';

export const LAYER_COLORS: Record<ServiceType, number> = {
  water: 0x0099db,
  education: 0xfeae34,
  culture: 0xb55088,
  health: 0x2ce8f5,
  leisure: 0x63c74d,
};

export const cssColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Vrstva, ktorá sa má zobraziť: pri stavbe služby jej typ, inak zvolená vrstva. */
export function effectiveLayer(buildModeId: string | null, mapLayer: ServiceType | null) {
  const service = buildModeId ? gameData.buildingsById.get(buildModeId)?.service : undefined;
  return service?.type ?? mapLayer;
}

export interface CoverageSummary extends CoverageOverlay {
  /** Podiel kapacity bývania v dosahu (0–1). */
  share: number;
}

/** Pokrytie službou: políčka v dosahu a domy (políčka) bez služby. */
export function coverageOverlay(type: ServiceType): CoverageSummary {
  const state = controller.state;
  const analysis = controller.analysis;
  const covered = serviceCoverageGrid(state, gameData, analysis, type);
  const missing: number[] = [];
  const missingBuildings = new Set<string>();
  let total = 0;
  let inRange = 0;
  for (const building of state.city.buildings) {
    const base = gameData.buildingsById.get(building.definitionId);
    if (!base) continue;
    const capacity = effectiveDefinition(base, building.level).housingCapacity;
    if (capacity <= 0) continue;
    const tiles = footprint(base, building.position).map((p) => p.y * state.world.width + p.x);
    total += capacity;
    if (tiles.some((i) => covered[i])) inRange += capacity;
    else {
      missing.push(...tiles);
      missingBuildings.add(building.id);
    }
  }
  return {
    covered,
    missing,
    missingBuildings,
    color: LAYER_COLORS[type],
    share: total > 0 ? inRange / total : 0,
  };
}
