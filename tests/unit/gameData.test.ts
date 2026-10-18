import { describe, expect, it } from 'vitest';
import { GameDataError, loadGameData, type RawGameData } from '@/engine/core/definitions';
import balance from '@/data/balance.json';
import buildings from '@/data/buildings.json';
import eras from '@/data/eras.json';
import milestones from '@/data/milestones.json';
import technologies from '@/data/technologies.json';
import { zeroResources } from '../helpers/fixtures';

const validRaw = (): RawGameData =>
  structuredClone({ eras, buildings, technologies, milestones, balance });

function expectIssue(raw: RawGameData, pattern: RegExp) {
  try {
    loadGameData(raw);
  } catch (error) {
    expect(error).toBeInstanceOf(GameDataError);
    expect((error as GameDataError).issues.some((issue) => pattern.test(issue))).toBe(true);
    return;
  }
  throw new Error('loadGameData mal vyhodiť GameDataError');
}

describe('herné dáta', () => {
  it('súbory v src/data prejdú validáciou', () => {
    const data = loadGameData(validRaw());
    expect(data.eras.map((e) => e.id)).toEqual([
      'settlement',
      'antiquity',
      'middle_ages',
      'renaissance',
      'industrial',
      'modern',
      'information',
      'future',
    ]);
    // Prvá éra: 10 budov a 5 míľnikov zo špecifikácie, 6 technológií zo špecifikácie + 2 voliteľné.
    const specTechs = [
      'woodworking',
      'irrigation',
      'masonry',
      'labor_organization',
      'education',
      'city_administration',
    ];
    for (const id of specTechs) expect(data.technologiesById.get(id)?.era).toBe('settlement');
    expect(data.technologies.filter((t) => t.era === 'settlement').length).toBeGreaterThanOrEqual(
      6,
    );
    expect(data.milestones.filter((m) => m.era === 'settlement')).toHaveLength(5);
    expect(data.buildings.filter((b) => !b.requiredTechnologyId)).toHaveLength(12);
  });

  it('zodpovedajú katalógu budov zo špecifikácie', () => {
    const data = loadGameData(validRaw());
    const b = (id: string) => data.buildingsById.get(id)!;
    expect(b('house').constructionCost).toEqual({ wood: 10 });
    expect(b('house').housingCapacity).toBe(10);
    expect(b('road').constructionCost).toEqual({ stone: 1 });
    expect(b('lumberjack').outputs).toEqual({ wood: 6 });
    expect(b('farm').outputs).toEqual({ food: 8 });
    expect(b('quarry').outputs).toEqual({ stone: 4 });
    expect(b('well').constructionCost).toEqual({ wood: 10, stone: 5 });
    expect(b('warehouse').storageCapacity).toBe(200);
    expect(b('workshop').inputs).toEqual({ wood: 2, stone: 1 });
    expect(b('workshop').outputs).toEqual({ tools: 2 });
    expect(b('school').outputs).toEqual({ knowledge: 3 });
    expect(b('market').inputs).toEqual({ food: 2 });
    expect(b('market').moneyOutput).toBe(8);
    expect(b('road').requiresRoad).toBe(false);
    expect(b('well').requiresRoad).toBe(false);
    for (const building of data.buildings) {
      // Divy sveta sú rozšírenie 2 × 2, ostatné budovy majú jedno políčko.
      expect(building.size).toEqual(
        building.wonder ? { width: 2, height: 2 } : { width: 1, height: 1 },
      );
      // Výnimky: cesty, studne, akvadukt a dekorácie (fungujú bez napojenia).
      if (
        !['road', 'bridge', 'well', 'aqueduct'].includes(building.id) &&
        building.category !== 'decoration' &&
        !building.wonder
      )
        expect(building.requiresRoad).toBe(true);
    }
  });

  it('zodpovedajú počiatočnému stavu zo špecifikácie', () => {
    const { startingState } = loadGameData(validRaw()).balance;
    expect(startingState).toEqual({
      population: 10,
      resources: { ...zeroResources(), food: 100, wood: 80, stone: 30, tools: 10 },
      money: 500,
      happiness: 70,
    });
  });

  it('odmietne zápornú cenu', () => {
    const raw = validRaw();
    (raw.buildings as { constructionCost: { wood: number } }[])[0]!.constructionCost.wood = -5;
    expectIssue(raw, /buildings\[0\.constructionCost\.wood\]/);
  });

  it('odmietne neznámu surovinu', () => {
    const raw = validRaw();
    (raw.buildings as { outputs: Record<string, number> }[])[0]!.outputs.gold = 1;
    expectIssue(raw, /buildings\[0\.outputs\]/);
  });

  it('odmietne duplicitné ID budovy', () => {
    const raw = validRaw();
    const list = raw.buildings as { id: string }[];
    list[1]!.id = list[0]!.id;
    expectIssue(raw, /duplicitné ID "house"/);
  });

  it('odmietne neznámu prerekvizitu technológie', () => {
    const raw = validRaw();
    (raw.technologies as { prerequisites: string[] }[])[0]!.prerequisites = ['alchemy'];
    expectIssue(raw, /neznáma prerekvizita "alchemy"/);
  });

  it('odmietne cyklus v technologickom strome', () => {
    const raw = validRaw();
    const techs = raw.technologies as { id: string; prerequisites: string[] }[];
    techs.find((t) => t.id === 'woodworking')!.prerequisites = ['city_administration'];
    expectIssue(raw, /cyklus v prerekvizitách/);
  });

  it('odmietne míľnik s neznámou budovou', () => {
    const raw = validRaw();
    const list = raw.milestones as { conditions: { buildingId?: string }[] }[];
    list[0]!.conditions[1]!.buildingId = 'dragon_lair';
    expectIssue(raw, /neznáma budova "dragon_lair"/);
  });

  it('odmietne neznámy typ podmienky míľnika', () => {
    const raw = validRaw();
    (raw.milestones as { conditions: unknown[] }[])[0]!.conditions.push({ type: 'army_size' });
    expectIssue(raw, /milestones\[0\.conditions\.3/);
  });

  it('odmietne váhy spokojnosti so súčtom rôznym od 1', () => {
    const raw = validRaw();
    (raw.balance as { happinessWeights: { food: number } }).happinessWeights.food = 0.5;
    expectIssue(raw, /súčet 1/);
  });
});
