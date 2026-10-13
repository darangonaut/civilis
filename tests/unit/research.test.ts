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
