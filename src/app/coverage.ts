import { gameData } from '@/data';
import { effectiveDefinition, footprint, isPolluted, serviceCoverageGrid } from '@/engine';
import type { CoverageOverlay } from '@/renderer/GameRenderer';
import type { ServiceType } from '@/types';
import type { MapLayer } from '@/stores/uiStore';
import { controller } from './game';
import { t } from './i18n';

export const LAYER_COLORS: Record<MapLayer, number> = {
  water: 0x0099db,
  education: 0xfeae34,
  culture: 0xb55088,
  health: 0x2ce8f5,
  leisure: 0x63c74d,
  pollution: 0x8f563b,
};

export const MAP_LAYERS: readonly MapLayer[] = [
  'water',
  'education',
  'culture',
  'health',
  'leisure',
  'pollution',
];

export const layerName = (layer: MapLayer) =>
  layer === 'pollution' ? t('layers.pollution') : t(`service.${layer}`);

export const cssColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Vrstva, ktorá sa má zobraziť: pri stavbe služby jej typ, pri stavbe priemyslu znečistenie. */
export function effectiveLayer(
  buildModeId: string | null,
  mapLayer: MapLayer | null,
): MapLayer | null {
  const definition = buildModeId ? gameData.buildingsById.get(buildModeId) : undefined;
  if (definition?.service) return definition.service.type;
  if (definition?.pollution) return 'pollution';
  return mapLayer;
}

export interface CoverageSummary extends CoverageOverlay {
  /** Podiel kapacity bývania v dosahu (0–1). */
  share: number;
}

/** Vrstva na mape: políčka (v dosahu / znečistené) a domy bez služby / v znečistení. */
export function coverageOverlay(layer: MapLayer): CoverageSummary {
  return layer === 'pollution' ? pollutionOverlay() : serviceOverlay(layer);
}

function pollutionOverlay(): CoverageSummary {
  const state = controller.state;
  const grid = controller.pollution;
  const threshold = gameData.balance.pollution.threshold;
  const covered = new Uint8Array(grid.length);
  for (let i = 0; i < grid.length; i++) if (grid[i]! >= threshold) covered[i] = 1;
  const missing: number[] = [];
  const missingBuildings = new Set<string>();
  let total = 0;
  let clean = 0;
  for (const building of state.city.buildings) {
    const base = gameData.buildingsById.get(building.definitionId);
    if (!base) continue;
    const capacity = effectiveDefinition(base, building.level).housingCapacity;
    if (capacity <= 0) continue;
    total += capacity;
    if (isPolluted(state, gameData, building, grid)) missingBuildings.add(building.id);
    else clean += capacity;
  }
  return {
    covered,
    missing,
    missingBuildings,
    color: LAYER_COLORS.pollution,
    share: total > 0 ? clean / total : 1,
  };
}

function serviceOverlay(type: ServiceType): CoverageSummary {
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
