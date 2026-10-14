import { gameData } from '@/data';
import type { BuildingProblem } from '@/engine';
import { controller } from './game';
import { problemLabel } from './i18n';

/** Poradie skupín v prehľade — najvážnejšie problémy hore. */
const SEVERITY: BuildingProblem['code'][] = [
  'no_road',
  'no_workers',
  'no_funds',
  'missing_input',
  'no_tools',
  'understaffed',
  'storage_full',
  'poor_terrain',
];

export interface ProblemGroup {
  key: string;
  code: BuildingProblem['code'];
  label: string;
  buildingIds: string[];
}

/** Budovy s problémom zoskupené podľa príčiny (pozastavené budovy sa nepočítajú). */
export function problemGroups(): ProblemGroup[] {
  const groups = new Map<string, ProblemGroup>();
  for (const building of controller.state.city.buildings) {
    const problems = controller.analysis.statuses.get(building.id)?.problems ?? [];
    for (const problem of problems) {
      if (problem.code === 'disabled') continue;
      const key = 'resource' in problem ? `${problem.code}:${problem.resource}` : problem.code;
      let group = groups.get(key);
      if (!group) {
        group = { key, code: problem.code, label: problemLabel(problem), buildingIds: [] };
        groups.set(key, group);
      }
      group.buildingIds.push(building.id);
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      SEVERITY.indexOf(a.code) - SEVERITY.indexOf(b.code) ||
      b.buildingIds.length - a.buildingIds.length,
  );
}

/** Počet budov s aspoň jedným vážnym problémom (bez plného skladu a horšej pôdy). */
export function problemBuildingCount(): number {
  let count = 0;
  for (const building of controller.state.city.buildings) {
    const problems = controller.analysis.statuses.get(building.id)?.problems ?? [];
    if (problems.some((p) => !['disabled', 'storage_full', 'poor_terrain'].includes(p.code)))
      count++;
  }
  return count;
}

export const buildingSize = (definitionId: string) =>
  gameData.buildingsById.get(definitionId)?.size.width ?? 1;
