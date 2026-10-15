import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createGameEngine } from '@/engine/core/engine';
import { SCHEMA_VERSION } from '@/engine/core/constants';
import { createNewGame } from '@/engine/core/newGame';
import { CivilisDatabase } from '@/persistence/db';
import { SaveError, migrateGameState } from '@/persistence/migrations';
import { SaveService } from '@/persistence/saveService';
import type { GameState } from '@/types';
import { testData } from '../helpers/gameData';

const NOW = '2026-10-13T10:00:00.000Z';
let dbCounter = 0;
let service: SaveService;
let db: CivilisDatabase;

beforeEach(() => {
  db = new CivilisDatabase(`civilis-test-${++dbCounter}`);
  service = new SaveService(testData, db);
});

function playedEngine() {
  const engine = createGameEngine(
    testData,
    createNewGame(testData, { seed: 42, gameId: 'g1', now: NOW }),
  );
  engine.execute({ type: 'START_RESEARCH', technologyId: 'woodworking' });
  for (let i = 0; i < 25; i++) engine.tick();
  return engine;
}

function expectSaveError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SaveError);
    expect((error as SaveError).code).toBe(code);
    return;
  }
  throw new Error('Očakávaná SaveError');
}

describe('ukladanie (test D)', () => {
  it('uloženie → akcie → načítanie vráti pôvodný stav', async () => {
    const engine = playedEngine();
    const saved = engine.serialize();
    await service.save('slot-1', saved, NOW);

    // Ďalšie akcie po uložení.
    const house = engine.getState().city.buildings.find((b) => b.definitionId === 'house')!;
    engine.execute({ type: 'DEMOLISH_BUILDING', instanceId: house.id });
    engine.execute({ type: 'START_RESEARCH', technologyId: 'masonry' });
    for (let i = 0; i < 10; i++) engine.tick();
    expect(engine.getState()).not.toEqual(saved);

    const loaded = await service.load('slot-1');
    expect(loaded).toEqual({ ...saved, lastSavedAt: NOW });
    engine.load(loaded!);
    const state = engine.getState();
    expect(state.city.buildings).toEqual(saved.city.buildings);
    expect(state.city.economy.resources).toEqual(saved.city.economy.resources);
    expect(state.research).toEqual(saved.research);
    expect(state.milestones).toEqual(saved.milestones);
    expect(state.simulation.day).toBe(25);
  });

  it('zoznam pozícií obsahuje súhrn a pozície sú nezávislé', async () => {
    const engine = playedEngine();
    await service.save('slot-1', engine.serialize(), NOW);
    await service.save('autosave', engine.serialize(), NOW);
    const slots = await service.list();
    expect(slots.map((s) => s.id).sort()).toEqual(['autosave', 'slot-1']);
    expect(slots.find((s) => s.id === 'slot-1')).toMatchObject({
      day: 25,
      population: expect.any(Number),
    });
    expect(await service.load('slot-2')).toBeNull();
    await service.remove('slot-1');
    expect(await service.load('slot-1')).toBeNull();
    expect(await service.load('autosave')).not.toBeNull();
  });

  it('neplatný stav sa nezapíše a predchádzajúce uloženie zostane', async () => {
    const engine = playedEngine();
    const good = engine.serialize();
    await service.save('slot-1', good, NOW);

    const broken = structuredClone(good);
    broken.city.economy.resources.wood = -5;
    await expect(service.save('slot-1', broken, '2026-10-14T00:00:00.000Z')).rejects.toBeInstanceOf(
      SaveError,
    );
    expect(await service.load('slot-1')).toEqual({ ...good, lastSavedAt: NOW });
  });

  it('neúspešná transakcia nepoškodí posledný platný save', async () => {
    const engine = playedEngine();
    const good = engine.serialize();
    await service.save('slot-1', good, NOW);
    // Simulované zlyhanie zápisu uprostred transakcie.
    await expect(
      db.transaction('rw', db.saves, async () => {
        await db.saves.put({ ...(await db.saves.get('slot-1'))!, gameState: { corrupted: true } });
        throw new Error('disk full');
      }),
    ).rejects.toThrow('disk full');
    expect(await service.load('slot-1')).toEqual({ ...good, lastSavedAt: NOW });
  });
});

describe('export a import JSON', () => {
  it('export → import vráti rovnaký stav', () => {
    const state = playedEngine().serialize();
    const json = service.exportJson(state, NOW);
    expect(JSON.parse(json)).toMatchObject({ format: 'civilis-save' });
    expect(service.importJson(json)).toEqual(state);
  });

  it('prijme aj holý GameState', () => {
    const state = playedEngine().serialize();
    expect(service.importJson(JSON.stringify(state))).toEqual(state);
  });

  it('odmietne nezmysly so zrozumiteľnou chybou', () => {
    expectSaveError(() => service.importJson('nie je json'), 'invalid_format');
    expectSaveError(() => service.importJson('[1,2,3]'), 'invalid_format');
    expectSaveError(
      () => service.importJson('{"format":"civilis-save","gameState":{"foo":1}}'),
      'invalid_format',
    );
  });

  it('odmietne stav s neznámou budovou', () => {
    const state = playedEngine().serialize();
    state.city.buildings[0]!.definitionId = 'dragon_lair';
    expectSaveError(() => service.importJson(JSON.stringify(state)), 'invalid_state');
  });
});

describe('migrácie', () => {
  const current = () => playedEngine().serialize();

  it('aktuálna verzia prejde bez zmeny', () => {
    const state = current();
    expect(migrateGameState(state)).toEqual(state);
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('novšia verzia skončí zrozumiteľnou chybou', () => {
    expectSaveError(
      () => migrateGameState({ ...current(), schemaVersion: SCHEMA_VERSION + 1 }),
      'newer_version',
    );
  });

  it('chýbajúca migrácia skončí chybou', () => {
    expectSaveError(
      () => migrateGameState({ ...current(), schemaVersion: 1 }, {}, 2),
      'missing_migration',
    );
  });

  it('migrácie sa aplikujú postupne a zvýšia verziu', () => {
    // Simulovaná stará verzia: v1 nemala happinessFactors, v2 premenovala mesto.
    const old = structuredClone(current()) as unknown as Record<string, unknown>;
    const city = old.city as GameState['city'];
    delete (city.population as Partial<GameState['city']['population']>).happinessFactors;
    old.schemaVersion = 1;

    const migrations = {
      1: (raw: Record<string, unknown>) => {
        const c = raw.city as GameState['city'];
        return {
          ...raw,
          city: {
            ...c,
            population: {
              ...c.population,
              happinessFactors: {
                food: 100,
                housing: 0,
                water: 0,
                education: 0,
                leisure: 0,
                goods: 100,
                environment: 100,
              },
            },
          },
        };
      },
      2: (raw: Record<string, unknown>) => ({
        ...raw,
        city: { ...(raw.city as object), name: 'Migrované' },
      }),
    };
    const migrated = migrateGameState(old, migrations, 3);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.city.name).toBe('Migrované');
    expect(migrated.city.population.happinessFactors.food).toBe(100);
  });
});
