import { describe, expect, it } from 'vitest';
import {
  activeLegacies,
  availableLegacies,
  cityRecord,
  colonyLaunchBlock,
  difficultyOf,
  nextPlanet,
} from '@/engine/core/colony';
import { GameDataError, loadGameData, mergeOverride } from '@/engine/core/definitions';
import { createNewGame } from '@/engine/core/newGame';
import { countTerrainNear, getStartCenter } from '@/engine/world/generateWorld';
import { migrateGameState } from '@/persistence/migrations';
import balance from '@/data/balance.json';
import buildings from '@/data/buildings.json';
import eras from '@/data/eras.json';
import milestones from '@/data/milestones.json';
import planets from '@/data/planets.json';
import technologies from '@/data/technologies.json';
import { earthTestData, marsTestData, proximaTestData } from '../helpers/gameData';
import type { GameState } from '@/types';

const newGame = (data = marsTestData, legacyIds: string[] = []) =>
  createNewGame(data, {
    seed: 7,
    gameId: 'g',
    now: 'x',
    colony: { generation: legacyIds.length + 1, legacyIds, originCity: 'Civilis', history: [] },
  });

describe('planéty', () => {
  it('Mars upraví budovy, éry a štart, Zem zostane bez zmeny', () => {
    const farm = marsTestData.buildingsById.get('farm')!;
    expect(farm.name).toBe('Skleník');
    expect(farm.allowedTerrain).toEqual(['grass']);
    // Úrovne sa zlučujú po indexoch — názov sa zmení, čísla zostanú.
    const earthFarm = earthTestData.buildingsById.get('farm')!;
    expect(farm.levels![0]!.name).toBe('Hydroponický skleník');
    expect(farm.levels![0]!.productionMultiplier).toBe(earthFarm.levels![0]!.productionMultiplier);
    expect(earthFarm.name).toBe('Farma');
    expect(marsTestData.eras[0]!.name).toBe('Havarijný tábor');
    expect(marsTestData.balance.startingState.resources.stone).toBe(50);
    expect(marsTestData.balance.startingState.money).toBe(
      earthTestData.balance.startingState.money,
    );
    expect(marsTestData.planet.id).toBe('mars');
    expect(earthTestData.planet.id).toBe('earth');
  });

  it('mapa Marsu nemá úrodnú pôdu, ale má ľad a pri štarte trosky a skaly', () => {
    const state = newGame();
    const terrains = new Set(state.world.tiles.map((t) => t.terrain));
    expect(terrains.has('fertile')).toBe(false);
    expect(terrains.has('water')).toBe(true);
    const center = getStartCenter(state.world);
    expect(countTerrainNear(state.world, center, 10, 'forest')).toBeGreaterThanOrEqual(8);
    expect(countTerrainNear(state.world, center, 10, 'rock')).toBeGreaterThanOrEqual(6);
    expect(state.planet).toBe('mars');
  });

  it('zlúčenie úprav: objekty po kľúčoch, úrovne po indexoch, zoznamy sa nahradia', () => {
    expect(
      mergeOverride(
        { a: 1, list: ['x', 'y'], levels: [{ name: 'A', n: 1 }, { name: 'B' }] },
        { list: ['z'], levels: [{ name: 'C' }] },
      ),
    ).toEqual({ a: 1, list: ['z'], levels: [{ name: 'C', n: 1 }, { name: 'B' }] });
  });

  it('úprava neznámej budovy je chyba dát', () => {
    const broken = structuredClone(planets);
    (broken.planets[1]!.overrides!.buildings as Record<string, unknown>).castle_in_the_air = {
      name: 'X',
    };
    expect(() =>
      loadGameData({ eras, buildings, technologies, milestones, balance, planets: broken }, 'mars'),
    ).toThrow(GameDataError);
  });
});

describe('kolónia a dedičstvo', () => {
  it('dedičstvo pridá štartové suroviny, obyvateľov a peniaze', () => {
    const base = newGame();
    const colony = newGame(marsTestData, ['settlers', 'cargo']);
    expect(colony.city.population.total).toBe(base.city.population.total + 10);
    expect(colony.city.economy.resources.food).toBe(base.city.economy.resources.food + 60);
    expect(colony.city.economy.resources.bricks).toBe(base.city.economy.resources.bricks + 40);
    expect(colony.city.economy.money).toBe(base.city.economy.money + 500);
    expect(activeLegacies(colony, marsTestData).map((l) => l.id)).toEqual(['settlers', 'cargo']);
  });

  it('násobiče dedičstva sa násobia s obtiažnosťou', () => {
    const state = newGame(marsTestData, ['databank', 'engineers']);
    state.difficulty = 'hard';
    const hard = marsTestData.balance.difficulties.hard;
    const factors = difficultyOf(state, marsTestData);
    expect(factors.researchCost).toBeCloseTo(hard.researchCost * 0.8);
    expect(factors.constructionCost).toBeCloseTo(hard.constructionCost * 0.9);
    expect(factors.maintenance).toBe(hard.maintenance);
    expect(availableLegacies(state, marsTestData).map((l) => l.id)).not.toContain('databank');
  });

  it('loď odletí až po dohraní, s vesmírnym prístavom a surovinami', () => {
    const state = createNewGame(earthTestData, { seed: 7, gameId: 'g', now: 'x' });
    expect(colonyLaunchBlock(state, earthTestData)).toBe('not_finished');
    state.achievements.finishedDay = 2500;
    expect(colonyLaunchBlock(state, earthTestData)).toBe('missing_building');
    state.city.buildings.push({
      id: 'sp',
      definitionId: 'space_port',
      position: { x: 0, y: 0 },
      enabled: true,
      priority: 1,
      level: 1,
    });
    expect(colonyLaunchBlock(state, earthTestData)).toBe('resources');
    for (const [resource, amount] of Object.entries(earthTestData.colony!.launchCost)) {
      state.city.economy.resources[resource as keyof typeof state.city.economy.resources] = amount;
    }
    expect(colonyLaunchBlock(state, earthTestData)).toBeNull();
  });

  it('migrácia v9 → v10: staré hry sú prvé mesto na Zemi', () => {
    const state = createNewGame(earthTestData, { seed: 7, gameId: 'g', now: 'x' });
    const old: Partial<GameState> = { ...state, schemaVersion: 9 };
    delete old.planet;
    delete old.colony;
    const migrated = migrateGameState(old) as GameState;
    expect(migrated.planet).toBe('earth');
    expect(migrated.colony).toEqual({
      generation: 1,
      legacyIds: [],
      originCity: null,
      history: [],
    });
  });

  it('sága: Zem → Mars → Proxima b, po poslednom svete sa loď neponúka', () => {
    expect(nextPlanet({ planet: 'earth' }, earthTestData)).toBe('mars');
    expect(nextPlanet({ planet: 'mars' }, marsTestData)).toBe('proxima');
    expect(nextPlanet({ planet: 'proxima' }, proximaTestData)).toBeNull();
    const last = newGame(proximaTestData);
    last.achievements.finishedDay = 900;
    expect(colonyLaunchBlock(last, proximaTestData)).toBe('last_planet');
    expect(cityRecord(last, proximaTestData)).toMatchObject({ planet: 'proxima', days: 900 });
  });

  it('Proxima b má úrodnú pôdu a vlastné názvy, Zem zostane bez zmeny', () => {
    const state = newGame(proximaTestData);
    expect(state.world.tiles.some((t) => t.terrain === 'fertile')).toBe(true);
    expect(proximaTestData.buildingsById.get('farm')!.name).toBe('Hubárska farma');
    expect(proximaTestData.buildingsById.get('farm')!.allowedTerrain).toEqual(
      earthTestData.buildingsById.get('farm')!.allowedTerrain,
    );
  });
});
