import { analyzeCity } from '@/engine/economy/analysis';
import { validatePlacement } from '@/engine/core/commands';
import { validateResearch } from '@/engine/research/research';
import type { CivilisEngine } from '@/engine/core/engine';
import type { GameData } from '@/engine/core/definitions';
import { getTile, neighbors4, tileIndex } from '@/engine/world/grid';
import type { GameState, Position, TerrainType } from '@/types';

/**
 * Jednoduchý „hráč“ pre test hrateľnosti (test F). Používa výhradne herné príkazy
 * cez `engine.execute` — žiadne vývojárske skratky ani priame úpravy stavu.
 */
export class Bot {
  readonly log: string[] = [];

  constructor(
    private readonly engine: CivilisEngine,
    private readonly data: GameData,
  ) {}

  private get state(): Readonly<GameState> {
    return this.engine.getState();
  }

  private count(definitionId: string): number {
    return this.state.city.buildings.filter((b) => b.definitionId === definitionId).length;
  }

  private center(): Position {
    return this.state.city.buildings.find((b) => b.definitionId === 'warehouse')!.position;
  }

  /**
   * Plán uličiek: cesty v každom treťom stĺpci a riadku (bloky 2 × 2 na budovy), zarovnané
   * s počiatočnou cestou pod skladom. Vďaka tomu sa sieť dá vždy predĺžiť.
   */
  private isStreet(p: Position): boolean {
    const c = this.center();
    const mod = (n: number) => ((n % 3) + 3) % 3;
    return mod(p.x - (c.x - 2)) === 0 || mod(p.y - (c.y + 1)) === 0;
  }

  private distance(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private canPlace(buildingId: string, position: Position): boolean {
    return validatePlacement(this.state, this.data, buildingId, position).success;
  }

  private place(buildingId: string, position: Position): boolean {
    const ok = this.engine.execute({ type: 'PLACE_BUILDING', buildingId, position }).success;
    if (ok)
      this.log.push(
        `deň ${this.state.simulation.day}: ${buildingId} [${position.x},${position.y}]`,
      );
    return ok;
  }

  private networkRoads(): Set<number> {
    return analyzeCity(this.state, this.data).roadNetwork as Set<number>;
  }

  /** Voľné políčka pre budovu susediace s cestnou sieťou, zoradené od stredu mesta. */
  private roadsideSpots(buildingId: string, network: Set<number>): Position[] {
    const world = this.state.world;
    const spots: Position[] = [];
    const seen = new Set<number>();
    for (const index of network) {
      const road = { x: index % world.width, y: Math.floor(index / world.width) };
      for (const n of neighbors4(world, road)) {
        const i = tileIndex(world, n.x, n.y);
        if (seen.has(i)) continue;
        seen.add(i);
        if ((buildingId === 'road' || !this.isStreet(n)) && this.canPlace(buildingId, n))
          spots.push(n);
      }
    }
    const center = this.center();
    const efficiency = this.data.buildingsById.get(buildingId)!.terrainEfficiency ?? {};
    const score = (p: Position) => efficiency[getTile(world, p.x, p.y)!.terrain] ?? 1;
    return spots.sort(
      (a, b) =>
        score(b) - score(a) ||
        this.distance(a, center) - this.distance(b, center) ||
        a.y - b.y ||
        a.x - b.x,
    );
  }

  /**
   * Predĺži cestnú sieť smerom k najbližšiemu políčku, kde sa dá budova postaviť (BFS po
   * políčkach, kam sa dá položiť cesta). Vráti true, ak niečo postavil.
   */
  private extendRoadToward(
    buildingId: string,
    network: Set<number>,
    terrainFilter: (terrain: TerrainType) => boolean = () => true,
  ): boolean {
    const world = this.state.world;
    const definition = this.data.buildingsById.get(buildingId)!;
    const roadTerrain = this.data.buildingsById.get('road')!.allowedTerrain;
    const previous = new Map<number, number>();
    const queue = [...network];
    const visited = new Set(network);
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head]!;
      const position = { x: index % world.width, y: Math.floor(index / world.width) };
      // Cieľ: voľné políčko bloku s vhodným terénom vedľa budúcej cesty.
      if (!network.has(index)) {
        const target = neighbors4(world, position).find((n) => {
          const tile = getTile(world, n.x, n.y)!;
          return (
            !this.isStreet(n) &&
            !tile.buildingId &&
            definition.allowedTerrain.includes(tile.terrain) &&
            terrainFilter(tile.terrain)
          );
        });
        if (target) return this.buildPath(index, previous, network);
      }
      for (const n of neighbors4(world, position)) {
        const next = tileIndex(world, n.x, n.y);
        if (visited.has(next)) continue;
        visited.add(next);
        const tile = getTile(world, n.x, n.y)!;
        if (!this.isStreet(n) || tile.buildingId || !roadTerrain.includes(tile.terrain)) continue;
        previous.set(next, index);
        queue.push(next);
      }
    }
    return false;
  }

  private buildPath(end: number, previous: Map<number, number>, network: Set<number>): boolean {
    const world = this.state.world;
    const path: number[] = [];
    for (let i: number | undefined = end; i !== undefined && !network.has(i); i = previous.get(i))
      path.push(i);
    if (path.length > this.state.city.economy.resources.stone) return false;
    let built = false;
    for (const index of path.reverse()) {
      built =
        this.place('road', { x: index % world.width, y: Math.floor(index / world.width) }) || built;
    }
    return built;
  }

  /** Postaví budovu pri ceste; ak nie je miesto, predĺži cestu. */
  private build(buildingId: string, priority?: number): boolean {
    const network = this.networkRoads();
    const spot = this.roadsideSpots(buildingId, network)[0];
    const definition = this.data.buildingsById.get(buildingId)!;
    const poor =
      spot &&
      (definition.terrainEfficiency?.[getTile(this.state.world, spot.x, spot.y)!.terrain] ?? 1) < 1;
    // Farma na tráve len ak sa k úrodnej pôde nedá dostať.
    if (
      poor &&
      this.extendRoadToward(
        buildingId,
        network,
        (terrain) => (definition.terrainEfficiency?.[terrain] ?? 1) >= 1,
      )
    ) {
      return true;
    }
    if (!spot) return this.extendRoadToward(buildingId, network);
    const placed = this.place(buildingId, spot);
    if (placed && priority !== undefined) {
      const id = this.state.city.buildings.at(-1)!.id;
      this.engine.execute({ type: 'SET_BUILDING_PRIORITY', instanceId: id, priority });
    }
    return placed;
  }

  private affordable(buildingId: string, reserveStone = 0): boolean {
    const cost = this.data.buildingsById.get(buildingId)!.constructionCost;
    const r = this.state.city.economy.resources;
    return (cost.wood ?? 0) <= r.wood && (cost.stone ?? 0) + reserveStone <= r.stone;
  }

  /** Studňa pri dome mimo dosahu vody (studňa nepotrebuje cestu). */
  private buildWell(): boolean {
    const world = this.state.world;
    const wells = this.state.city.buildings.filter((b) => b.definitionId === 'well');
    const radius = this.data.buildingsById.get('well')!.service!.radius;
    const covered = (p: Position) =>
      wells.some(
        (w) => Math.max(Math.abs(w.position.x - p.x), Math.abs(w.position.y - p.y)) <= radius,
      );
    const house = this.state.city.buildings.find(
      (b) => b.definitionId === 'house' && !covered(b.position),
    );
    if (!house) return false;
    for (let d = 1; d <= 3; d++) {
      for (let dy = -d; dy <= d; dy++) {
        for (let dx = -d; dx <= d; dx++) {
          const p = { x: house.position.x + dx, y: house.position.y + dy };
          if (getTile(world, p.x, p.y) && !this.isStreet(p) && this.canPlace('well', p))
            return this.place('well', p);
        }
      }
    }
    return false;
  }

  private chooseResearch(): void {
    if (this.state.research.activeTechnologyId) return;
    const next = this.data.technologies.find(
      (t) => validateResearch(this.state, this.data, t.id).success,
    );
    if (next) this.engine.execute({ type: 'START_RESEARCH', technologyId: next.id });
  }

  /** Jeden herný deň rozhodovania — najviac jedna stavebná akcia, ako by stihol človek. */
  act(): void {
    this.chooseResearch();
    this.actOnce();
  }

  private actOnce(): boolean {
    const { city } = this.state;
    const { population, economy } = city;
    const analysis = analyzeCity(this.state, this.data);
    const freeWorkers = analysis.workforce - analysis.employedWorkers;
    const balance = (id: 'food' | 'wood' | 'stone') =>
      (economy.dailyProduction[id] ?? 0) - (economy.dailyConsumption[id] ?? 0);
    const r = economy.resources;
    const free = population.housingCapacity - population.total;
    const HIGH = 3;

    // 1. Peniaze: bez nich všetko beží na polovicu. Trhovisko dostane vysokú prioritu,
    //    aby si zobralo pracovníkov aj z iných budov.
    const moneyBalance = economy.dailyIncome - economy.dailyExpenses;
    if (moneyBalance < 1 && economy.money < 300 && this.affordable('market', 2)) {
      if (this.build('market', HIGH)) return true;
    }

    // 2. Drevo je základ všetkého — prvý drevorubač čo najskôr.
    if (this.count('lumberjack') === 0 && this.affordable('lumberjack', 2)) {
      if (this.build('lumberjack', HIGH)) return true;
    }

    // 3. Nástroje, keď zásoba vydrží menej ako 15 dní.
    let toolsNeeded = 0;
    for (const status of analysis.statuses.values()) {
      const building = city.buildings.find((b) => b.id === status.instanceId)!;
      toolsNeeded +=
        status.workersAssigned *
        this.data.buildingsById.get(building.definitionId)!.toolUsePerWorker;
    }
    const toolDeficit = toolsNeeded - (economy.dailyProduction.tools ?? 0);
    if (
      toolDeficit > 0 &&
      r.tools / toolDeficit < 15 &&
      balance('wood') > 2 &&
      this.affordable('workshop', 2)
    ) {
      if (this.build('workshop', HIGH)) return true;
    }

    // 4. Potraviny.
    if (
      (balance('food') < 1 + population.total * 0.03 || r.food < 20) &&
      freeWorkers >= 3 &&
      this.affordable('farm', 2)
    ) {
      if (this.build('farm')) return true;
    }

    // 4. Voda pre všetky domy.
    if (population.happinessFactors.water < 100 && this.affordable('well')) {
      if (this.buildWell()) return true;
    }

    // 5. Bývanie s rezervou nad 10 %.
    if (free < Math.max(3, population.housingCapacity * 0.15) && this.affordable('house', 2)) {
      if (this.build('house')) return true;
    }

    // 6. Sklad, keď sa niečo blíži ku kapacite (rozumný počet).
    const nearlyFull = (['wood', 'stone', 'food'] as const).some(
      (id) => r[id] >= economy.storageCapacity * 0.9,
    );
    if (
      nearlyFull &&
      this.count('warehouse') < 1 + population.total / 60 &&
      this.affordable('warehouse', 2)
    ) {
      if (this.build('warehouse')) return true;
    }

    // 7. Drevo a kameň podľa veľkosti mesta.
    if (
      balance('wood') < 4 + population.total / 25 &&
      freeWorkers >= 3 &&
      this.affordable('lumberjack', 2)
    ) {
      if (this.build('lumberjack')) return true;
    }
    if (
      balance('stone') < 1 + population.total / 60 &&
      freeWorkers >= 3 &&
      this.affordable('quarry', 2)
    ) {
      if (this.build('quarry')) return true;
    }

    // 8. Škola pre vedomosti a vzdelanie.
    const schoolsWanted = population.total >= 20 ? 1 + Math.floor(population.total / 120) : 0;
    if (this.count('school') < schoolsWanted && freeWorkers >= 3 && this.affordable('school', 2)) {
      if (this.build('school')) return true;
    }
    return false;
  }
}

export interface PlaythroughResult {
  completedAt: Record<string, number>;
  days: number;
  state: GameState;
  log: string[];
}

/** Odohrá hru botom, kým nesplní všetky míľniky alebo neuplynie `maxDays`. */
export function playthrough(
  engine: CivilisEngine,
  data: GameData,
  maxDays: number,
): PlaythroughResult {
  const bot = new Bot(engine, data);
  const completedAt: Record<string, number> = {};
  for (let day = 0; day < maxDays; day++) {
    bot.act();
    engine.tick();
    for (const event of engine.takeEvents()) {
      if (event.type === 'milestone_completed')
        completedAt[event.milestoneId] = engine.getState().simulation.day;
    }
    if (Object.keys(completedAt).length === data.milestones.length) break;
  }
  return {
    completedAt,
    days: engine.getState().simulation.day,
    state: engine.serialize(),
    log: bot.log,
  };
}
