import { z } from 'zod';
import {
  BUILDING_CATEGORIES,
  RESOURCE_IDS,
  SERVICE_TYPES,
  TECHNOLOGY_EFFECT_TYPES,
  TERRAIN_TYPES,
  type BuildingDefinition,
  type EraDefinition,
  type AchievementCondition,
  type AchievementDefinition,
  type EventDefinition,
  type EventEffect,
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

export const resourcesSchema = z.strictObject({
  food: nonNegative,
  wood: nonNegative,
  stone: nonNegative,
  tools: nonNegative,
  knowledge: nonNegative,
  bricks: nonNegative,
  iron: nonNegative,
  cloth: nonNegative,
  coal: nonNegative,
  electricity: nonNegative,
  electronics: nonNegative,
}) satisfies z.ZodType<Resources>;

export const partialResourcesSchema = resourcesSchema.partial();

const technologyEffectSchema = z.strictObject({
  type: z.enum(TECHNOLOGY_EFFECT_TYPES),
  target: z.union([resourceId, z.literal('all')]),
  multiplier: z.number().positive(),
});

const buildingLevelSchema = z.strictObject({
  name: z.string().min(1),
  upgradeCost: partialResourcesSchema,
  requiredTechnologyId: id.optional(),
  requiredServices: z.array(z.enum(SERVICE_TYPES)).optional(),
  housingCapacity: z.number().int().nonnegative().optional(),
  storageCapacity: z.number().int().nonnegative().optional(),
  workersRequired: z.number().int().nonnegative().optional(),
  maintenanceCost: nonNegative.optional(),
  productionMultiplier: z.number().positive().optional(),
  needs: partialResourcesSchema.optional(),
});

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
  connectsAdjacent: z.boolean().optional(),
  allowedTerrain: z.array(z.enum(TERRAIN_TYPES)).min(1),
  terrainEfficiency: z.partialRecord(z.enum(TERRAIN_TYPES), z.number().min(0).max(1)).optional(),
  toolUsePerWorker: nonNegative,
  service: z.strictObject({ type: z.enum(SERVICE_TYPES), radius: positiveInt }).optional(),
  requiredTechnologyId: id.optional(),
  levels: z.array(buildingLevelSchema).optional(),
  needs: partialResourcesSchema.optional(),
  pollution: z.strictObject({ amount: z.number().positive(), radius: positiveInt }).optional(),
  wonder: z
    .strictObject({
      effects: z.array(technologyEffectSchema),
      happiness: nonNegative.optional(),
    })
    .optional(),
}) satisfies z.ZodType<BuildingDefinition>;

export const eraDefinitionSchema = z.strictObject({
  id,
  name: z.string().min(1),
  description: z.string(),
}) satisfies z.ZodType<EraDefinition>;

export const technologyDefinitionSchema = z.strictObject({
  id,
  name: z.string().min(1),
  era: id,
  cost: z.number().positive(),
  prerequisites: z.array(id),
  effects: z.array(technologyEffectSchema).min(1),
}) satisfies z.ZodType<TechnologyDefinition>;

const milestoneConditionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('population'), minimum: positiveInt }),
  z.strictObject({
    type: z.literal('happiness'),
    minimum: z.number().min(0).max(100),
    consecutiveDays: positiveInt.optional(),
  }),
  z.strictObject({ type: z.literal('building_count'), buildingId: id, minimum: positiveInt }),
  z.strictObject({
    type: z.literal('building_level'),
    buildingId: id,
    level: z.number().int().min(2),
    minimum: positiveInt,
  }),
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
  era: id,
  conditions: z.array(milestoneConditionSchema).min(1),
  rewards: z.strictObject({
    resources: partialResourcesSchema.optional(),
    money: nonNegative.optional(),
    badgeId: id.optional(),
  }),
}) satisfies z.ZodType<MilestoneDefinition>;

const achievementConditionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('population'), minimum: positiveInt }),
  z.strictObject({ type: z.literal('completed_research'), minimum: positiveInt }),
  z.strictObject({ type: z.literal('happiness'), minimum: z.number().min(0).max(100) }),
  z.strictObject({ type: z.literal('money'), minimum: positiveInt }),
  z.strictObject({ type: z.literal('trade_earned'), minimum: positiveInt }),
  z.strictObject({ type: z.literal('wonder_count'), minimum: positiveInt }),
  z.strictObject({ type: z.literal('building_count'), buildingId: id, minimum: positiveInt }),
  z.strictObject({
    type: z.literal('building_level'),
    buildingId: id,
    level: z.number().int().min(2),
    minimum: positiveInt,
  }),
  z.strictObject({ type: z.literal('era'), minimum: z.number().int().nonnegative() }),
  z.strictObject({ type: z.literal('finished_before_day'), minimum: positiveInt }),
]) satisfies z.ZodType<AchievementCondition>;

export const achievementDefinitionSchema = z.strictObject({
  id,
  name: z.string().min(1),
  description: z.string().min(1),
  condition: achievementConditionSchema,
}) satisfies z.ZodType<AchievementDefinition>;

const eventEffectSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('production'),
    resource: z.union([resourceId, z.literal('all')]),
    multiplier: z.number().nonnegative(),
    days: positiveInt,
  }),
  z.strictObject({ type: z.literal('happiness'), amount: z.number().finite(), days: positiveInt }),
  z.strictObject({ type: z.literal('population_loss'), share: z.number().min(0).max(1) }),
  z.strictObject({
    type: z.literal('immigrants'),
    share: z.number().min(0).max(1),
    minimum: z.number().int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('resources_share'), resources: partialResourcesSchema }),
  z.strictObject({ type: z.literal('knowledge_days'), days: positiveInt, minimum: nonNegative }),
  z.strictObject({ type: z.literal('money_days'), days: positiveInt, minimum: nonNegative }),
  z.strictObject({ type: z.literal('disable_building'), days: positiveInt }),
  z.strictObject({
    type: z.literal('caravan'),
    storageShare: z.number().positive().max(1),
    priceFactor: z.number().positive(),
  }),
]) satisfies z.ZodType<EventEffect>;

export const eventDefinitionSchema = z
  .strictObject({
    id,
    name: z.string().min(1),
    description: z.string().min(1),
    kind: z.enum(['bad', 'good', 'choice']),
    era: id,
    weight: z.number().positive(),
    requiresBuildings: z.array(id).optional(),
    effects: z.array(eventEffectSchema).optional(),
    choices: z
      .array(
        z.strictObject({
          id,
          cost: z
            .strictObject({
              money: nonNegative.optional(),
              moneyPerCapita: nonNegative.optional(),
              minimum: nonNegative.optional(),
            })
            .optional(),
          effects: z.array(eventEffectSchema),
        }),
      )
      .min(2)
      .optional(),
    mitigation: z
      .strictObject({
        technologies: z.array(id).optional(),
        buildings: z.array(id).optional(),
        services: z.array(z.enum(SERVICE_TYPES)).optional(),
        minShare: z.number().min(0).max(1).optional(),
        factor: z.number().min(0).max(1),
      })
      .optional(),
  })
  .refine((e) => (e.kind === 'choice') === (e.choices !== undefined), {
    message: 'udalosť s voľbou musí mať `choices`, ostatné `effects`',
  }) satisfies z.ZodType<EventDefinition>;

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
  /** Podiel investovaných surovín, ktorý vráti zbúranie (recyklácia). */
  demolishRefund: z.number().min(0).max(1),
  /** Základný zber bez budov — zabraňuje neobnoviteľnému stavu (žiadne drevo ani kameň). */
  baseProduction: partialResourcesSchema,
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
  populationBaseGrowth: nonNegative,
  populationGrowthRate: z.number().min(0).max(1),
  /** Najviac nových obyvateľov za deň. */
  populationMaxGrowth: z.number().int().positive(),
  /** Strop rastu ako podiel populácie (ak je vyšší ako `populationMaxGrowth`). */
  populationMaxGrowthShare: z.number().min(0).max(1),
  populationDeclineRate: z.number().min(0).max(1),
  happinessDeclineThreshold: z.number().min(0).max(100),
  /** Bonus k spokojnosti pri plnom pokrytí bývania parkami a dekoráciami. */
  leisureBonus: nonNegative,
  /** Potreby obyvateľov: strop postihu spokojnosti a pokles úrovne pri dlhom nedostatku. */
  needs: z.strictObject({
    happinessPenalty: nonNegative,
    /** Pod týmto zásobením (0–1) sa domu počítajú dni nedostatku. */
    downgradeBelow: z.number().min(0).max(1),
    downgradeDays: positiveInt,
    /** Rozptyl limitu medzi domami, aby neklesali všetky naraz. */
    downgradeSpread: z.number().int().nonnegative(),
  }),
  /** Znečistenie: strop postihu spokojnosti, prah znečisteného políčka, čistenie parkami. */
  pollution: z.strictObject({
    happinessPenalty: nonNegative,
    threshold: z.number().positive(),
    leisureCleansing: nonNegative,
  }),
  /** Náhodné udalosti: prvá najskôr v deň `firstDay`, potom každých min–max dní. */
  events: z.strictObject({
    firstDay: z.number().int().nonnegative(),
    minInterval: positiveInt,
    maxInterval: positiveInt,
    /** Po koľkých dňoch sa nerozhodnutá udalosť vyrieši poslednou voľbou. */
    pendingDays: positiveInt,
  }),
  /** Obchod: ceny (nákup), podiel pri predaji, budovy zlepšujúce výkup, automatický predaj. */
  trade: z.strictObject({
    requiredBuilding: id,
    prices: partialResourcesSchema,
    sellFactor: z.number().min(0).max(1),
    bonusBuildings: z.record(id, z.number().min(0).max(1)),
    autoSellAbove: z.number().min(0).max(1),
    autoSellTo: z.number().min(0).max(1),
  }),
});

export type BalanceConfig = z.infer<typeof balanceSchema>;

export interface GameData {
  eras: readonly EraDefinition[];
  buildings: readonly BuildingDefinition[];
  technologies: readonly TechnologyDefinition[];
  milestones: readonly MilestoneDefinition[];
  achievements: readonly AchievementDefinition[];
  events: readonly EventDefinition[];
  balance: BalanceConfig;
  buildingsById: ReadonlyMap<string, BuildingDefinition>;
  technologiesById: ReadonlyMap<string, TechnologyDefinition>;
}

export interface RawGameData {
  eras: unknown;
  buildings: unknown;
  technologies: unknown;
  milestones: unknown;
  /** Úspechy (nepovinné — testovacie dáta ich nemusia mať). */
  achievements?: unknown;
  /** Náhodné udalosti (nepovinné). */
  events?: unknown;
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
  const eras = z.array(eraDefinitionSchema).min(1).safeParse(raw.eras);
  const buildings = z.array(buildingDefinitionSchema).safeParse(raw.buildings);
  const technologies = z.array(technologyDefinitionSchema).safeParse(raw.technologies);
  const milestones = z.array(milestoneDefinitionSchema).safeParse(raw.milestones);
  const balance = balanceSchema.safeParse(raw.balance);
  const achievements = z.array(achievementDefinitionSchema).safeParse(raw.achievements ?? []);
  const events = z.array(eventDefinitionSchema).safeParse(raw.events ?? []);

  const schemaIssues = [
    ...(eras.success ? [] : formatZodIssues('eras', eras.error)),
    ...(buildings.success ? [] : formatZodIssues('buildings', buildings.error)),
    ...(technologies.success ? [] : formatZodIssues('technologies', technologies.error)),
    ...(milestones.success ? [] : formatZodIssues('milestones', milestones.error)),
    ...(balance.success ? [] : formatZodIssues('balance', balance.error)),
    ...(achievements.success ? [] : formatZodIssues('achievements', achievements.error)),
    ...(events.success ? [] : formatZodIssues('events', events.error)),
  ];
  if (
    !eras.success ||
    !buildings.success ||
    !technologies.success ||
    !milestones.success ||
    !balance.success ||
    !achievements.success ||
    !events.success
  ) {
    throw new GameDataError(schemaIssues);
  }

  const issues: string[] = [];
  const buildingIds = new Set(buildings.data.map((b) => b.id));
  const eraIndex = new Map(eras.data.map((e, i) => [e.id, i]));
  for (const duplicate of findDuplicates(eras.data.map((e) => e.id))) {
    issues.push(`eras: duplicitné ID "${duplicate}"`);
  }
  for (const tech of technologies.data) {
    if (!eraIndex.has(tech.era)) issues.push(`technologies[${tech.id}]: neznáma éra "${tech.era}"`);
  }
  let lastMilestoneEra = 0;
  for (const milestone of milestones.data) {
    const index = eraIndex.get(milestone.era);
    if (index === undefined)
      issues.push(`milestones[${milestone.id}]: neznáma éra "${milestone.era}"`);
    else if (index < lastMilestoneEra)
      issues.push(`milestones[${milestone.id}]: míľniky musia ísť v poradí ér`);
    else lastMilestoneEra = index;
  }
  for (const era of eras.data) {
    if (!milestones.data.some((m) => m.era === era.id))
      issues.push(`eras[${era.id}]: éra nemá žiadny míľnik`);
  }
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
    for (const level of building.levels ?? []) {
      if (level.requiredTechnologyId && !technologyIds.has(level.requiredTechnologyId)) {
        issues.push(
          `buildings[${building.id}]: úroveň "${level.name}" vyžaduje neznámu technológiu "${level.requiredTechnologyId}"`,
        );
      }
    }
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
      const pre = technologies.data.find((t) => t.id === prerequisite);
      if (pre && (eraIndex.get(pre.era) ?? 0) > (eraIndex.get(tech.era) ?? 0)) {
        issues.push(`technologies[${tech.id}]: prerekvizita "${prerequisite}" je z neskoršej éry`);
      }
      if (!technologyIds.has(prerequisite)) {
        issues.push(`technologies[${tech.id}]: neznáma prerekvizita "${prerequisite}"`);
      }
    }
  }
  const cycle = findPrerequisiteCycle(technologies.data);
  if (cycle) issues.push(`technologies: cyklus v prerekvizitách cez "${cycle}"`);

  for (const milestone of milestones.data) {
    for (const condition of milestone.conditions) {
      if (condition.type === 'building_level') {
        const levels =
          buildings.data.find((b) => b.id === condition.buildingId)?.levels?.length ?? 0;
        if (condition.level > levels + 1) {
          issues.push(
            `milestones[${milestone.id}]: budova "${condition.buildingId}" nemá úroveň ${condition.level}`,
          );
        }
      }
      if (
        (condition.type === 'building_count' || condition.type === 'building_level') &&
        !buildingIds.has(condition.buildingId)
      ) {
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
  const trade = balance.data.trade;
  for (const buildingId of [trade.requiredBuilding, ...Object.keys(trade.bonusBuildings)]) {
    if (!buildingIds.has(buildingId)) issues.push(`balance.trade: neznáma budova "${buildingId}"`);
  }
  if (trade.prices.knowledge !== undefined) {
    issues.push('balance.trade: vedomosti sa nedajú obchodovať');
  }
  if (trade.autoSellTo > trade.autoSellAbove) {
    issues.push('balance.trade: autoSellTo musí byť nižšie ako autoSellAbove');
  }

  for (const duplicate of findDuplicates(achievements.data.map((a) => a.id))) {
    issues.push(`achievements: duplicitné ID "${duplicate}"`);
  }
  for (const achievement of achievements.data) {
    const condition = achievement.condition;
    if ('buildingId' in condition && !buildingIds.has(condition.buildingId)) {
      issues.push(`achievements[${achievement.id}]: neznáma budova "${condition.buildingId}"`);
    }
  }

  for (const event of events.data) {
    if (!eraIndex.has(event.era)) issues.push(`events[${event.id}]: neznáma éra "${event.era}"`);
    const referenced = [...(event.requiresBuildings ?? []), ...(event.mitigation?.buildings ?? [])];
    for (const buildingId of referenced) {
      if (!buildingIds.has(buildingId))
        issues.push(`events[${event.id}]: neznáma budova "${buildingId}"`);
    }
    for (const techId of event.mitigation?.technologies ?? []) {
      if (!technologies.data.some((t) => t.id === techId))
        issues.push(`events[${event.id}]: neznáma technológia "${techId}"`);
    }
  }
  if (balance.data.events.minInterval > balance.data.events.maxInterval) {
    issues.push('balance.events: minInterval nesmie byť väčší ako maxInterval');
  }

  if (issues.length > 0) throw new GameDataError(issues);

  return {
    eras: eras.data,
    buildings: buildings.data,
    technologies: technologies.data,
    milestones: milestones.data,
    achievements: achievements.data,
    events: events.data,
    balance: balance.data,
    buildingsById: new Map(buildings.data.map((b) => [b.id, b])),
    technologiesById: new Map(technologies.data.map((t) => [t.id, t])),
  };
}
