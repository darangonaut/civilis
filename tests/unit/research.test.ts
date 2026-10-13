import { describe, expect, it } from 'vitest';
import type { CivilisEngine } from '@/engine/core/engine';
import { createTestCity, setCity } from '../helpers/fixtures';
import { economyTestData } from '../helpers/gameData';

const research = (engine: CivilisEngine) => engine.getState().research;
const knowledge = (engine: CivilisEngine) => engine.getState().city.economy.resources.knowledge;

function expectRejected(engine: CivilisEngine, technologyId: string, reason: string) {
  const before = engine.serialize();
  expect(engine.execute({ type: 'START_RESEARCH', technologyId })).toEqual({
    success: false,
    reason,
  });
  expect(engine.serialize()).toEqual(before);
}

describe('výskum', () => {
  it('postupne spotrebúva vedomosti a po zaplatení ceny aktivuje technológiu', () => {
    const cost = economyTestData.technologiesById.get('woodworking')!.cost;
    const engine = createTestCity({ resources: { knowledge: 6, food: 100 } });
    expect(engine.execute({ type: 'START_RESEARCH', technologyId: 'woodworking' })).toEqual({
      success: true,
    });
    engine.tick();
    expect(research(engine)).toMatchObject({
      activeTechnologyId: 'woodworking',
      investedKnowledge: 6,
    });
    expect(knowledge(engine)).toBe(0);

    setCity(engine, { resources: { knowledge: cost, food: 100 } });
    engine.tick();
    expect(research(engine)).toEqual({
      completedTechnologyIds: ['woodworking'],
      activeTechnologyId: null,
      investedKnowledge: 0,
      queue: [],
    });
    // Investuje sa len zvyšok ceny (cena − 6).
    expect(knowledge(engine)).toBe(6);
    expect(engine.takeEvents()).toContainEqual({
      type: 'research_completed',
      technologyId: 'woodworking',
    });
  });

  it('bez aktívnej technológie sa vedomosti hromadia', () => {
    const engine = createTestCity({ resources: { knowledge: 50 } });
    engine.tick();
    expect(knowledge(engine)).toBe(50);
    expect(research(engine).completedTechnologyIds).toEqual([]);
  });

  it('vyžaduje prerekvizity', () => {
    const engine = createTestCity();
    expectRejected(engine, 'labor_organization', 'prerequisites_missing');
    setCity(engine, { completedTechnologyIds: ['woodworking'] });
    expect(
      engine.execute({ type: 'START_RESEARCH', technologyId: 'labor_organization' }).success,
    ).toBe(true);
  });

  it('odmietne neznámu, dokončenú a už skúmanú technológiu', () => {
    const engine = createTestCity();
    expectRejected(engine, 'alchemy', 'unknown_technology');
    setCity(engine, { completedTechnologyIds: ['woodworking'] });
    expectRejected(engine, 'woodworking', 'technology_completed');
    engine.execute({ type: 'START_RESEARCH', technologyId: 'masonry' });
    expectRejected(engine, 'masonry', 'research_active');
  });

  it('prepnutie výskumu vráti investované vedomosti', () => {
    const engine = createTestCity({ resources: { knowledge: 8 } });
    engine.execute({ type: 'START_RESEARCH', technologyId: 'irrigation' });
    engine.tick();
    expect(research(engine).investedKnowledge).toBe(8);
    engine.execute({ type: 'START_RESEARCH', technologyId: 'masonry' });
    expect(research(engine)).toMatchObject({ activeTechnologyId: 'masonry', investedKnowledge: 0 });
    expect(knowledge(engine)).toBe(8);
  });
});

describe('poradie výskumu', () => {
  it('po dokončení sa automaticky začne ďalšia technológia z poradia', () => {
    const cost = economyTestData.technologiesById.get('woodworking')!.cost;
    const engine = createTestCity({ resources: { knowledge: cost, food: 100 } });
    engine.execute({ type: 'START_RESEARCH', technologyId: 'woodworking' });
    expect(
      engine.execute({
        type: 'SET_RESEARCH_QUEUE',
        technologyIds: ['labor_organization', 'masonry'],
      }),
    ).toEqual({
      success: true,
    });
    engine.tick();
    expect(research(engine).completedTechnologyIds).toContain('woodworking');
    expect(research(engine).activeTechnologyId).toBe('labor_organization');
    expect(research(engine).queue).toEqual(['masonry']);
  });

  it('nečinný výskum sa spustí z poradia v ďalšom dni', () => {
    const engine = createTestCity({ resources: { knowledge: 0, food: 100 } });
    engine.execute({ type: 'SET_RESEARCH_QUEUE', technologyIds: ['irrigation'] });
    engine.tick();
    expect(research(engine)).toMatchObject({ activeTechnologyId: 'irrigation', queue: [] });
  });

  it('odmietne poradie s nesplniteľnými prerekvizitami alebo duplicitami', () => {
    const engine = createTestCity();
    const before = engine.serialize();
    expect(
      engine.execute({ type: 'SET_RESEARCH_QUEUE', technologyIds: ['labor_organization'] }),
    ).toEqual({
      success: false,
      reason: 'prerequisites_missing',
    });
    expect(
      engine.execute({ type: 'SET_RESEARCH_QUEUE', technologyIds: ['masonry', 'masonry'] }),
    ).toEqual({
      success: false,
      reason: 'invalid_queue',
    });
    expect(engine.execute({ type: 'SET_RESEARCH_QUEUE', technologyIds: ['pottery'] })).toEqual({
      success: false,
      reason: 'era_locked',
    });
    expect(engine.serialize()).toEqual(before);
    // Prerekvizita skôr v poradí stačí.
    expect(
      engine.execute({
        type: 'SET_RESEARCH_QUEUE',
        technologyIds: ['woodworking', 'labor_organization'],
      }).success,
    ).toBe(true);
  });

  it('spustenie technológie ju odstráni z poradia', () => {
    const engine = createTestCity();
    engine.execute({ type: 'SET_RESEARCH_QUEUE', technologyIds: ['masonry', 'irrigation'] });
    engine.execute({ type: 'START_RESEARCH', technologyId: 'irrigation' });
    expect(research(engine).queue).toEqual(['masonry']);
  });
});
