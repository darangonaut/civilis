import type { ResourceId, Resources } from './resources';

export const TECHNOLOGY_EFFECT_TYPES = ['production_multiplier', 'maintenance_multiplier'] as const;
export type TechnologyEffectType = (typeof TECHNOLOGY_EFFECT_TYPES)[number];

export interface TechnologyEffect {
  type: TechnologyEffectType;
  /** ResourceId alebo "all". */
  target: string;
  multiplier: number;
}

export interface EraDefinition {
  id: string;
  name: string;
  /** Krátky popis pre obrazovku novej éry. */
  description: string;
}

export interface TechnologyDefinition {
  id: string;
  name: string;
  /** Éra, v ktorej sa technológia dá skúmať (rozšírenie oproti špecifikácii). */
  era: string;
  cost: number;
  prerequisites: string[];

  effects: TechnologyEffect[];
}

export interface ResearchState {
  completedTechnologyIds: string[];
  activeTechnologyId: string | null;
  investedKnowledge: number;
}

export type MilestoneCondition =
  | { type: 'population'; minimum: number }
  | { type: 'happiness'; minimum: number; consecutiveDays?: number }
  | { type: 'building_count'; buildingId: string; minimum: number }
  | { type: 'building_level'; buildingId: string; level: number; minimum: number }
  | { type: 'completed_research'; minimum: number }
  | { type: 'all_research_completed' }
  | { type: 'resource_balance'; resource: ResourceId; minimum: number; consecutiveDays: number }
  | { type: 'money_balance'; minimum: number; consecutiveDays: number };

export interface MilestoneDefinition {
  id: string;
  title: string;
  /** Éra míľnika; splnenie posledného míľnika éry odomkne ďalšiu (rozšírenie). */
  era: string;
  conditions: MilestoneCondition[];
  rewards: {
    resources?: Partial<Resources>;
    money?: number;
    badgeId?: string;
  };
}

export interface MilestoneState {
  completedIds: string[];
  progressDays: Record<string, number>;
}
