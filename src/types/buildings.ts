import type { Resources } from './resources';
import type { Position, TerrainType } from './world';

export const BUILDING_CATEGORIES = ['housing', 'production', 'service', 'infrastructure'] as const;
export type BuildingCategory = (typeof BUILDING_CATEGORIES)[number];

export const SERVICE_TYPES = ['water', 'education'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/** Vyššia úroveň budovy (2, 3, …). Neuvedené hodnoty sa preberú z predchádzajúcej úrovne. */
export interface BuildingLevelDefinition {
  name: string;
  upgradeCost: Partial<Resources>;
  requiredTechnologyId?: string;
  /** Služby, v ktorých dosahu musí budova stáť (napr. voda pre murovaný dom). */
  requiredServices?: ServiceType[];
  housingCapacity?: number;
  storageCapacity?: number;
  workersRequired?: number;
  maintenanceCost?: number;
  /** Násobič výroby aj spotreby oproti základnej úrovni. */
  productionMultiplier?: number;
}

export interface BuildingDefinition {
  id: string;
  name: string;
  category: BuildingCategory;

  size: {
    width: number;
    height: number;
  };

  constructionCost: Partial<Resources>;

  inputs: Partial<Resources>;
  outputs: Partial<Resources>;

  workersRequired: number;
  housingCapacity: number;
  maintenanceCost: number;

  /** Peniaze vyprodukované za deň pri plnom výkone (trhovisko). Rozšírenie oproti špecifikácii. */
  moneyOutput: number;
  /** Navýšenie kapacity skladu (sklad). Rozšírenie oproti špecifikácii. */
  storageCapacity: number;

  requiresRoad: boolean;
  allowedTerrain: TerrainType[];
  /** Výkon na danom teréne (0–1), chýbajúci terén = 1. Rozšírenie oproti špecifikácii. */
  terrainEfficiency?: Partial<Record<TerrainType, number>>;
  /** Spotreba nástrojov na zamestnaného pracovníka za deň. Rozšírenie oproti špecifikácii. */
  toolUsePerWorker: number;

  service?: {
    type: ServiceType;
    radius: number;
  };

  requiredTechnologyId?: string;

  /** Úrovne 2, 3, … (rozšírenie oproti špecifikácii). */
  levels?: BuildingLevelDefinition[];
}

export interface BuildingInstance {
  id: string;
  definitionId: string;
  position: Position;
  enabled: boolean;
  priority: number;
  /** Úroveň budovy od 1 (rozšírenie oproti špecifikácii, schéma v2). */
  level: number;
}
