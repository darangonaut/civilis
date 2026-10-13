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

/** Suroviny, ktoré vráti zbúranie: `share` zo stavby a všetkých vylepšení (zaokrúhlené nadol). */
export function demolishRefund(
  definition: BuildingDefinition,
  level: number,
  share: number,
): Partial<Resources> {
  const invested: Partial<Resources> = { ...definition.constructionCost };
  for (const next of (definition.levels ?? []).slice(0, Math.max(0, level - 1))) {
    for (const id of RESOURCE_IDS) {
      if (next.upgradeCost[id]) invested[id] = (invested[id] ?? 0) + next.upgradeCost[id]!;
    }
  }
  const refund: Partial<Resources> = {};
  for (const id of RESOURCE_IDS) {
    const amount = Math.floor((invested[id] ?? 0) * share);
    if (amount > 0) refund[id] = amount;
  }
  return refund;
}

/** Cena postavenia budovy rovno na danej úrovni: stavba + všetky vylepšenia po ňu. */
export function buildCostAtLevel(
  definition: BuildingDefinition,
  level: number,
): Partial<Resources> {
  const total: Partial<Resources> = { ...definition.constructionCost };
  for (const next of (definition.levels ?? []).slice(0, Math.max(0, level - 1))) {
    for (const id of RESOURCE_IDS) {
      if (next.upgradeCost[id]) total[id] = (total[id] ?? 0) + next.upgradeCost[id]!;
    }
  }
  return total;
}

/** Technológie potrebné na úroveň (vrátane nižších úrovní). */
export function technologiesForLevel(definition: BuildingDefinition, level: number): string[] {
  const ids = definition.requiredTechnologyId ? [definition.requiredTechnologyId] : [];
  for (const next of (definition.levels ?? []).slice(0, Math.max(0, level - 1))) {
    if (next.requiredTechnologyId) ids.push(next.requiredTechnologyId);
  }
  return ids;
}
