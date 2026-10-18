import type { TechnologyEffect } from './research';
import type { Resources } from './resources';
import type { Position, TerrainType } from './world';

export const BUILDING_CATEGORIES = [
  'housing',
  'production',
  'service',
  'infrastructure',
  /** Parky a dekorácie (rozšírenie). */
  'decoration',
  /** Divy sveta — unikátne veľké stavby s trvalým bonusom (rozšírenie). */
  'wonder',
] as const;
export type BuildingCategory = (typeof BUILDING_CATEGORIES)[number];

export const SERVICE_TYPES = ['water', 'education', 'culture', 'health', 'leisure'] as const;
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
  /** Tovar, ktorý obyvatelia domu spotrebujú za deň (na obyvateľa). Platí od tejto úrovne. */
  needs?: Partial<Resources>;
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
  /** Budova je súčasť cestnej siete (cesta, most). Rozšírenie. */
  isRoad?: boolean;
  /** Pripojenie sa šíri cez susedné budovy rovnakého typu (bloky polí). Rozšírenie. */
  connectsAdjacent?: boolean;
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

  /** Potreby obyvateľov (tovar na obyvateľa za deň) — efektívna hodnota podľa úrovne. */
  needs?: Partial<Resources>;

  /** Znečistenie okolia počas prevádzky: sila a dosah (Chebyševova vzdialenosť). */
  pollution?: {
    amount: number;
    radius: number;
  };

  /** Div sveta: v meste najviac raz, trvalé efekty ako technológie a bonus k spokojnosti. */
  wonder?: {
    effects: TechnologyEffect[];
    happiness?: number;
  };
}

export interface BuildingInstance {
  id: string;
  definitionId: string;
  position: Position;
  enabled: boolean;
  priority: number;
  /** Úroveň budovy od 1 (rozšírenie oproti špecifikácii, schéma v2). */
  level: number;
  /** Dni po sebe, keď domu výrazne chýba tovar (pri prekročení limitu klesne úroveň). */
  neglect?: number;
}
