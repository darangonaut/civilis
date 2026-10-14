import { describe, expect, it } from 'vitest';
import { sellPrice } from '@/engine/economy/trade';
import { build, createTestCity, setCity } from '../helpers/fixtures';
import { economyTestData as gameData } from '../helpers/gameData';

const prices = gameData.balance.trade.prices;

function cityWithMarket() {
  const engine = createTestCity({
    resources: { wood: 300, stone: 300, tools: 50, food: 200 },
    money: 1000,
  });
  build(engine, 'market', { x: 3, y: 4 });
  return engine;
}

describe('obchod', () => {
  it('bez trhoviska sa obchodovať nedá', () => {
    const engine = createTestCity({ resources: { wood: 50 } });
    expect(engine.execute({ type: 'TRADE', resource: 'wood', amount: -10 })).toEqual({
      success: false,
      reason: 'trade_unavailable',
    });
  });

  it('predaj pridá peniaze podľa výkupnej ceny a zníži zásobu', () => {
    const engine = cityWithMarket();
    const before = engine.getState().city.economy;
    const money = before.money;
    const wood = before.resources.wood;
    const price = sellPrice(engine.getState(), gameData, 'wood');
    expect(price).toBeCloseTo(prices.wood! * gameData.balance.trade.sellFactor);
    expect(engine.execute({ type: 'TRADE', resource: 'wood', amount: -100 })).toEqual({
      success: true,
    });
    const after = engine.getState();
    expect(after.city.economy.resources.wood).toBe(wood - 100);
    expect(after.city.economy.money).toBeCloseTo(money + 100 * price);
    expect(after.trade.earned).toBeCloseTo(100 * price);
  });

  it('nákup stojí plnú cenu a neprekročí sklad ani pokladnicu', () => {
    const engine = cityWithMarket();
    const money = engine.getState().city.economy.money;
    expect(engine.execute({ type: 'TRADE', resource: 'tools', amount: 10 })).toEqual({
      success: true,
    });
    expect(engine.getState().city.economy.money).toBeCloseTo(money - 10 * prices.tools!);
    expect(engine.execute({ type: 'TRADE', resource: 'tools', amount: 100_000 })).toMatchObject({
      success: false,
    });
    setCity(engine, { money: 0 });
    expect(engine.execute({ type: 'TRADE', resource: 'food', amount: 1 })).toEqual({
      success: false,
      reason: 'insufficient_funds',
    });
  });

  it('neplatné obchody stav nezmenia', () => {
    const engine = cityWithMarket();
    const before = engine.serialize();
    for (const [resource, amount, reason] of [
      ['wood', 0, 'invalid_amount'],
      ['wood', 1.5, 'invalid_amount'],
      ['knowledge', -1, 'not_tradable'],
      ['wood', -100_000, 'insufficient_resources'],
    ] as const) {
      expect(engine.execute({ type: 'TRADE', resource, amount })).toEqual({
        success: false,
        reason,
      });
    }
    expect(engine.serialize()).toEqual(before);
  });

  it('automatický predaj zníži plný sklad a príjem započíta do dňa', () => {
    const engine = cityWithMarket();
    const capacity = engine.getState().city.economy.storageCapacity;
    setCity(engine, { resources: { wood: capacity } });
    expect(engine.execute({ type: 'SET_AUTO_SELL', resource: 'wood', enabled: true })).toEqual({
      success: true,
    });
    engine.tick();
    const state = engine.getState();
    const target = capacity * gameData.balance.trade.autoSellTo;
    expect(state.city.economy.resources.wood).toBeLessThanOrEqual(target + 10);
    expect(state.trade.earned).toBeGreaterThan(0);
    expect(state.city.economy.dailyIncome).toBeGreaterThan(0);
  });
});

describe('parky a dekorácie', () => {
  it('park v dosahu domov pridá zložku oddych a zvýši cieľovú spokojnosť', () => {
    const engine = createTestCity({ population: 5, resources: { wood: 100, food: 500 } });
    build(engine, 'house', { x: 3, y: 3 });
    engine.tick();
    const without = engine.getState().city.population.happinessFactors;
    expect(without.leisure).toBe(0);
    build(engine, 'park', { x: 4, y: 4 });
    engine.tick();
    expect(engine.getState().city.population.happinessFactors.leisure).toBe(100);
  });
});
