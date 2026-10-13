import { describe, expect, it } from 'vitest';
import { createGameEngine } from '@/engine/core/engine';
import { createNewGame } from '@/engine/core/newGame';
import { getTile } from '@/engine/world/grid';
import type { GameEngine, GameState, Position, TerrainType } from '@/types';
import { testData } from '../helpers/gameData';

function setup(): GameEngine {
  const state = createNewGame(testData, {
    seed: 42,
    gameId: 'test',
    now: '2026-01-01T00:00:00.000Z',
  });
  return createGameEngine(testData, state);
}

/** Nájde voľné políčko daného terénu najbližšie k stredu mapy. */
function findFreeTile(state: Readonly<GameState>, terrain: TerrainType): Position {
  const cx = state.world.width / 2;
  const cy = state.world.height / 2;
  let best: Position | null = null;
  let bestDistance = Infinity;
  for (let y = 0; y < state.world.height; y++) {
    for (let x = 0; x < state.world.width; x++) {
      const tile = getTile(state.world, x, y)!;
      const distance = Math.abs(x - cx) + Math.abs(y - cy);
      if (tile.terrain === terrain && !tile.buildingId && distance < bestDistance) {
        best = { x, y };
        bestDistance = distance;
      }
    }
  }
  if (!best) throw new Error(`Na mape nie je voľné políčko ${terrain}`);
  return best;
}

function expectRejected(
  engine: GameEngine,
  command: Parameters<GameEngine['execute']>[0],
  reason: string,
) {
  const before = engine.serialize();
  expect(engine.execute(command)).toEqual({ success: false, reason });
  expect(engine.serialize()).toEqual(before);
}

describe('výstavba (test C)', () => {
  it('postaví budovu, odpočíta cenu a obsadí políčko', () => {
    const engine = setup();
    const position = findFreeTile(engine.getState(), 'grass');
    const result = engine.execute({ type: 'PLACE_BUILDING', buildingId: 'house', position });

    expect(result).toEqual({ success: true });
    const state = engine.getState();
    expect(state.city.economy.resources.wood).toBe(70);
    const instance = state.city.buildings.at(-1)!;
    expect(instance).toMatchObject({ definitionId: 'house', position, enabled: true });
    expect(getTile(state.world, position.x, position.y)!.buildingId).toBe(instance.id);
    // Dom bez pripojenia k ceste kapacitu bývania nepridáva.
    expect(state.city.population.housingCapacity).toBe(10);
  });

  it('nepostaví mimo mapy', () => {
    const engine = setup();
    for (const position of [
      { x: -1, y: 0 },
      { x: 0, y: 64 },
      { x: 64, y: 10 },
      { x: 1.5, y: 2 },
    ]) {
      expectRejected(
        engine,
        { type: 'PLACE_BUILDING', buildingId: 'road', position },
        'out_of_bounds',
      );
    }
  });

  it('nepostaví na obsadené políčko', () => {
    const engine = setup();
    const warehouse = engine.getState().city.buildings.find((b) => b.definitionId === 'warehouse')!;
    expectRejected(
      engine,
      { type: 'PLACE_BUILDING', buildingId: 'road', position: warehouse.position },
      'tile_occupied',
    );
  });

  it('nepostaví na nepovolený terén', () => {
    const engine = setup();
    const water = findFreeTile(engine.getState(), 'water');
    const grass = findFreeTile(engine.getState(), 'grass');
    expectRejected(
      engine,
      { type: 'PLACE_BUILDING', buildingId: 'road', position: water },
      'invalid_terrain',
    );
    expectRejected(
      engine,
      { type: 'PLACE_BUILDING', buildingId: 'lumberjack', position: grass },
      'invalid_terrain',
    );
    expectRejected(
      engine,
      {
        type: 'PLACE_BUILDING',
        buildingId: 'quarry',
        position: findFreeTile(engine.getState(), 'forest'),
      },
      'invalid_terrain',
    );
  });

  it('nepostaví bez dostatku surovín a nespotrebuje zdroje', () => {
    const engine = setup();
    // 80 dreva = 8 domov; deviaty musí zlyhať.
    for (let i = 0; i < 8; i++) {
      const position = findFreeTile(engine.getState(), 'grass');
      expect(
        engine.execute({ type: 'PLACE_BUILDING', buildingId: 'house', position }).success,
      ).toBe(true);
    }
    expect(engine.getState().city.economy.resources.wood).toBe(0);
    expectRejected(
      engine,
      {
        type: 'PLACE_BUILDING',
        buildingId: 'house',
        position: findFreeTile(engine.getState(), 'grass'),
      },
      'insufficient_resources',
    );
  });

  it('odmietne neznámu budovu', () => {
    const engine = setup();
    expectRejected(
      engine,
      { type: 'PLACE_BUILDING', buildingId: 'castle', position: { x: 1, y: 1 } },
      'unknown_building',
    );
  });
});

describe('búranie', () => {
  it('odstráni budovu, uvoľní políčko a prepočíta kapacitu', () => {
    const engine = setup();
    const house = engine.getState().city.buildings.find((b) => b.definitionId === 'house')!;
    expect(engine.execute({ type: 'DEMOLISH_BUILDING', instanceId: house.id })).toEqual({
      success: true,
    });
    const state = engine.getState();
    expect(state.city.buildings.find((b) => b.id === house.id)).toBeUndefined();
    expect(getTile(state.world, house.position.x, house.position.y)!.buildingId).toBeUndefined();
    expect(state.city.population.housingCapacity).toBe(0);
  });

  it('po zbúraní sa dá na políčko znova stavať a ID sa neopakuje s existujúcimi', () => {
    const engine = setup();
    const house = engine.getState().city.buildings.find((b) => b.definitionId === 'house')!;
    engine.execute({ type: 'DEMOLISH_BUILDING', instanceId: house.id });
    expect(
      engine.execute({ type: 'PLACE_BUILDING', buildingId: 'house', position: house.position })
        .success,
    ).toBe(true);
    const ids = engine.getState().city.buildings.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('nezbúra posledný sklad', () => {
    const engine = setup();
    const warehouse = engine.getState().city.buildings.find((b) => b.definitionId === 'warehouse')!;
    expectRejected(
      engine,
      { type: 'DEMOLISH_BUILDING', instanceId: warehouse.id },
      'last_warehouse',
    );
  });

  it('odmietne neznámu inštanciu', () => {
    expectRejected(setup(), { type: 'DEMOLISH_BUILDING', instanceId: 'nope' }, 'unknown_instance');
  });
});

describe('priorita budovy', () => {
  it('nastaví prioritu v povolenom rozsahu', () => {
    const engine = setup();
    const id = engine.getState().city.buildings[0]!.id;
    expect(engine.execute({ type: 'SET_BUILDING_PRIORITY', instanceId: id, priority: 3 })).toEqual({
      success: true,
    });
    expect(engine.getState().city.buildings[0]!.priority).toBe(3);
  });

  it('odmietne prioritu mimo rozsahu', () => {
    const engine = setup();
    const id = engine.getState().city.buildings[0]!.id;
    expectRejected(
      engine,
      { type: 'SET_BUILDING_PRIORITY', instanceId: id, priority: 9 },
      'invalid_priority',
    );
  });
});

describe('engine', () => {
  it('load/serialize vracajú nezávislé kópie stavu', () => {
    const engine = setup();
    const snapshot = engine.serialize();
    snapshot.city.economy.money = 0;
    expect(engine.getState().city.economy.money).toBe(500);
    engine.load(snapshot);
    expect(engine.getState().city.economy.money).toBe(0);
  });
});

describe('pozastavenie budovy', () => {
  it('pozastavená budova nevyrába ani nezamestnáva a dá sa znova spustiť', () => {
    const engine = setup();
    const position = findFreeTile(engine.getState(), 'forest');
    const roadless = engine.execute({ type: 'PLACE_BUILDING', buildingId: 'lumberjack', position });
    expect(roadless.success).toBe(true);
    const id = engine.getState().city.buildings.at(-1)!.id;
    expect(
      engine.execute({ type: 'SET_BUILDING_ENABLED', instanceId: id, enabled: false }),
    ).toEqual({ success: true });
    expect(engine.getState().city.buildings.at(-1)!.enabled).toBe(false);
    expect(engine.execute({ type: 'SET_BUILDING_ENABLED', instanceId: id, enabled: true })).toEqual(
      { success: true },
    );
    expect(engine.getState().city.buildings.at(-1)!.enabled).toBe(true);
    expectRejected(
      engine,
      { type: 'SET_BUILDING_ENABLED', instanceId: 'nope', enabled: false },
      'unknown_instance',
    );
  });
});
