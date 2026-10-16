import { analyzeCity } from '@/engine/economy/analysis';
import { validatePlacement } from '@/engine/core/commands';
import { upgradableBuildings, upgradeRequirements } from '@/engine/core/upgrade';
import { nextLevel } from '@/engine/core/levels';
import { currentMilestone } from '@/engine/milestones/milestones';
import { computeRoadNetwork } from '@/engine/world/connectivity';
import { serviceCoverage, serviceCoverageGrid } from '@/engine/population/population';
import { validateResearch } from '@/engine/research/research';
import type { CivilisEngine } from '@/engine/core/engine';
import type { GameData } from '@/engine/core/definitions';
import { getTile, neighbors4, tileIndex } from '@/engine/world/grid';
import {
  RESOURCE_IDS,
  type GameState,
  type Position,
  type ResourceId,
  type ServiceType,
  type TerrainType,
} from '@/types';

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

  private counts = { length: -1, byId: new Map<string, number>() };

  /** Počet budov daného typu (cache, kým sa nezmení počet budov v meste). */
  private count(definitionId: string): number {
    const buildings = this.state.city.buildings;
    if (this.counts.length !== buildings.length) {
      const byId = new Map<string, number>();
      for (const b of buildings) byId.set(b.definitionId, (byId.get(b.definitionId) ?? 0) + 1);
      this.counts = { length: buildings.length, byId };
    }
    return this.counts.byId.get(definitionId) ?? 0;
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
    return computeRoadNetwork(this.state, this.data);
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
    // Neúspešné hľadanie miesta je drahé — rovnakú budovu chvíľu neskúšať znova.
    const day = this.state.simulation.day;
    if ((this.failedUntil.get(buildingId) ?? -1) > day) return false;
    const built = this.tryBuild(buildingId, priority);
    // Domy sú pre rast kľúčové — tie sa skúšajú vždy.
    if (!built && buildingId !== 'house') this.failedUntil.set(buildingId, day + 20);
    return built;
  }

  private failedUntil = new Map<string, number>();

  private tryBuild(buildingId: string, priority?: number): boolean {
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
    const definition = this.data.buildingsById.get(buildingId)!;
    if (
      definition.requiredTechnologyId &&
      !this.state.research.completedTechnologyIds.includes(definition.requiredTechnologyId)
    ) {
      return false;
    }
    const r = this.state.city.economy.resources;
    return RESOURCE_IDS.every(
      (id) => (definition.constructionCost[id] ?? 0) + (id === 'stone' ? reserveStone : 0) <= r[id],
    );
  }

  /**
   * Postaví budovu služby pri dome, ktorý nie je v jej dosahu: najprv pri ceste v dosahu
   * domu, inak (služby bez cesty) na ľubovoľné voľné políčko bloku.
   */
  private buildServiceNear(buildingId: string): boolean {
    const key = `near:${buildingId}`;
    const day = this.state.simulation.day;
    if ((this.failedUntil.get(key) ?? -1) > day) return false;
    const built = this.tryBuildServiceNear(buildingId);
    if (!built) this.failedUntil.set(key, day + 10);
    return built;
  }

  private tryBuildServiceNear(buildingId: string): boolean {
    const definition = this.data.buildingsById.get(buildingId)!;
    const service = definition.service!;
    const analysis = analyzeCity(this.state, this.data);
    const grid = serviceCoverageGrid(this.state, this.data, analysis, service.type);
    const world = this.state.world;
    const network = this.networkRoads();
    const roadside = new Set(
      this.roadsideSpots(buildingId, network).map((p) => tileIndex(world, p.x, p.y)),
    );
    const houses = this.state.city.buildings.filter(
      (b) => b.definitionId === 'house' && grid[tileIndex(world, b.position.x, b.position.y)] !== 1,
    );
    for (const house of houses) {
      for (let d = 1; d < service.radius; d++) {
        for (let dy = -d; dy <= d; dy++) {
          for (let dx = -d; dx <= d; dx++) {
            const p = { x: house.position.x + dx, y: house.position.y + dy };
            if (!getTile(world, p.x, p.y) || this.isStreet(p) || !this.canPlace(buildingId, p))
              continue;
            if (definition.requiresRoad && !roadside.has(tileIndex(world, p.x, p.y))) continue;
            return this.place(buildingId, p);
          }
        }
      }
    }
    return false;
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
    const uncovered = this.state.city.buildings.filter(
      (b) => b.definitionId === 'house' && !covered(b.position),
    );
    for (const house of uncovered) {
      for (let d = 1; d <= radius; d++) {
        for (let dy = -d; dy <= d; dy++) {
          for (let dx = -d; dx <= d; dx++) {
            const p = { x: house.position.x + dx, y: house.position.y + dy };
            if (getTile(world, p.x, p.y) && !this.isStreet(p) && this.canPlace('well', p))
              return this.place('well', p);
          }
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

  /**
   * Jeden herný deň rozhodovania — najviac dve stavebné akcie (človek s ťahaním stihne
   * za 2 sekundy hry aj viac).
   */
  act(): void {
    this.chooseResearch();
    for (let i = 0; i < 2; i++) if (!this.actOnce()) break;
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

    // 2b. Dielne pozastaviť, keď je nástrojov dosť (žerú drevo a kameň), spustiť, keď dochádzajú.
    for (const workshop of city.buildings.filter((b) => b.definitionId === 'workshop')) {
      const enable = r.tools < 15 ? true : r.tools > 40 ? false : workshop.enabled;
      if (enable !== workshop.enabled) {
        this.engine.execute({
          type: 'SET_BUILDING_ENABLED',
          instanceId: workshop.id,
          enabled: enable,
        });
      }
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
    const workshopsIdle = city.buildings.some((b) => b.definitionId === 'workshop' && !b.enabled);
    if (
      !workshopsIdle &&
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

    // 0. Budovy chýbajúce k aktuálnemu míľniku majú prednosť; kým nie sú postavené,
    //    šetríme suroviny (žiadne vylepšenia domov).
    const goal = currentMilestone(this.state, this.data);
    const missing = (goal?.conditions ?? []).flatMap((c) =>
      c.type === 'building_count' && this.count(c.buildingId) < c.minimum ? [c.buildingId] : [],
    );
    for (const id of missing) {
      const definition = this.data.buildingsById.get(id)!;
      if (!this.affordable(id) || freeWorkers < definition.workersRequired) continue;
      if (definition.service ? this.buildServiceNear(id) || this.build(id) : this.build(id))
        return true;
    }
    const saving = missing.some((id) => !this.affordable(id));

    // 5a. Vylepšenie budovy, ak to ide (domy dávajú viac bývania, míľniky ich vyžadujú).
    const upgradable = saving
      ? new Set<string>()
      : upgradableBuildings(this.state, this.data, analysis);
    // Domy a sklady prednostne; výrobné budovy len pri veľkom prebytku surovín
    // (inak by vylepšovanie polí minulo tehly a železo potrebné na míľniky).
    const plentiful = (b: (typeof city.buildings)[number]) => {
      const next = nextLevel(this.data.buildingsById.get(b.definitionId)!, b.level);
      return (
        next !== undefined && RESOURCE_IDS.every((id) => (next.upgradeCost[id] ?? 0) * 5 <= r[id])
      );
    };
    // Najvyššie úrovne prednostne — míľniky chcú domy vyššej úrovne.
    const houses = city.buildings
      .filter((b) => upgradable.has(b.id) && b.definitionId === 'house')
      .sort((a, b) => b.level - a.level);
    // Míľnik chce domy úrovne L a dom na L − 1 čaká už len na suroviny: šetriť
    // (inak by lacnejšie vylepšenia minuli železo potrebné na L).
    const levelGoal = currentMilestone(this.state, this.data)?.conditions.find(
      (c) => c.type === 'building_level' && c.buildingId === 'house',
    ) as { level: number; minimum: number } | undefined;
    const savingForGoal =
      levelGoal !== undefined &&
      !houses.some((b) => b.level === levelGoal.level - 1) &&
      city.buildings.some((b) => {
        if (b.definitionId !== 'house' || b.level !== levelGoal.level - 1) return false;
        const req = upgradeRequirements(this.state, this.data, b, analysis);
        return (
          req !== null && req.technologyMet && req.services.every((sv) => sv.met) && !req.affordable
        );
      });
    const toUpgrade =
      (savingForGoal ? undefined : houses[0]) ??
      city.buildings.find((b) => upgradable.has(b.id) && b.definitionId === 'warehouse');
    if (toUpgrade && r.stone > 10) {
      if (this.engine.execute({ type: 'UPGRADE_BUILDING', instanceId: toUpgrade.id }).success) {
        this.log.push(`deň ${this.state.simulation.day}: vylepšenie ${toUpgrade.definitionId}`);
        return true;
      }
    }

    // 5. Bývanie s rezervou nad 10 %.
    if (free < Math.max(3, population.housingCapacity * 0.15) && this.affordable('house', 2)) {
      // Ako hráč, ktorý ťahaním postaví celý blok: až 5 domov v jednej akcii.
      let built = 0;
      while (built < 5 && this.affordable('house', 2) && this.build('house')) built++;
      if (built > 0) return true;
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
      // Plný sklad dreva netreba ďalej rozširovať (inak by drevorubači zobrali pracovníkov).
      r.wood < economy.storageCapacity * 0.5 &&
      freeWorkers >= 3 &&
      this.affordable('lumberjack', 2)
    ) {
      if (this.build('lumberjack')) return true;
    }
    if (
      balance('stone') < 1 + population.total / 60 &&
      r.stone < economy.storageCapacity * 0.5 &&
      freeWorkers >= 3 &&
      this.affordable('quarry', 2)
    ) {
      if (this.build('quarry')) return true;
    }

    // 7b. Parky a dekorácie pri domoch (bonus k spokojnosti, čistia znečistenie) —
    // najväčší dosah z odomknutých, keď je v dosahu oddychu menej ako 60 % bývania.
    if (
      city.buildings.length > 30 &&
      serviceCoverage(this.state, this.data, analysis, 'leisure') < 0.6
    ) {
      const decoration = ['botanical_garden', 'statue', 'plaza', 'fountain', 'park'].find((id) =>
        this.affordable(id, 2),
      );
      if (decoration && this.buildServiceNear(decoration)) return true;
    }

    // 8. Škola pre vedomosti a vzdelanie (aj pri domoch mimo dosahu — meštianske domy ju potrebujú).
    const schoolsWanted = population.total >= 20 ? 1 + Math.floor(population.total / 120) : 0;
    if (this.count('school') < schoolsWanted && freeWorkers >= 3 && this.affordable('school', 2)) {
      if (this.build('school')) return true;
    }
    if (
      population.happinessFactors.education < 90 &&
      population.total >= 60 &&
      freeWorkers >= 3 &&
      this.affordable('school', 2)
    ) {
      if (this.buildServiceNear('school')) return true;
    }

    // --- Starovek ---
    const need = (id: 'bricks' | 'iron' | 'tools') =>
      (economy.dailyProduction[id] ?? 0) - (economy.dailyConsumption[id] ?? 0);
    if (
      this.affordable('brickworks', 2) &&
      need('bricks') < 2 + population.total / 150 &&
      r.bricks < 150 &&
      freeWorkers >= 4
    ) {
      if (this.build('brickworks')) return true;
    }
    if (
      this.affordable('fishery') &&
      this.count('fishery') < 1 + Math.floor(population.total / 200) &&
      r.food < economy.storageCapacity * 0.5 &&
      freeWorkers >= 2
    ) {
      if (this.build('fishery')) return true;
    }
    if (this.affordable('aqueduct') && this.count('aqueduct') === 0) {
      if (this.buildServiceNear('aqueduct') || this.build('aqueduct')) return true;
    }
    if (this.affordable('temple', 2) && freeWorkers >= 2 && this.count('house') > 0) {
      const culture = serviceCoverage(this.state, this.data, analysis, 'culture');
      if (
        culture < 0.9 &&
        (this.buildServiceNear('temple') || (this.count('temple') === 0 && this.build('temple')))
      )
        return true;
    }

    // --- Stredovek ---
    if (
      this.affordable('mine', 2) &&
      (this.count('mine') < 2 || need('iron') < 2) &&
      r.iron < 150 &&
      freeWorkers >= 4
    ) {
      if (this.build('mine')) return true;
    }
    if (
      this.affordable('smelter', 2) &&
      (this.count('smelter') === 0 || need('tools') < 2) &&
      r.iron >= 10 &&
      freeWorkers >= 4
    ) {
      if (this.build('smelter')) return true;
    }
    if (this.affordable('university', 2) && this.count('university') === 0 && freeWorkers >= 5) {
      if (this.build('university')) return true;
    }
    if (this.affordable('cathedral', 2) && this.count('cathedral') === 0 && freeWorkers >= 6) {
      if (this.build('cathedral')) return true;
    }

    // Tovar pre potreby obyvateľov: keď spotreba prevyšuje výrobu a zásoba klesá,
    // postaví najvýkonnejšieho dostupného výrobcu (reťazce sa doplnia samy — napr. uhlie).
    for (const id of ['cloth', 'coal', 'electricity', 'electronics'] as const) {
      const used = economy.dailyConsumption[id] ?? 0;
      const made = economy.dailyProduction[id] ?? 0;
      // Len pri skutočnom nedostatku: zásoba dochádza a výroba nestíha (s malou rezervou).
      if (used <= made * 0.9 || economy.resources[id] > economy.storageCapacity * 0.1) continue;
      const producer = this.data.buildings
        .filter(
          (b) =>
            (b.outputs[id] ?? 0) > 0 &&
            !b.wonder &&
            this.affordable(b.id, 2) &&
            freeWorkers >= b.workersRequired,
        )
        .sort((a, b) => (b.outputs[id] ?? 0) - (a.outputs[id] ?? 0))[0];
      if (producer && this.build(producer.id)) return true;
    }

    // --- Éry 4–8: tabuľka „koľko budov chcem“ ---
    const flow = (id: ResourceId) =>
      (economy.dailyProduction[id] ?? 0) - (economy.dailyConsumption[id] ?? 0);
    const pop = population.total;
    const coverage = (type: ServiceType) => serviceCoverage(this.state, this.data, analysis, type);
    const wants: [string, number][] = [
      // Služby pri domoch mimo dosahu
      ['theater', coverage('culture') < 0.9 ? this.count('theater') + 1 : 0],
      ['hospital', coverage('health') < 0.9 ? this.count('hospital') + 1 : 0],
      ['waterworks', coverage('water') < 0.95 ? this.count('waterworks') + 1 : 0],
      // Suroviny podľa bilancie
      ['pasture', flow('cloth') < 2 + pop / 800 ? this.count('pasture') + 1 : 4],
      ['coal_mine', flow('coal') < 2 ? this.count('coal_mine') + 1 : 2],
      ['power_plant', flow('electricity') < 4 ? this.count('power_plant') + 1 : 2],
      ['electronics_factory', flow('electronics') < 2 ? this.count('electronics_factory') + 1 : 2],
      ['solar_park', 6],
      ['vertical_farm', flow('food') < pop * 0.02 ? this.count('vertical_farm') + 1 : 2],
      // Jednorazové budovy pre míľniky
      ['harbor', 1 + Math.floor(pop / 3000)],
      ['printing_house', 1],
      ['observatory', 1],
      ['steelworks', 1],
      ['textile_factory', 2],
      ['railway_station', 1],
      ['assembly_plant', 1],
      ['radio_station', 1],
      ['department_store', 1],
      ['nuclear_plant', 1],
      ['data_center', 1],
      ['fusion_reactor', 1],
      ['ai_center', 1],
      ['nano_foundry', 1],
      ['space_port', 1],
    ];
    for (const [id, want] of wants) {
      const definition = this.data.buildingsById.get(id);
      if (!definition || this.count(id) >= want || !this.affordable(id, 2)) continue;
      if (freeWorkers < definition.workersRequired) continue;
      const built = definition.service
        ? this.buildServiceNear(id) || this.build(id)
        : this.build(id);
      if (built) return true;
    }

    // Nakoniec (nič dôležitejšie) vylepšenie výrobnej budovy pri veľkom prebytku surovín.
    if (!saving) {
      const production = city.buildings.find((b) => upgradable.has(b.id) && plentiful(b));
      if (
        production &&
        this.engine.execute({ type: 'UPGRADE_BUILDING', instanceId: production.id }).success
      )
        return true;
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
  /** Zastaví sa po splnení tohto míľnika (predvolene posledného). */
  untilMilestoneId: string = data.milestones.at(-1)!.id,
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
    if (completedAt[untilMilestoneId] !== undefined) break;
  }
  return {
    completedAt,
    days: engine.getState().simulation.day,
    state: engine.serialize(),
    log: bot.log,
  };
}
