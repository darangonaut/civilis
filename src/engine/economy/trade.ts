import { RESOURCE_IDS, type CommandResult, type GameState, type ResourceId } from '@/types';
import type { CommandFailureReason } from '../core/commandReasons';
import type { GameData } from '../core/definitions';

const fail = (reason: CommandFailureReason): CommandResult => ({ success: false, reason });

/** Obchodovať sa dá, keď mesto má budovu obchodu (trhovisko). */
export function tradeAvailable(state: Readonly<GameState>, data: GameData): boolean {
  const required = data.balance.trade.requiredBuilding;
  return state.city.buildings.some((b) => b.definitionId === required);
}

export function isTradable(data: GameData, resource: ResourceId): boolean {
  return (data.balance.trade.prices[resource] ?? 0) > 0;
}

/** Podiel ceny, ktorý mesto dostane pri predaji — zvyšujú ho prístav, železnica… */
export function sellFactor(state: Readonly<GameState>, data: GameData): number {
  const { sellFactor: base, bonusBuildings } = data.balance.trade;
  let factor = base;
  for (const [buildingId, bonus] of Object.entries(bonusBuildings)) {
    if (state.city.buildings.some((b) => b.definitionId === buildingId)) factor += bonus;
  }
  return Math.min(1, factor);
}

export function buyPrice(data: GameData, resource: ResourceId): number {
  return data.balance.trade.prices[resource] ?? 0;
}

export function sellPrice(
  state: Readonly<GameState>,
  data: GameData,
  resource: ResourceId,
): number {
  return buyPrice(data, resource) * sellFactor(state, data);
}

/** Overenie obchodu: kladné množstvo = nákup, záporné = predaj. */
export function validateTrade(
  state: Readonly<GameState>,
  data: GameData,
  resource: ResourceId,
  amount: number,
): CommandResult {
  if (!Number.isInteger(amount) || amount === 0) return fail('invalid_amount');
  if (!(RESOURCE_IDS as readonly string[]).includes(resource) || !isTradable(data, resource))
    return fail('not_tradable');
  if (!tradeAvailable(state, data)) return fail('trade_unavailable');
  const economy = state.city.economy;
  if (amount < 0) {
    if (-amount > Math.floor(economy.resources[resource])) return fail('insufficient_resources');
  } else {
    if (amount * buyPrice(data, resource) > economy.money) return fail('insufficient_funds');
    if (economy.resources[resource] + amount > economy.storageCapacity) return fail('storage_full');
  }
  return { success: true };
}

export function executeTrade(
  state: GameState,
  data: GameData,
  resource: ResourceId,
  amount: number,
): CommandResult {
  const validation = validateTrade(state, data, resource, amount);
  if (!validation.success) return validation;
  const economy = state.city.economy;
  economy.resources[resource] += amount;
  if (amount > 0) {
    economy.money -= amount * buyPrice(data, resource);
  } else {
    const revenue = -amount * sellPrice(state, data, resource);
    economy.money += revenue;
    state.trade.earned += revenue;
  }
  return { success: true };
}

export function setAutoSell(
  state: GameState,
  data: GameData,
  resource: ResourceId,
  enabled: boolean,
): CommandResult {
  if (!(RESOURCE_IDS as readonly string[]).includes(resource) || !isTradable(data, resource))
    return fail('not_tradable');
  const list = state.trade.autoSell.filter((id) => id !== resource);
  if (enabled) list.push(resource);
  // Poradie podľa RESOURCE_IDS — stav nezávisí od poradia klikania.
  state.trade.autoSell = RESOURCE_IDS.filter((id) => list.includes(id));
  return { success: true };
}

/**
 * Denný automatický predaj: surovina nad `autoSellAbove` kapacity skladu sa predá
 * na `autoSellTo`. Vráti príjem z predaja.
 */
export function autoSell(state: GameState, data: GameData): number {
  if (state.trade.autoSell.length === 0 || !tradeAvailable(state, data)) return 0;
  const { autoSellAbove, autoSellTo } = data.balance.trade;
  const economy = state.city.economy;
  const capacity = economy.storageCapacity;
  let revenue = 0;
  for (const resource of state.trade.autoSell) {
    if (!isTradable(data, resource)) continue;
    const stock = economy.resources[resource];
    if (stock <= capacity * autoSellAbove) continue;
    const amount = Math.floor(stock - capacity * autoSellTo);
    if (amount <= 0) continue;
    economy.resources[resource] -= amount;
    revenue += amount * sellPrice(state, data, resource);
  }
  economy.money += revenue;
  state.trade.earned += revenue;
  return revenue;
}
