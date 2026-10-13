import {
  RESOURCE_IDS,
  type BuildingDefinition,
  type BuildingLevelDefinition,
  type Resources,
} from '@/types';

const cache = new WeakMap<BuildingDefinition, BuildingDefinition[]>();

function scale(resources: Partial<Resources>, factor: number): Partial<Resources> {
  const result: Partial<Resources> = {};
  for (const id of RESOURCE_IDS)
    if (resources[id] !== undefined) result[id] = resources[id]! * factor;
  return result;
}

/**
 * Parametre budovy na danej úrovni: základná definícia + zmeny všetkých úrovní až po `level`.
 * Výsledok sa cachuje, takže sa dá volať v každom ticku.
 */
export function effectiveDefinition(
  definition: BuildingDefinition,
  level: number,
): BuildingDefinition {
  if (level <= 1 || !definition.levels?.length) return definition;
  let byLevel = cache.get(definition);
  if (!byLevel) {
    byLevel = [definition];
    let current = definition;
    let multiplier = 1;
    for (const next of definition.levels) {
      multiplier = next.productionMultiplier ?? multiplier;
      current = {
        ...current,
        name: next.name,
        housingCapacity: next.housingCapacity ?? current.housingCapacity,
        storageCapacity: next.storageCapacity ?? current.storageCapacity,
        workersRequired: next.workersRequired ?? current.workersRequired,
        maintenanceCost: next.maintenanceCost ?? current.maintenanceCost,
        outputs: scale(definition.outputs, multiplier),
        inputs: scale(definition.inputs, multiplier),
        moneyOutput: definition.moneyOutput * multiplier,
      };
      byLevel.push(current);
    }
    cache.set(definition, byLevel);
  }
  return byLevel[Math.min(level, byLevel.length) - 1]!;
}

export function maxLevel(definition: BuildingDefinition): number {
  return 1 + (definition.levels?.length ?? 0);
}

/** Definícia nasledujúcej úrovne alebo undefined, ak je budova na maxime. */
export function nextLevel(
  definition: BuildingDefinition,
  level: number,
): BuildingLevelDefinition | undefined {
  return definition.levels?.[level - 1];
}

/** Zobrazovaný názov budovy na danej úrovni. */
export function levelName(definition: BuildingDefinition, level: number): string {
  return effectiveDefinition(definition, level).name;
}
