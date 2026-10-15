import {
  RESOURCE_IDS,
  type BuildingInstance,
  type GameState,
  type ResourceId,
  type Resources,
} from '@/types';
import type { GameData } from '../core/definitions';
import { effectiveDefinition } from '../core/levels';
import { computeConnectedBuildings, computeRoadNetwork } from '../world/connectivity';
import { getTile } from '../world/grid';
import { maintenanceMultiplier, moneyMultiplier, productionMultiplier } from './modifiers';

export type BuildingProblem =
  | { code: 'disabled' }
  /** Budova zasiahnutá udalosťou (požiar) — dočasne nefunguje. */
  | { code: 'damaged' }
  /** Domu výrazne chýba tovar; po čase klesne o úroveň. */
  | { code: 'no_goods' }
  | { code: 'no_road' }
  | { code: 'no_workers' }
  | { code: 'understaffed' }
  | { code: 'poor_terrain' }
  | { code: 'no_tools' }
  | { code: 'no_funds' }
  | { code: 'missing_input'; resource: ResourceId }
  | { code: 'storage_full'; resource: ResourceId };

export interface BuildingStatus {
  instanceId: string;
  connected: boolean;
  workersRequired: number;
  workersAssigned: number;
  /** Výsledný výkon budovy 0–1 (pracovníci × terén × financie × nástroje × vstupy). */
  efficiency: number;
  /** Suroviny spotrebované za deň (vrátane nástrojov). */
  consumed: Partial<Resources>;
  /** Suroviny vyrobené za deň (pred orezaním kapacitou skladu). */
  produced: Partial<Resources>;
  moneyIncome: number;
  maintenance: number;
  problems: BuildingProblem[];
}

export interface CityAnalysis {
  roadNetwork: ReadonlySet<number>;
  statuses: ReadonlyMap<string, BuildingStatus>;
  housingCapacity: number;
  storageCapacity: number;
  workforce: number;
  employedWorkers: number;
  /** Podiel údržby, ktorý mesto dokáže zaplatiť z pokladnice (0–1). */
  fundingRatio: number;
  maintenanceTotal: number;
  moneyIncome: number;
  /** Zásoby po rezervácii vstupov (krok 4), z ktorých pokračuje výroba. */
  resourcesAfterInputs: Resources;
}

/** Suroviny, na ktoré sa nevzťahuje kapacita skladu. */
export const UNCAPPED_RESOURCES: ReadonlySet<ResourceId> = new Set(['knowledge']);

function instanceNumber(building: BuildingInstance): number {
  const n = Number(building.id.slice(1));
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/** Poradie spracovania: vyššia priorita skôr, pri zhode staršia budova skôr. */
function byPriority(a: BuildingInstance, b: BuildingInstance): number {
  return b.priority - a.priority || instanceNumber(a) - instanceNumber(b) || (a.id < b.id ? -1 : 1);
}

function add(target: Partial<Resources>, resource: ResourceId, amount: number): void {
  if (amount > 0) target[resource] = (target[resource] ?? 0) + amount;
}

/**
 * Kroky 1–4 simulačného dňa (špecifikácia 2.4) a výpočet výroby bez zmeny stavu:
 * pripojenie k cestám, pridelenie pracovníkov, produkčná kapacita, rezervácia vstupov.
 * Výsledok slúži ticku aj UI (dôvody nefunkčnosti budov).
 */
export function analyzeCity(state: Readonly<GameState>, data: GameData): CityAnalysis {
  const { balance } = data;
  const economy = state.city.economy;
  const roadNetwork = computeRoadNetwork(state, data);
  const connectedIds = computeConnectedBuildings(state, data, roadNetwork);
  const statuses = new Map<string, BuildingStatus>();

  // 1. Pripojenie a kapacity z pripojených budov.
  let housingCapacity = 0;
  let storageCapacity = balance.baseStorageCapacity;
  let maintenanceBase = 0;
  for (const building of state.city.buildings) {
    const base = data.buildingsById.get(building.definitionId);
    if (!base) continue;
    const definition = effectiveDefinition(base, building.level);
    const connected = connectedIds.has(building.id);
    if (connected) {
      housingCapacity += definition.housingCapacity;
      storageCapacity += definition.storageCapacity;
    }
    maintenanceBase += definition.maintenanceCost;
    statuses.set(building.id, {
      instanceId: building.id,
      connected,
      workersRequired: definition.workersRequired,
      workersAssigned: 0,
      efficiency: 0,
      consumed: {},
      produced: {},
      moneyIncome: 0,
      maintenance: definition.maintenanceCost,
      problems: [],
    });
  }

  const maintenanceFactor = maintenanceMultiplier(state, data);
  // Násobiče výroby raz za analýzu (technológie, divy, udalosti) — nie pre každú budovu.
  const productionFactors = new Map(
    RESOURCE_IDS.map((id) => [id, productionMultiplier(state, data, id)] as const),
  );
  const moneyFactor = moneyMultiplier(state, data);
  const maintenanceTotal = maintenanceBase * maintenanceFactor;
  const fundingRatio =
    maintenanceTotal > 0 ? Math.min(1, Math.max(0, economy.money) / maintenanceTotal) : 1;

  const ordered = [...state.city.buildings].sort(byPriority);
  // Budovy dočasne mimo prevádzky po udalosti (požiar).
  const damaged = new Set(
    (state.events?.active ?? []).flatMap((e) =>
      e.effect.type === 'disable_building' ? [e.effect.buildingId] : [],
    ),
  );

  // 2. Pridelenie pracovníkov podľa priority.
  const workforce = Math.floor(state.city.population.total * balance.workforceShare);
  let freeWorkers = workforce;
  for (const building of ordered) {
    const status = statuses.get(building.id);
    if (
      !status ||
      !building.enabled ||
      damaged.has(building.id) ||
      !status.connected ||
      status.workersRequired === 0
    )
      continue;
    status.workersAssigned = Math.min(status.workersRequired, freeWorkers);
    freeWorkers -= status.workersAssigned;
  }

  // 3.–4. Kapacita a rezervácia vstupov podľa priority zo zásob na začiatku dňa.
  const pool: Resources = { ...economy.resources };
  let moneyIncome = 0;
  for (const building of ordered) {
    const status = statuses.get(building.id);
    const base = data.buildingsById.get(building.definitionId);
    if (!status || !base) continue;
    const definition = effectiveDefinition(base, building.level);
    status.maintenance = definition.maintenanceCost * maintenanceFactor;

    if (!building.enabled) {
      status.problems.push({ code: 'disabled' });
      continue;
    }
    if (damaged.has(building.id)) {
      status.problems.push({ code: 'damaged' });
      continue;
    }
    if (!status.connected) {
      if (definition.requiresRoad) status.problems.push({ code: 'no_road' });
      continue;
    }
    if (building.neglect) status.problems.push({ code: 'no_goods' });

    const producesSomething =
      definition.moneyOutput > 0 || RESOURCE_IDS.some((id) => (definition.outputs[id] ?? 0) > 0);
    if (!producesSomething) {
      // Služby bez výroby (chrám, katedrála) fungujú podľa obsadenia pracovníkmi.
      if (status.workersRequired > 0) {
        status.efficiency = status.workersAssigned / status.workersRequired;
        if (status.workersAssigned === 0) status.problems.push({ code: 'no_workers' });
        else if (status.efficiency < 1) status.problems.push({ code: 'understaffed' });
      } else {
        status.efficiency = 1;
      }
      continue;
    }

    let capacity = 1;
    if (status.workersRequired > 0) {
      capacity = status.workersAssigned / status.workersRequired;
      if (status.workersAssigned === 0) status.problems.push({ code: 'no_workers' });
      else if (capacity < 1) status.problems.push({ code: 'understaffed' });
    }

    const terrain = getTile(state.world, building.position.x, building.position.y)?.terrain;
    const terrainFactor = (terrain && definition.terrainEfficiency?.[terrain]) ?? 1;
    if (terrainFactor < 1) status.problems.push({ code: 'poor_terrain' });
    capacity *= terrainFactor;

    if (definition.maintenanceCost > 0 && fundingRatio < 1) {
      capacity *= balance.noFundsEfficiency + (1 - balance.noFundsEfficiency) * fundingRatio;
      status.problems.push({ code: 'no_funds' });
    }

    // Plný sklad všetkých výrobkov: budova si dá prestávku a nemíňa vstupy ani nástroje.
    const outputIds = RESOURCE_IDS.filter((id) => (definition.outputs[id] ?? 0) > 0);
    const allOutputsFull =
      outputIds.length > 0 &&
      definition.moneyOutput === 0 &&
      outputIds.every(
        (id) => !UNCAPPED_RESOURCES.has(id) && economy.resources[id] >= storageCapacity,
      );
    if (allOutputsFull) {
      for (const id of outputIds) status.problems.push({ code: 'storage_full', resource: id });
      status.efficiency = 0;
      continue;
    }

    const toolsNeeded = status.workersAssigned * definition.toolUsePerWorker;
    if (toolsNeeded > 0) {
      const toolsUsed = Math.min(pool.tools, toolsNeeded);
      pool.tools -= toolsUsed;
      add(status.consumed, 'tools', toolsUsed);
      const toolRatio = toolsUsed / toolsNeeded;
      if (toolRatio < 1) {
        capacity *= balance.noToolsEfficiency + (1 - balance.noToolsEfficiency) * toolRatio;
        status.problems.push({ code: 'no_tools' });
      }
    }

    let inputRatio = 1;
    if (capacity > 0) {
      for (const id of RESOURCE_IDS) {
        const needed = (definition.inputs[id] ?? 0) * capacity;
        if (needed > 0) inputRatio = Math.min(inputRatio, pool[id] / needed);
      }
    }
    for (const id of RESOURCE_IDS) {
      const needed = (definition.inputs[id] ?? 0) * capacity;
      if (needed <= 0) continue;
      if (pool[id] < needed) status.problems.push({ code: 'missing_input', resource: id });
      const used = Math.min(pool[id], needed * inputRatio);
      pool[id] -= used;
      add(status.consumed, id, used);
    }

    status.efficiency = capacity * inputRatio;
    for (const id of RESOURCE_IDS) {
      const output = definition.outputs[id] ?? 0;
      if (output <= 0) continue;
      add(status.produced, id, output * status.efficiency * productionFactors.get(id)!);
      if (!UNCAPPED_RESOURCES.has(id) && economy.resources[id] >= storageCapacity) {
        status.problems.push({ code: 'storage_full', resource: id });
      }
    }
    status.moneyIncome = definition.moneyOutput * status.efficiency * moneyFactor;
    moneyIncome += status.moneyIncome;
  }

  return {
    roadNetwork,
    statuses,
    housingCapacity,
    storageCapacity,
    workforce,
    employedWorkers: workforce - freeWorkers,
    fundingRatio,
    maintenanceTotal,
    moneyIncome,
    resourcesAfterInputs: pool,
  };
}

/** Zapíše do stavu odvodené hodnoty (kapacity, pracovníci), ktoré UI zobrazuje medzi tickmi. */
export function refreshDerivedState(state: GameState, data: GameData): CityAnalysis {
  const analysis = analyzeCity(state, data);
  state.city.population.housingCapacity = analysis.housingCapacity;
  state.city.population.availableWorkers = analysis.workforce;
  state.city.population.employedWorkers = analysis.employedWorkers;
  state.city.economy.storageCapacity = analysis.storageCapacity;
  return analysis;
}
