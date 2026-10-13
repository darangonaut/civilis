import { z } from 'zod';
import {
  BUILDING_CATEGORIES,
  RESOURCE_IDS,
  SERVICE_TYPES,
  TECHNOLOGY_EFFECT_TYPES,
  TERRAIN_TYPES,
  type BuildingDefinition,
  type MilestoneCondition,
  type MilestoneDefinition,
  type Resources,
  type TechnologyDefinition,
  type TerrainType,
} from '@/types';

const id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'ID musí byť snake_case');
const nonNegative = z.number().finite().nonnegative();
const positiveInt = z.number().int().positive();
const resourceId = z.enum(RESOURCE_IDS);

const resourcesSchema = z.strictObject({
  food: nonNegative,
  wood: nonNegative,
  stone: nonNegative,
  tools: nonNegative,
  knowledge: nonNegative,
}) satisfies z.ZodType<Resources>;

const partialResourcesSchema = resourcesSchema.partial();

export const buildingDefinitionSchema = z.strictObject({
  id,
  name: z.string().min(1),
  category: z.enum(BUILDING_CATEGORIES),
  size: z.strictObject({ width: positiveInt, height: positiveInt }),
  constructionCost: partialResourcesSchema,
  inputs: partialResourcesSchema,
  outputs: partialResourcesSchema,
  workersRequired: z.number().int().nonnegative(),
  housingCapacity: z.number().int().nonnegative(),
  maintenanceCost: nonNegative,
  moneyOutput: nonNegative,
  storageCapacity: z.number().int().nonnegative(),
  requiresRoad: z.boolean(),
  allowedTerrain: z.array(z.enum(TERRAIN_TYPES)).min(1),
  terrainEfficiency: z.partialRecord(z.enum(TERRAIN_TYPES), z.number().min(0).max(1)).optional(),
  toolUsePerWorker: nonNegative,
  service: z.strictObject({ type: z.enum(SERVICE_TYPES), radius: positiveInt }).optional(),
  requiredTechnologyId: id.optional(),
}) satisfies z.ZodType<BuildingDefinition>;

export const technologyDefinitionSchema = z.strictObject({
  id,
  name: z.string().min(1),
  cost: z.number().positive(),
  prerequisites: z.array(id),
  effects: z
    .array(
      z.strictObject({
        type: z.enum(TECHNOLOGY_EFFECT_TYPES),
        target: z.union([resourceId, z.literal('all')]),
        multiplier: z.number().positive(),
      }),
    )
    .min(1),
}) satisfies z.ZodType<TechnologyDefinition>;

const milestoneConditionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('population'), minimum: positiveInt }),
  z.strictObject({
    type: z.literal('happiness'),
    minimum: z.number().min(0).max(100),
    consecutiveDays: positiveInt.optional(),
  }),
  z.strictObject({ type: z.literal('building_count'), buildingId: id, minimum: positiveInt }),
  z.strictObject({ type: z.literal('completed_research'), minimum: positiveInt }),
  z.strictObject({ type: z.literal('all_research_completed') }),
  z.strictObject({
    type: z.literal('resource_balance'),
    resource: resourceId,
    minimum: z.number().finite(),
    consecutiveDays: positiveInt,
  }),
  z.strictObject({
    type: z.literal('money_balance'),
    minimum: z.number().finite(),
    consecutiveDays: positiveInt,
  }),
]) satisfies z.ZodType<MilestoneCondition>;

export const milestoneDefinitionSchema = z.strictObject({
  id,
  title: z.string().min(1),
  conditions: z.array(milestoneConditionSchema).min(1),
  rewards: z.strictObject({
    resources: partialResourcesSchema.optional(),
    money: nonNegative.optional(),
    badgeId: id.optional(),
  }),
}) satisfies z.ZodType<MilestoneDefinition>;

export const balanceSchema = z.strictObject({
  startingState: z.strictObject({
    population: positiveInt,
    resources: resourcesSchema,
    money: nonNegative,
    happiness: z.number().min(0).max(100),
  }),
  mapSize: z.strictObject({
    width: z.number().int().min(32).max(256),
    height: z.number().int().min(32).max(256),
  }),
  baseStorageCapacity: z.number().int().nonnegative(),
  workforceShare: z.number().min(0).max(1),
  minimumPopulation: z.number().int().nonnegative(),
  foodPerCapita: nonNegative,
  noToolsEfficiency: z.number().min(0).max(1),
  noFundsEfficiency: z.number().min(0).max(1),
  happinessWeights: z.strictObject({
    food: nonNegative,
    housing: nonNegative,
    water: nonNegative,
    education: nonNegative,
  }),
  happinessGrowthThreshold: z.number().min(0).max(100),
  happinessChangePerDay: z.number().positive(),
  housingComfortMargin: z.number().positive().max(1),
  populationGrowthRate: z.number().min(0).max(1),
  populationDeclineRate: z.number().min(0).max(1),
  happinessDeclineThreshold: z.number().min(0).max(100),
});

export type BalanceConfig = z.infer<typeof balanceSchema>;

export interface GameData {
  buildings: readonly BuildingDefinition[];
  technologies: readonly TechnologyDefinition[];
  milestones: readonly MilestoneDefinition[];
  balance: BalanceConfig;
  buildingsById: ReadonlyMap<string, BuildingDefinition>;
  technologiesById: ReadonlyMap<string, TechnologyDefinition>;
}

export interface RawGameData {
  buildings: unknown;
  technologies: unknown;
  milestones: unknown;
  balance: unknown;
}

export class GameDataError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Neplatné herné dáta:\n- ${issues.join('\n- ')}`);
    this.name = 'GameDataError';
    this.issues = issues;
  }
}

function formatZodIssues(source: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => `${source}[${issue.path.join('.')}]: ${issue.message}`);
}

function findDuplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of ids) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

/** Vráti ID technológie, ktorá je súčasťou cyklu v prerekvizitách, alebo null. */
function findPrerequisiteCycle(technologies: readonly TechnologyDefinition[]): string | null {
  const byId = new Map(technologies.map((t) => [t.id, t]));
  const state = new Map<string, 'visiting' | 'done'>();

  const visit = (techId: string): string | null => {
    const current = state.get(techId);
    if (current === 'done') return null;
    if (current === 'visiting') return techId;
    state.set(techId, 'visiting');
    for (const prerequisite of byId.get(techId)?.prerequisites ?? []) {
      if (!byId.has(prerequisite)) continue;
      const cycle = visit(prerequisite);
      if (cycle) return cycle;
    }
    state.set(techId, 'done');
    return null;
  };

  for (const tech of technologies) {
    const cycle = visit(tech.id);
    if (cycle) return cycle;
  }
  return null;
}

/**
 * Validuje surové herné dáta (schémy + krížové referencie).
 * Pri akejkoľvek chybe vyhodí GameDataError so zoznamom všetkých problémov.
 */
export function loadGameData(raw: RawGameData): GameData {
  const buildings = z.array(buildingDefinitionSchema).safeParse(raw.buildings);
  const technologies = z.array(technologyDefinitionSchema).safeParse(raw.technologies);
  const milestones = z.array(milestoneDefinitionSchema).safeParse(raw.milestones);
  const balance = balanceSchema.safeParse(raw.balance);

  const schemaIssues = [
    ...(buildings.success ? [] : formatZodIssues('buildings', buildings.error)),
    ...(technologies.success ? [] : formatZodIssues('technologies', technologies.error)),
    ...(milestones.success ? [] : formatZodIssues('milestones', milestones.error)),
    ...(balance.success ? [] : formatZodIssues('balance', balance.error)),
  ];
  if (!buildings.success || !technologies.success || !milestones.success || !balance.success) {
    throw new GameDataError(schemaIssues);
  }

  const issues: string[] = [];
  const buildingIds = new Set(buildings.data.map((b) => b.id));
  const technologyIds = new Set(technologies.data.map((t) => t.id));

  for (const duplicate of findDuplicates(buildings.data.map((b) => b.id))) {
    issues.push(`buildings: duplicitné ID "${duplicate}"`);
  }
  for (const duplicate of findDuplicates(technologies.data.map((t) => t.id))) {
    issues.push(`technologies: duplicitné ID "${duplicate}"`);
  }
  for (const duplicate of findDuplicates(milestones.data.map((m) => m.id))) {
    issues.push(`milestones: duplicitné ID "${duplicate}"`);
  }

  for (const building of buildings.data) {
    if (building.requiredTechnologyId && !technologyIds.has(building.requiredTechnologyId)) {
      issues.push(
        `buildings[${building.id}]: neznáma technológia "${building.requiredTechnologyId}"`,
      );
    }
  }

  for (const building of buildings.data) {
    for (const terrain of Object.keys(building.terrainEfficiency ?? {})) {
      if (!building.allowedTerrain.includes(terrain as TerrainType)) {
        issues.push(
          `buildings[${building.id}]: terrainEfficiency pre nepovolený terén "${terrain}"`,
        );
      }
    }
  }

  for (const tech of technologies.data) {
    for (const prerequisite of tech.prerequisites) {
      if (!technologyIds.has(prerequisite)) {
        issues.push(`technologies[${tech.id}]: neznáma prerekvizita "${prerequisite}"`);
      }
    }
  }
  const cycle = findPrerequisiteCycle(technologies.data);
  if (cycle) issues.push(`technologies: cyklus v prerekvizitách cez "${cycle}"`);

  for (const milestone of milestones.data) {
    for (const condition of milestone.conditions) {
      if (condition.type === 'building_count' && !buildingIds.has(condition.buildingId)) {
        issues.push(`milestones[${milestone.id}]: neznáma budova "${condition.buildingId}"`);
      }
      if (condition.type === 'completed_research' && condition.minimum > technologyIds.size) {
        issues.push(
          `milestones[${milestone.id}]: vyžaduje ${condition.minimum} technológií, existuje ${technologyIds.size}`,
        );
      }
    }
  }

  const weights = balance.data.happinessWeights;
  const weightSum = weights.food + weights.housing + weights.water + weights.education;
  if (Math.abs(weightSum - 1) > 1e-9) {
    issues.push(`balance: váhy spokojnosti musia mať súčet 1 (je ${weightSum})`);
  }
  if (balance.data.happinessDeclineThreshold > balance.data.happinessGrowthThreshold) {
    issues.push('balance: prah poklesu spokojnosti nesmie byť vyšší ako prah rastu');
  }

  if (issues.length > 0) throw new GameDataError(issues);

  return {
    buildings: buildings.data,
    technologies: technologies.data,
    milestones: milestones.data,
    balance: balance.data,
    buildingsById: new Map(buildings.data.map((b) => [b.id, b])),
    technologiesById: new Map(technologies.data.map((t) => [t.id, t])),
  };
}
