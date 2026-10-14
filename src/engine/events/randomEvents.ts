import {
  RESOURCE_IDS,
  type ActiveEventEffect,
  type CommandResult,
  type EventDefinition,
  type EventEffect,
  type GameState,
  type PendingEvent,
  type ResourceId,
} from '@/types';
import type { CommandFailureReason } from '../core/commandReasons';
import type { GameData } from '../core/definitions';
import type { GameEvent } from '../core/events';
import { effectiveDefinition } from '../core/levels';
import { hash2 } from '../core/random';
import { analyzeCity, UNCAPPED_RESOURCES } from '../economy/analysis';
import { buyPrice, isTradable } from '../economy/trade';
import { buildingEraIndex, currentEraIndex } from '../milestones/eras';
import { serviceCoverage } from '../population/population';

const fail = (reason: CommandFailureReason): CommandResult => ({ success: false, reason });

/** Deterministické „náhodné“ číslo pre deň a účel (nezávisí od poradia volaní). */
const roll = (state: Readonly<GameState>, salt: number) =>
  hash2(state.simulation.day, salt, state.simulation.seed);

const freeHousing = (state: Readonly<GameState>) =>
  Math.max(0, state.city.population.housingCapacity - state.city.population.total);

/** Budovy, ktoré môže zasiahnuť požiar: s pracovníkmi, nie divy. */
function fireTargets(state: Readonly<GameState>, data: GameData): string[] {
  return state.city.buildings
    .filter((b) => {
      const base = data.buildingsById.get(b.definitionId);
      return base && !base.wonder && effectiveDefinition(base, b.level).workersRequired > 0;
    })
    .map((b) => b.id);
}

/** Suroviny, ktoré môže ponúknuť karavána: obchodovateľné, z dostupnej éry, nie plný sklad. */
function caravanResources(state: Readonly<GameState>, data: GameData): ResourceId[] {
  const era = currentEraIndex(state, data);
  const economy = state.city.economy;
  return RESOURCE_IDS.filter(
    (id) =>
      isTradable(data, id) &&
      !UNCAPPED_RESOURCES.has(id) &&
      economy.resources[id] < economy.storageCapacity * 0.7 &&
      data.buildings.some((b) => (b.outputs[id] ?? 0) > 0 && buildingEraIndex(data, b.id) <= era),
  );
}

/** Či udalosť môže teraz nastať. */
export function eventEligible(
  state: Readonly<GameState>,
  data: GameData,
  definition: EventDefinition,
): boolean {
  const eraIndex = data.eras.findIndex((e) => e.id === definition.era);
  if (eraIndex > currentEraIndex(state, data)) return false;
  const required = definition.requiresBuildings;
  if (required && !state.city.buildings.some((b) => required.includes(b.definitionId)))
    return false;
  const effects = [
    ...(definition.effects ?? []),
    ...(definition.choices ?? []).flatMap((c) => c.effects),
  ];
  for (const effect of effects) {
    if (effect.type === 'disable_building' && fireTargets(state, data).length === 0) return false;
    if (effect.type === 'immigrants' && freeHousing(state) < effect.minimum) return false;
    if (effect.type === 'caravan' && caravanResources(state, data).length === 0) return false;
  }
  return true;
}

/** Zmiernenie zlej udalosti (technológia, budova alebo pokrytie službou). */
export function isMitigated(
  state: Readonly<GameState>,
  data: GameData,
  definition: EventDefinition,
): boolean {
  const m = definition.mitigation;
  if (!m) return false;
  if (m.technologies?.some((id) => state.research.completedTechnologyIds.includes(id))) return true;
  if (m.buildings?.some((id) => state.city.buildings.some((b) => b.definitionId === id)))
    return true;
  if (m.services?.length) {
    const analysis = analyzeCity(state, data);
    const minShare = m.minShare ?? 0.5;
    if (m.services.some((type) => serviceCoverage(state, data, analysis, type) >= minShare))
      return true;
  }
  return false;
}

/** Cena voľby (predvolene prvej) v peniazoch. */
function choiceCost(
  state: Readonly<GameState>,
  definition: EventDefinition,
  choiceId?: string,
): number {
  const choice = choiceId
    ? definition.choices?.find((c) => c.id === choiceId)
    : definition.choices?.[0];
  const cost = choice?.cost;
  if (!cost) return 0;
  return Math.max(
    cost.minimum ?? 0,
    Math.round((cost.money ?? 0) + (cost.moneyPerCapita ?? 0) * state.city.population.total),
  );
}

/** Parametre čakajúcej udalosti (cieľová budova, surovina, množstvo, cena). */
function pendingParams(
  state: Readonly<GameState>,
  data: GameData,
  definition: EventDefinition,
): PendingEvent {
  const pending: PendingEvent = { eventId: definition.id, day: state.simulation.day };
  for (const effect of (definition.choices ?? []).flatMap((c) => c.effects)) {
    if (effect.type === 'disable_building') {
      const targets = fireTargets(state, data);
      const target = targets[Math.floor(roll(state, 11) * targets.length)];
      if (target) pending.buildingId = target;
    }
    if (effect.type === 'immigrants') {
      pending.amount = Math.max(
        effect.minimum,
        Math.round(state.city.population.total * effect.share),
      );
    }
    if (effect.type === 'caravan') {
      const options = caravanResources(state, data);
      const resource = options[Math.floor(roll(state, 13) * options.length)]!;
      const amount = Math.floor(state.city.economy.storageCapacity * effect.storageShare);
      pending.resource = resource;
      pending.amount = amount;
      pending.cost = Math.round(amount * buyPrice(data, resource) * effect.priceFactor);
    }
  }
  const cost = choiceCost(state, definition);
  if (cost > 0) pending.cost = cost;
  return pending;
}

/** Použije efekty; `factor` (0–1) zmierňuje záporné efekty. */
function applyEffects(
  state: GameState,
  data: GameData,
  definition: EventDefinition,
  effects: readonly EventEffect[],
  factor: number,
  pending?: PendingEvent,
): void {
  const economy = state.city.economy;
  const population = state.city.population;
  const addActive = (effect: ActiveEventEffect, days: number) =>
    state.events.active.push({ eventId: definition.id, daysLeft: days, effect });
  for (const effect of effects) {
    switch (effect.type) {
      case 'production': {
        const multiplier =
          effect.multiplier < 1 ? 1 - (1 - effect.multiplier) * factor : effect.multiplier;
        addActive({ type: 'production', resource: effect.resource, multiplier }, effect.days);
        break;
      }
      case 'happiness':
        addActive(
          { type: 'happiness', amount: effect.amount < 0 ? effect.amount * factor : effect.amount },
          effect.days,
        );
        break;
      case 'population_loss': {
        const lost = Math.floor(population.total * effect.share * factor);
        population.total = Math.max(data.balance.minimumPopulation, population.total - lost);
        break;
      }
      case 'immigrants':
        population.total += Math.min(pending?.amount ?? effect.minimum, freeHousing(state));
        break;
      case 'resources_share':
        for (const id of RESOURCE_IDS) {
          const share = effect.resources[id] ?? 0;
          if (share > 0) economy.resources[id] += Math.floor(economy.storageCapacity * share);
        }
        break;
      case 'knowledge_days':
        economy.resources.knowledge += Math.max(
          effect.minimum,
          (economy.dailyProduction.knowledge ?? 0) * effect.days,
        );
        break;
      case 'money_days':
        economy.money += Math.max(effect.minimum, economy.dailyIncome * effect.days);
        break;
      case 'disable_building':
        if (pending?.buildingId)
          addActive({ type: 'disable_building', buildingId: pending.buildingId }, effect.days);
        break;
      case 'caravan':
        if (pending?.resource && pending.amount) {
          const room = Math.max(0, economy.storageCapacity - economy.resources[pending.resource]);
          economy.resources[pending.resource] += Math.min(pending.amount, room);
        }
        break;
    }
  }
}

/** RESOLVE_EVENT: zaplatí cenu voľby a použije jej efekty. */
export function resolveEvent(state: GameState, data: GameData, choiceId: string): CommandResult {
  const pending = state.events.pending;
  if (!pending) return fail('no_pending_event');
  const definition = data.events.find((e) => e.id === pending.eventId);
  const choice = definition?.choices?.find((c) => c.id === choiceId);
  if (!definition || !choice) return fail('unknown_choice');
  const isFirst = definition.choices![0]!.id === choiceId;
  const cost = isFirst ? (pending.cost ?? 0) : choiceCost(state, definition, choiceId);
  if (cost > state.city.economy.money) return fail('insufficient_funds');
  state.city.economy.money -= cost;
  applyEffects(state, data, definition, choice.effects, 1, pending);
  state.events.pending = null;
  return { success: true };
}

export function setEventsEnabled(state: GameState, enabled: boolean): CommandResult {
  state.events.enabled = enabled;
  if (!enabled) state.events.pending = null;
  return { success: true };
}

/** Bonus k násobiču výroby z prebiehajúcich udalostí (aditívne ako technológie). */
export function eventProductionBonus(state: Readonly<GameState>, resource: ResourceId): number {
  let bonus = 0;
  for (const event of state.events?.active ?? []) {
    const effect = event.effect;
    if (effect.type === 'production' && (effect.resource === resource || effect.resource === 'all'))
      bonus += effect.multiplier - 1;
  }
  return bonus;
}

export function eventHappiness(state: Readonly<GameState>): number {
  let total = 0;
  for (const event of state.events?.active ?? []) {
    if (event.effect.type === 'happiness') total += event.effect.amount;
  }
  return total;
}

/** Denný krok udalostí: odpočet trvania, vypršanie rozhodnutia, nová udalosť. */
export function advanceEvents(state: GameState, data: GameData): GameEvent[] {
  const out: GameEvent[] = [];
  const events = state.events;

  const before = new Set(events.active.map((e) => e.eventId));
  for (const active of events.active) active.daysLeft -= 1;
  events.active = events.active.filter((e) => e.daysLeft > 0);
  const after = new Set(events.active.map((e) => e.eventId));
  for (const id of before) if (!after.has(id)) out.push({ type: 'event_ended', eventId: id });

  // Nerozhodnutá udalosť sa po čase vyrieši poslednou voľbou (odmietnutie / čakanie).
  const pending = events.pending;
  if (pending && state.simulation.day - pending.day >= data.balance.events.pendingDays) {
    const definition = data.events.find((e) => e.id === pending.eventId);
    const last = definition?.choices?.at(-1);
    if (definition && last) applyEffects(state, data, definition, last.effects, 1, pending);
    events.pending = null;
  }

  if (!events.enabled || events.pending || state.simulation.day < events.nextDay) return out;

  const { minInterval, maxInterval } = data.balance.events;
  events.nextDay =
    state.simulation.day +
    minInterval +
    Math.floor(roll(state, 3) * (maxInterval - minInterval + 1));
  const eligible = data.events.filter((e) => eventEligible(state, data, e));
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight <= 0) return out;
  let pick = roll(state, 7) * totalWeight;
  const definition = eligible.find((e) => (pick -= e.weight) < 0) ?? eligible.at(-1)!;

  if (definition.kind === 'choice') {
    events.pending = pendingParams(state, data, definition);
    out.push({ type: 'event_started', eventId: definition.id, pending: true });
  } else {
    const factor = isMitigated(state, data, definition) ? definition.mitigation!.factor : 1;
    applyEffects(state, data, definition, definition.effects ?? [], factor);
    out.push({ type: 'event_started', eventId: definition.id, pending: false });
  }
  return out;
}
