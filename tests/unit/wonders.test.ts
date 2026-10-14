import { describe, expect, it } from 'vitest';
import { loadGameData } from '@/engine/core/definitions';
import { createGameEngine } from '@/engine/core/engine';
import { cityScore } from '@/engine/milestones/achievements';
import { maintenanceMultiplier, wonderHappiness } from '@/engine/economy/modifiers';
import achievements from '@/data/achievements.json';
import balance from '@/data/balance.json';
import buildings from '@/data/buildings.json';
import eras from '@/data/eras.json';
import milestones from '@/data/milestones.json';
import technologies from '@/data/technologies.json';
import { createTestCity, setCity } from '../helpers/fixtures';

const data = loadGameData({ eras, buildings, technologies, milestones, achievements, balance });
const wonders = data.buildings.filter((b) => b.wonder);

describe('divy sveta', () => {
  it('šesť divov 2 × 2, každý s technológiou a efektom', () => {
    expect(wonders).toHaveLength(6);
    for (const wonder of wonders) {
      expect(wonder.size).toEqual({ width: 2, height: 2 });
      expect(wonder.requiredTechnologyId, wonder.id).toBeTruthy();
      expect(
        wonder.wonder!.effects.length + (wonder.wonder!.happiness ?? 0),
        wonder.id,
      ).toBeGreaterThan(0);
    }
  });

  it('pyramída sa postaví na 2 × 2 políčka, iba raz, a zníži údržbu', () => {
    const engine = createTestCity({ width: 16, height: 10 });
    setCity(engine, {
      completedTechnologyIds: ['architecture'],
      resources: { wood: 2000, stone: 2000, bricks: 2000, tools: 500 },
      money: 1000,
    });
    // createTestCity používa economyTestData — pyramídu overíme na engine s rovnakými dátami.
    const place = (x: number, y: number) =>
      engine.execute({ type: 'PLACE_BUILDING', buildingId: 'pyramid', position: { x, y } });
    const withoutPyramid = maintenanceMultiplier(engine.getState(), data);
    expect(place(4, 4)).toEqual({ success: true });
    const state = engine.getState();
    const id = state.city.buildings.at(-1)!.id;
    for (const [x, y] of [
      [4, 4],
      [5, 4],
      [4, 5],
      [5, 5],
    ])
      expect(state.world.tiles[y! * state.world.width + x!]!.buildingId).toBe(id);
    expect(place(8, 4)).toEqual({ success: false, reason: 'wonder_built' });
    expect(maintenanceMultiplier(state, data)).toBeCloseTo(withoutPyramid - 0.1);
  });

  it('hrad a štadión pridávajú spokojnosť', () => {
    const engine = createTestCity({ width: 16, height: 10 });
    setCity(engine, {
      completedTechnologyIds: ['theology'],
      resources: { stone: 5000, bricks: 5000, iron: 500, tools: 500 },
    });
    expect(
      engine.execute({ type: 'PLACE_BUILDING', buildingId: 'castle', position: { x: 4, y: 4 } }),
    ).toEqual({ success: true });
    expect(wonderHappiness(engine.getState(), data)).toBe(5);
  });
});

describe('úspechy a skóre', () => {
  it('úspech sa odomkne pri splnení podmienky a pošle udalosť', () => {
    // Testové mesto používa dáta bez úspechov — stav spustíme na skutočných dátach.
    const state = createTestCity({ money: 20_000 }).serialize();
    const real = createGameEngine(data, state);
    real.tick();
    expect(real.getState().achievements.completedIds).toContain('full_treasury');
    expect(real.takeEvents()).toContainEqual({
      type: 'achievement_unlocked',
      achievementId: 'full_treasury',
    });
  });

  it('skóre rastie s obyvateľmi, výskumom a úspechmi', () => {
    const engine = createTestCity({ population: 10 });
    const base = cityScore(engine.getState(), data);
    const state = engine.serialize();
    state.research.completedTechnologyIds.push('woodworking');
    state.achievements.completedIds.push('first_settlers');
    expect(cityScore(state, data)).toBe(base + 20 + 100);
  });
});
