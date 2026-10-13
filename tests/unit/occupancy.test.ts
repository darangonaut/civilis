import { describe, expect, it } from 'vitest';
import { analyzeCity } from '@/engine/economy/analysis';
import { houseOccupancy } from '@/engine/population/occupancy';
import { build, createTestCity, setCity } from '../helpers/fixtures';
import { economyTestData as testData } from '../helpers/gameData';

describe('obsadenosť domov (pre svetlá v oknách)', () => {
  it('ľudia sa sťahujú od najstaršieho domu, prázdne domy ostanú tmavé', () => {
    const engine = createTestCity({ population: 15 });
    const a = build(engine, 'house', { x: 3, y: 3 });
    const b = build(engine, 'house', { x: 4, y: 3 });
    const c = build(engine, 'house', { x: 5, y: 3 });
    const isolated = build(engine, 'house', { x: 5, y: 6 });
    setCity(engine, { population: 15 });
    const state = engine.getState();
    const occupancy = houseOccupancy(state, testData, analyzeCity(state, testData));
    expect(occupancy.get(a)).toBe(1);
    expect(occupancy.get(b)).toBe(0.5);
    expect(occupancy.get(c)).toBe(0);
    // Nepripojený dom nemá obyvateľov.
    expect(occupancy.has(isolated)).toBe(false);
  });
});
