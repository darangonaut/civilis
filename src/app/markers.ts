import type { BuildingProblem, BuildingStatus } from '@/engine';
import type { MarkerKind } from '@/renderer/pixel/sprites';
import { controller } from './game';
import type { TranslationKey } from './i18n';

/** Poradie dôležitosti problémov — značka ukazuje ten najvážnejší. */
const PROBLEM_MARKERS: [BuildingProblem['code'], MarkerKind][] = [
  ['no_road', 'road'],
  ['no_workers', 'workers'],
  ['no_funds', 'money'],
  ['missing_input', 'goods'],
  ['no_tools', 'goods'],
  ['understaffed', 'understaffed'],
  ['storage_full', 'storage'],
];

export function markerFor(
  status: BuildingStatus | undefined,
  upgradable: boolean,
): MarkerKind | null {
  for (const [code, kind] of PROBLEM_MARKERS) {
    if (status?.problems.some((p) => p.code === code)) return kind;
  }
  return upgradable ? 'upgrade' : null;
}

/** Značky pre všetky budovy v aktuálnom stave. */
export function currentMarkers(): Map<string, MarkerKind> {
  const markers = new Map<string, MarkerKind>();
  const upgradable = controller.upgradable;
  for (const building of controller.state.city.buildings) {
    const kind = markerFor(
      controller.analysis.statuses.get(building.id),
      upgradable.has(building.id),
    );
    if (kind) markers.set(building.id, kind);
  }
  return markers;
}

/** Legenda značiek (Nastavenia). */
export const MARKER_LEGEND: [MarkerKind, TranslationKey][] = [
  ['road', 'marker.road'],
  ['workers', 'marker.workers'],
  ['understaffed', 'marker.understaffed'],
  ['goods', 'marker.goods'],
  ['money', 'marker.money'],
  ['storage', 'marker.storage'],
  ['upgrade', 'marker.upgrade'],
];
