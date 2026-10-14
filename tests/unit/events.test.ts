import { describe, expect, it } from 'vitest';
import { loadGameData } from '@/engine/core/definitions';
import { createGameEngine, type CivilisEngine } from '@/engine/core/engine';
import achievements from '@/data/achievements.json';
import balance from '@/data/balance.json';
import buildings from '@/data/buildings.json';
import eras from '@/data/eras.json';
import events from '@/data/events.json';
import milestones from '@/data/milestones.json';
import technologies from '@/data/technologies.json';
import type { GameState } from '@/types';
import { build, createTestCity } from '../helpers/fixtures';

const data = loadGameData({
  eras,
  buildings,
  technologies,
  milestones,
  achievements,
  events,
  balance,
});

/** Testové mesto (sklad, cesta) s farmou a trhom, na skutočných dátach s udalosťami. */
function city(setup?: (state: GameState) => void): CivilisEngine {
  const base = createTestCity({
    population: 20,
    resources: { wood: 200, stone: 100, food: 500 },
    money: 5000,
  });
  build(base, 'house', { x: 3, y: 3 });
  build(base, 'house', { x: 4, y: 3 });
  build(base, 'farm', { x: 5, y: 3 });
  const state = base.serialize();
  state.events = { enabled: true, nextDay: 0, active: [], pending: null };
  setup?.(state);
  return createGameEngine(data, state);
}

/** Vynúti konkrétnu udalosť: ostatné z dát vyradíme. */
function only(eventId: string) {
  return loadGameData({
    eras,
    buildings,
    technologies,
    milestones,
    achievements,
    balance,
    events: events.filter((e) => e.id === eventId),
  });
}

describe('náhodné udalosti', () => {
  it('sú deterministické — rovnaký seed a deň dajú rovnakú udalosť', () => {
    const a = city();
    const b = city();
    a.tick();
    b.tick();
    expect(a.getState().events).toEqual(b.getState().events);
    expect(a.getState().events.nextDay).toBeGreaterThanOrEqual(balance.events.minInterval);
  });

  it('vypnuté udalosti nenastanú', () => {
    const engine = city((s) => (s.events.enabled = false));
    for (let i = 0; i < 200; i++) engine.tick();
    expect(engine.getState().events.active).toEqual([]);
    expect(engine.getState().events.pending).toBeNull();
  });

  it('sucho zníži výrobu potravín, zavlažovanie ho zmierni', () => {
    const run = (techs: string[]) => {
      const state = city().serialize();
      state.research.completedTechnologyIds = techs;
      const engine = createGameEngine(only('drought'), state);
      engine.tick();
      return engine.getState().events.active.find((e) => e.eventId === 'drought')!.effect;
    };
    expect(run([])).toEqual({ type: 'production', resource: 'food', multiplier: 0.6 });
    expect(run(['irrigation'])).toMatchObject({ multiplier: 0.8 });
  });

  it('požiar: čakanie budovu zastaví, oprava stojí peniaze', () => {
    const fire = only('fire');
    const waiting = createGameEngine(fire, city().serialize());
    waiting.tick();
    const pending = waiting.getState().events.pending!;
    expect(pending.eventId).toBe('fire');
    expect(waiting.execute({ type: 'RESOLVE_EVENT', choiceId: 'wait' })).toEqual({ success: true });
    waiting.tick();
    const statuses = waiting.getState().events.active;
    expect(statuses).toContainEqual(
      expect.objectContaining({
        effect: { type: 'disable_building', buildingId: pending.buildingId },
      }),
    );

    const repairing = createGameEngine(fire, city().serialize());
    repairing.tick();
    const money = repairing.getState().city.economy.money;
    const cost = repairing.getState().events.pending!.cost!;
    expect(repairing.execute({ type: 'RESOLVE_EVENT', choiceId: 'repair' })).toEqual({
      success: true,
    });
    expect(repairing.getState().city.economy.money).toBe(money - cost);
    expect(repairing.getState().events.active).toEqual([]);
  });

  it('nerozhodnutá udalosť sa po čase vyrieši poslednou voľbou', () => {
    const engine = createGameEngine(
      only('festival'),
      city((s) =>
        s.milestones.completedIds.push(
          ...data.milestones.filter((m) => m.era === 'settlement').map((m) => m.id),
        ),
      ).serialize(),
    );
    engine.tick();
    expect(engine.getState().events.pending?.eventId).toBe('festival');
    for (let i = 0; i < balance.events.pendingDays + 1; i++) engine.tick();
    expect(engine.getState().events.pending).toBeNull();
    expect(engine.getState().events.active).toEqual([]);
  });

  it('neplatné rozhodnutie stav nezmení', () => {
    const engine = city((s) => (s.events.enabled = false));
    expect(engine.execute({ type: 'RESOLVE_EVENT', choiceId: 'accept' })).toEqual({
      success: false,
      reason: 'no_pending_event',
    });
  });
});
