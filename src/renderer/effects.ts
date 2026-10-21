import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { GameState, Position } from '@/types';
import { DAY_CYCLE_MS, dayPhase, nightFactor, nightTint, type DayPhase } from './dayNight';
import { tileToWorld } from './iso';
import {
  CHIMNEYS,
  DUST_COLOR,
  FIREWORK_COLORS,
  FLAME_COLOR,
  P,
  SMOKE_COLOR,
  drawBoat,
  drawCar,
  drawFish,
  drawFlyer,
  drawGrazer,
  drawLights,
  drawPuff,
  drawRover,
  drawSpark,
  drawWalker,
  hasLights,
  spriteBounds,
  type PixelSprite,
} from './pixel/sprites';
import type { PixelCanvas } from './pixel/PixelCanvas';

/** Čo efekty potrebujú vedieť o meste (počíta app vrstva z analýzy). */
export interface CityActivity {
  /** Obsadenosť domov 0–1 (svetlá, dym z komínov domov). */
  occupancy: ReadonlyMap<string, number>;
  /** Budovy, ktoré práve pracujú (svetlá, dym). */
  working: ReadonlySet<string>;
  /** Políčka ciest napojených na mesto (chodci). */
  roadTiles: ReadonlySet<number>;
  /** V moderných érach jazdia po cestách aj autá. */
  cars: boolean;
}

export interface BuildingVisual {
  sprite: Sprite;
  key: string;
  position: Position;
}

interface Particle {
  sprite: Sprite;
  age: number;
  life: number;
  vx: number;
  vy: number;
  grow: number;
  /** Zrýchlenie nadol (px/s²) — ohňostroj, skákajúca ryba. */
  gravity?: number;
  /** Plná viditeľnosť až do konca (ryba), inak postupne mizne. */
  solid?: boolean;
  /** Striedanie snímok (mávanie krídel). */
  frames?: Texture[];
}

/** Budova vo výstavbe: rastie zdola nahor za lešením. */
interface Construction {
  sprite: Sprite;
  /** Celá textúra a kotva budovy (počas stavby sa zobrazuje iba spodná časť). */
  texture: Texture;
  anchorY: number;
  partial: Texture | null;
  scaffold: Graphics;
  age: number;
  duration: number;
  top: number;
  bottom: number;
  hw: number;
  dust: number;
}

/** Loďka alebo pasúce sa zviera: pohyb po políčkach vody / okolo pastviny. */
interface Wanderer {
  sprite: Sprite;
  from: { x: number; y: number };
  to: { x: number; y: number };
  progress: number;
  speed: number;
  /** Loďka: políčka vody; zviera: stred pastviny. */
  tile: number;
  home?: { x: number; y: number };
  rest: number;
}

interface Walker {
  sprite: Sprite;
  from: number;
  to: number;
  progress: number;
  speed: number;
  offsetX: number;
  offsetY: number;
}

interface Pop {
  sprite: Sprite;
  age: number;
}

const MAX_PARTICLES = 500;
const SMOKE_INTERVAL_MS = 700;
const POP_MS = 320;
const WATER_FRAME_MS = 650;
const BUILD_MS = 2000;
const MAX_BOATS = 8;
const MAX_GRAZERS = 40;

function texture(canvas: PixelCanvas): Texture {
  const t = Texture.from(canvas.toCanvas());
  t.source.scaleMode = 'nearest';
  return t;
}

/**
 * Vizuálne efekty mesta: deň a noc so svetlami v oknách, dym z pracujúcich komínov,
 * chodci a autá na cestách, vlniaca sa voda a „vyskočenie“ novej budovy.
 * Nemenia herný stav — iba ho zobrazujú.
 */
export class CityEffects {
  private animations = true;
  private dayNight = true;
  private phase = 0.3;
  private night = 0;

  private lightTextures = new Map<
    string,
    { texture: Texture; anchorX: number; anchorY: number } | null
  >();
  private lights = new Map<string, Sprite>();
  private smokeTexture = texture(drawPuff(SMOKE_COLOR));
  private dustTexture = texture(drawPuff(DUST_COLOR));
  private walkerTextures = Array.from({ length: 6 }, (_, i) => texture(drawWalker(i)));
  private carTextures = Array.from({ length: 6 }, (_, i) => texture(drawCar(i)));
  private roverTextures = Array.from({ length: 3 }, (_, i) => texture(drawRover(i)));
  private sparkTextures = FIREWORK_COLORS.map((c) => texture(drawSpark(c)));
  private flameTexture = texture(drawPuff(FLAME_COLOR));
  private splashTexture = texture(drawPuff(P.waterLight));
  private planetTextures = new Map<string, Texture>();
  private planetTexture(key: string, draw: () => PixelCanvas): Texture {
    let t = this.planetTextures.get(key);
    if (!t) {
      t = texture(draw());
      this.planetTextures.set(key, t);
    }
    return t;
  }

  private constructions: Construction[] = [];
  private boats: Wanderer[] = [];
  private grazers: Wanderer[] = [];
  private waterNearCity: number[] = [];
  private pastures: { id: string; x: number; y: number }[] = [];
  private flockTimer = 6000;
  private fishTimer = 3000;
  private fireworks: { at: number; x: number; y: number }[] = [];
  private fireworkClock = 0;

  private particles: Particle[] = [];
  private walkers: Walker[] = [];
  private pops: Pop[] = [];
  private smokeTimer = 0;
  private waterTimer = 0;
  private waterFrame = 0;

  private buildings: ReadonlyMap<string, BuildingVisual> = new Map();
  private activity: CityActivity = {
    occupancy: new Map(),
    working: new Set(),
    roadTiles: new Set(),
    cars: false,
  };
  private roadList: number[] = [];
  private state: Readonly<GameState> | null = null;

  constructor(
    private readonly layers: {
      /** Vrstvy, ktoré sa v noci stmavia. */
      tinted: Container[];
      lights: Container;
      particles: Container;
      /** Chodci sa triedia spolu s budovami (zIndex). */
      actors: Container;
    },
    private readonly water: { sprites: () => Sprite[]; frames: (frame: number) => Texture[] },
    private readonly onPhase: (phase: DayPhase | null) => void = () => {},
  ) {}

  private reportedPhase: DayPhase | null = null;

  private reportPhase(): void {
    const phase = this.dayNight ? dayPhase(this.phase) : null;
    if (phase !== this.reportedPhase) {
      this.reportedPhase = phase;
      this.onPhase(phase);
    }
  }

  setOptions(options: { animations: boolean; dayNight: boolean }): void {
    this.animations = options.animations;
    this.dayNight = options.dayNight;
    if (!this.animations) this.clearMotion();
    if (!this.dayNight) this.applyNight(0);
    this.reportPhase();
  }

  /** Aktualizácia po zmene herného stavu. */
  sync(
    state: Readonly<GameState>,
    buildings: ReadonlyMap<string, BuildingVisual>,
    activity: CityActivity,
  ): void {
    this.state = state;
    this.buildings = buildings;
    this.activity = activity;
    this.roadList = [...activity.roadTiles];
    this.syncNature(state);
    this.syncLights();
    this.updateLightLevels();
  }

  /** Nová budova „vyskočí“ a zvíri prach. */
  pop(sprite: Sprite, position: Position): void {
    if (!this.animations) return;
    sprite.scale.set(0.6);
    this.pops.push({ sprite, age: 0 });
    const world = tileToWorld(position.x, position.y);
    for (let i = 0; i < 6; i++) {
      this.spawnParticle(
        this.dustTexture,
        world.x + (Math.random() - 0.5) * 18,
        world.y + (Math.random() - 0.3) * 6,
        {
          vx: (Math.random() - 0.5) * 14,
          vy: -4 - Math.random() * 6,
          life: 600 + Math.random() * 300,
          grow: 0.8,
        },
      );
    }
  }

  /**
   * Stavba novej budovy: sprite rastie zdola nahor za dreveným lešením, okolo sa víri prach
   * a na konci budova „vyskočí“.
   */
  construct(sprite: Sprite, position: Position, size: number, key: string): void {
    if (!this.animations) return;
    const { top, bottom } = spriteBounds(key);
    const scaffold = new Graphics();
    sprite.addChild(scaffold);
    this.constructions.push({
      sprite,
      texture: sprite.texture,
      anchorY: sprite.anchor.y,
      partial: null,
      scaffold,
      age: 0,
      duration: BUILD_MS * (size > 1 ? 1.6 : 1) * (0.9 + Math.random() * 0.2),
      top,
      bottom,
      hw: size > 1 ? 26 : 12,
      dust: 0,
    });
    this.updateConstruction(this.constructions.at(-1)!, 0, position);
  }

  /** Ohňostroj nad mestom (nová éra, míľnik). */
  celebrate(): void {
    if (!this.animations || this.buildings.size === 0) return;
    const visuals = [...this.buildings.values()];
    for (let i = 0; i < 10; i++) {
      const b = visuals[Math.floor(Math.random() * visuals.length)]!;
      const world = tileToWorld(b.position.x, b.position.y);
      this.fireworks.push({
        at: this.fireworkClock + i * 280 + Math.random() * 200,
        x: world.x + (Math.random() - 0.5) * 30,
        y: world.y - 60 - Math.random() * 40,
      });
    }
  }

  /** Volá sa každú snímku. `speed` = rýchlosť simulácie (0 = pauza: svet stojí). */
  update(dtMs: number, speed: number): void {
    const dt = Math.min(dtMs, 100);
    const timeScale = Math.min(speed, 2);

    if (this.dayNight && timeScale > 0) {
      this.phase = (this.phase + (dt * speed) / DAY_CYCLE_MS) % 1;
      this.reportPhase();
      const night = nightFactor(this.phase);
      if (Math.abs(night - this.night) > 0.005 || (night === 0) !== (this.night === 0))
        this.applyNight(night);
    }

    this.updatePops(dt);
    if (!this.animations) return;
    for (let i = this.constructions.length - 1; i >= 0; i--) {
      if (this.updateConstruction(this.constructions[i]!, dt)) this.constructions.splice(i, 1);
    }
    this.updateFireworks(dt);

    this.updateWater(dt);
    if (timeScale > 0) {
      this.emitSmoke(dt * timeScale);
      this.updateWalkers(dt * timeScale);
      this.updateWanderers(dt * timeScale);
      this.updateFlocks(dt);
      this.updateFish(dt * timeScale);
    }
    this.updateParticles(dt * Math.max(timeScale, 0.5));
  }

  /** Počty efektov (pre testy). */
  stats(): {
    walkers: number;
    particles: number;
    lights: number;
    night: number;
    boats: number;
    grazers: number;
    constructions: number;
  } {
    return {
      walkers: this.walkers.length,
      particles: this.particles.length,
      lights: this.lights.size,
      boats: this.boats.length,
      grazers: this.grazers.length,
      constructions: this.constructions.length,
      night: this.night,
    };
  }

  destroy(): void {
    this.clearMotion();
    for (const sprite of this.lights.values()) sprite.destroy();
    this.lights.clear();
    for (const entry of this.lightTextures.values()) entry?.texture.destroy(true);
    [this.smokeTexture, this.dustTexture, ...this.walkerTextures, ...this.carTextures].forEach(
      (t) => t.destroy(true),
    );
  }

  // --- Deň a noc, svetlá ---

  private applyNight(night: number): void {
    this.night = night;
    const tint = nightTint(night);
    for (const layer of this.layers.tinted) layer.tint = tint;
    this.layers.lights.visible = night > 0;
    this.updateLightLevels();
  }

  private lightTexture(key: string) {
    if (!this.lightTextures.has(key)) {
      const sprite: PixelSprite = drawLights(key);
      this.lightTextures.set(
        key,
        hasLights(sprite)
          ? {
              texture: texture(sprite.canvas),
              anchorX: sprite.anchorX / sprite.canvas.width,
              anchorY: sprite.anchorY / sprite.canvas.height,
            }
          : null,
      );
    }
    return this.lightTextures.get(key)!;
  }

  private syncLights(): void {
    for (const [id, sprite] of this.lights) {
      const building = this.buildings.get(id);
      if (!building || sprite.label !== building.key) {
        sprite.destroy();
        this.lights.delete(id);
      }
    }
    for (const [id, building] of this.buildings) {
      if (this.lights.has(id)) continue;
      const light = this.lightTexture(building.key);
      if (!light) continue;
      const sprite = new Sprite(light.texture);
      sprite.anchor.set(light.anchorX, light.anchorY);
      sprite.blendMode = 'add';
      sprite.label = building.key;
      sprite.cullable = true;
      const world = tileToWorld(building.position.x, building.position.y);
      sprite.position.set(world.x, world.y);
      // Hneď nad vlastnou budovou, pod budovami vpredu.
      sprite.zIndex = building.sprite.zIndex + 0.01;
      this.layers.lights.addChild(sprite);
      this.lights.set(id, sprite);
    }
  }

  private updateLightLevels(): void {
    if (this.night <= 0) return;
    for (const [id, sprite] of this.lights) {
      const occupancy = this.activity.occupancy.get(id);
      const level =
        occupancy !== undefined
          ? occupancy > 0
            ? 0.35 + 0.65 * occupancy
            : 0
          : this.activity.working.has(id)
            ? 1
            : 0;
      sprite.alpha = this.night * level;
    }
  }

  // --- Dym a častice ---

  private spawnParticle(
    tex: Texture,
    x: number,
    y: number,
    motion: Omit<Particle, 'sprite' | 'age'>,
  ): Sprite | null {
    if (this.particles.length >= MAX_PARTICLES) return null;
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.alpha = 0.8;
    this.layers.particles.addChild(sprite);
    this.particles.push({ sprite, age: 0, ...motion });
    return sprite;
  }

  private emitSmoke(dt: number): void {
    this.smokeTimer += dt;
    if (this.smokeTimer < SMOKE_INTERVAL_MS) return;
    this.smokeTimer = 0;
    // Budova po požiari (čaká na opravu) horí a dymí.
    for (const active of this.state?.events.active ?? []) {
      if (active.effect.type !== 'disable_building') continue;
      const building = this.buildings.get(active.effect.buildingId);
      if (!building) continue;
      const world = tileToWorld(building.position.x, building.position.y);
      for (let i = 0; i < 4; i++) {
        this.spawnParticle(
          this.flameTexture,
          world.x + (Math.random() - 0.5) * 14,
          world.y - 8 - Math.random() * 10,
          { vx: (Math.random() - 0.5) * 4, vy: -14 - Math.random() * 8, life: 700, grow: -0.5 },
        );
      }
      this.spawnParticle(this.smokeTexture, world.x, world.y - 20, {
        vx: 3,
        vy: -8,
        life: 2600,
        grow: 1.6,
      });
    }
    for (const [id, building] of this.buildings) {
      const chimneys = CHIMNEYS[building.key.replace(/^(mars|proxima)~/, '')];
      if (!chimneys) continue;
      const active = (this.activity.occupancy.get(id) ?? 0) > 0 || this.activity.working.has(id);
      if (!active || Math.random() < 0.35) continue;
      const world = tileToWorld(building.position.x, building.position.y);
      for (const [dx, dy] of chimneys) {
        this.spawnParticle(this.smokeTexture, world.x + dx, world.y + dy, {
          vx: 2 + Math.random() * 3,
          vy: -5 - Math.random() * 3,
          life: 2400 + Math.random() * 800,
          grow: 1.2,
        });
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.sprite.destroy();
        this.particles.splice(i, 1);
        continue;
      }
      if (p.gravity) p.vy += (p.gravity * dt) / 1000;
      p.sprite.x += (p.vx * dt) / 1000;
      p.sprite.y += (p.vy * dt) / 1000;
      p.sprite.alpha = p.solid ? 1 : 0.8 * (1 - t);
      if (p.grow) p.sprite.scale.set(1 + p.grow * t);
      if (p.frames) p.sprite.texture = p.frames[Math.floor(p.age / 180) % p.frames.length]!;
    }
  }

  private updatePops(dt: number): void {
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const pop = this.pops[i]!;
      pop.age += dt;
      const t = Math.min(1, pop.age / POP_MS);
      // Mierne prestrelenie a návrat na 1.
      const scale = t < 0.7 ? 0.6 + (0.48 * t) / 0.7 : 1.08 - (0.08 * (t - 0.7)) / 0.3;
      if (pop.sprite.destroyed) {
        this.pops.splice(i, 1);
        continue;
      }
      pop.sprite.scale.set(t >= 1 ? 1 : scale);
      if (t >= 1) this.pops.splice(i, 1);
    }
  }

  // --- Voda ---

  private updateWater(dt: number): void {
    this.waterTimer += dt;
    if (this.waterTimer < WATER_FRAME_MS) return;
    this.waterTimer = 0;
    this.waterFrame = (this.waterFrame + 1) % 4;
    const frames = this.water.frames(this.waterFrame);
    this.water.sprites().forEach((sprite, i) => {
      sprite.texture = frames[(i + this.waterFrame) % frames.length]!;
    });
  }

  // --- Chodci a autá ---

  private walkerTarget(): number {
    const population = this.state?.city.population.total ?? 0;
    if (this.roadList.length < 2) return 0;
    return Math.min(180, Math.floor(population / 12), this.roadList.length * 2);
  }

  private tileCenter(index: number): { x: number; y: number } {
    const width = this.state!.world.width;
    return tileToWorld(index % width, Math.floor(index / width));
  }

  private neighbors(index: number): number[] {
    const width = this.state!.world.width;
    const x = index % width;
    const candidates = [
      index - width,
      index + width,
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
    ];
    return candidates.filter((n) => n >= 0 && this.activity.roadTiles.has(n));
  }

  private spawnWalker(): void {
    const from = this.roadList[Math.floor(Math.random() * this.roadList.length)]!;
    const options = this.neighbors(from);
    if (options.length === 0) return;
    const planet = this.state!.planet;
    // Na Marse jazdia rovery od začiatku, na Proxime medzi ľuďmi pobehujú šesťnožce.
    const car = (this.activity.cars || planet === 'mars') && Math.random() < 0.4;
    const hexapod = planet === 'proxima' && !car && Math.random() < 0.15;
    const textures = car
      ? planet === 'mars'
        ? this.roverTextures
        : this.carTextures
      : hexapod
        ? [this.planetTexture('grazer-proxima', () => drawGrazer('proxima'))]
        : this.walkerTextures;
    const sprite = new Sprite(textures[Math.floor(Math.random() * textures.length)]!);
    sprite.anchor.set(0.5, 1);
    this.layers.actors.addChild(sprite);
    this.walkers.push({
      sprite,
      from,
      to: options[Math.floor(Math.random() * options.length)]!,
      progress: Math.random(),
      speed: car ? 1.6 + Math.random() * 0.6 : 0.5 + Math.random() * 0.4,
      offsetX: car ? 0 : (Math.random() - 0.5) * 10,
      offsetY: car ? 0 : (Math.random() - 0.5) * 4,
    });
  }

  private updateWalkers(dt: number): void {
    const target = this.walkerTarget();
    while (this.walkers.length > target) this.walkers.pop()!.sprite.destroy();
    for (let i = 0; i < 4 && this.walkers.length < target; i++) this.spawnWalker();

    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i]!;
      if (!this.activity.roadTiles.has(w.from) || !this.activity.roadTiles.has(w.to)) {
        w.sprite.destroy();
        this.walkers.splice(i, 1);
        continue;
      }
      w.progress += (w.speed * dt) / 1000;
      if (w.progress >= 1) {
        const options = this.neighbors(w.to).filter((n) => n !== w.from);
        const next =
          options.length > 0 ? options[Math.floor(Math.random() * options.length)]! : w.from;
        w.from = w.to;
        w.to = next;
        w.progress -= 1;
      }
      const a = this.tileCenter(w.from);
      const b = this.tileCenter(w.to);
      const x = a.x + (b.x - a.x) * w.progress + w.offsetX;
      const y = a.y + (b.y - a.y) * w.progress + w.offsetY;
      w.sprite.position.set(Math.round(x), Math.round(y) + 3);
      w.sprite.scale.x = b.x < a.x ? -1 : 1;
      const width = this.state!.world.width;
      const depth = (i: number) => (i % width) + Math.floor(i / width);
      w.sprite.zIndex = depth(w.from) + (depth(w.to) - depth(w.from)) * w.progress + 0.2;
    }
  }

  private clearMotion(): void {
    for (const p of this.particles) p.sprite.destroy();
    this.particles = [];
    for (const w of this.walkers) w.sprite.destroy();
    this.walkers = [];
    for (const pop of this.pops) if (!pop.sprite.destroyed) pop.sprite.scale.set(1);
    this.pops = [];
    for (const c of this.constructions) this.finishConstruction(c);
    this.constructions = [];
    for (const w of [...this.boats, ...this.grazers]) w.sprite.destroy();
    this.boats = [];
    this.grazers = [];
    this.fireworks = [];
  }

  // --- Stavba ---

  /** Vráti true, keď je stavba hotová. */
  private updateConstruction(c: Construction, dt: number, position?: Position): boolean {
    if (c.sprite.destroyed) {
      this.finishConstruction(c);
      return true;
    }
    c.age += dt;
    const t = Math.min(1, c.age / c.duration);
    if (t >= 1) {
      this.finishConstruction(c);
      const world = { x: c.sprite.x, y: c.sprite.y };
      this.pops.push({ sprite: c.sprite, age: POP_MS * 0.55 });
      this.dustAt(world.x, world.y, 5);
      return true;
    }
    // Rast zdola nahor (ľahké spomalenie na konci).
    const eased = 1 - (1 - t) * (1 - t);
    const line = c.bottom - (c.bottom - c.top) * eased;
    const plank = Math.max(line - 3, c.top);
    // Orezaná textúra: iba riadky pod rastúcou hranou (kotva drží budovu na mieste).
    const { width, height } = c.texture;
    const anchorPx = c.anchorY * height;
    const cut = Math.min(height - 1, Math.max(0, Math.round(line + anchorPx)));
    c.partial?.destroy(false);
    c.partial = new Texture({
      source: c.texture.source,
      frame: new Rectangle(c.texture.frame.x, c.texture.frame.y + cut, width, height - cut),
    });
    c.sprite.texture = c.partial;
    c.sprite.anchor.y = (anchorPx - cut) / (height - cut);
    // Lešenie: stĺpy od zeme po rastúcu hranu a priečka na nej.
    const hw = c.hw;
    const ground = hw / 2;
    const s = c.scaffold.clear();
    for (const [x, y] of [
      [-hw, 0],
      [0, ground],
      [hw, 0],
    ] as const) {
      s.moveTo(x, y + 1).lineTo(x, plank);
    }
    s.moveTo(-hw, plank)
      .lineTo(0, plank + ground)
      .lineTo(hw, plank)
      .stroke({ width: 1, color: P.woodShade });
    c.dust += dt;
    if (c.dust > 160 || position) {
      c.dust = 0;
      this.dustAt(c.sprite.x, c.sprite.y, position ? 4 : 1);
    }
    return false;
  }

  private finishConstruction(c: Construction): void {
    if (!c.sprite.destroyed) {
      // Ak medzitým budova zmenila vzhľad (vylepšenie), textúru už nastavil renderer.
      if (c.sprite.texture === c.partial) c.sprite.texture = c.texture;
      c.sprite.anchor.y = c.anchorY;
      c.scaffold.destroy();
    }
    c.partial?.destroy(false);
    c.partial = null;
  }

  private dustAt(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnParticle(this.dustTexture, x + (Math.random() - 0.5) * 22, y + Math.random() * 5, {
        vx: (Math.random() - 0.5) * 14,
        vy: -4 - Math.random() * 6,
        life: 600 + Math.random() * 300,
        grow: 0.8,
      });
    }
  }

  // --- Ohňostroj ---

  private updateFireworks(dt: number): void {
    this.fireworkClock += dt;
    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const f = this.fireworks[i]!;
      if (f.at > this.fireworkClock) continue;
      this.fireworks.splice(i, 1);
      const color = Math.floor(Math.random() * this.sparkTextures.length);
      // Stopa rakety a výbuch.
      this.spawnParticle(this.sparkTextures[1]!, f.x, f.y + 50, {
        vx: 0,
        vy: -70,
        life: 650,
        grow: 0,
      });
      for (let k = 0; k < 24; k++) {
        const angle = (k / 24) * Math.PI * 2;
        const speed = 26 + Math.random() * 14;
        const spark = this.spawnParticle(this.sparkTextures[color]!, f.x, f.y, {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1500,
          grow: 0,
          gravity: 16,
        });
        if (spark) spark.alpha = 1;
      }
    }
  }

  // --- Príroda: loďky, zvieratá, vtáky, ryby ---

  private syncNature(state: Readonly<GameState>): void {
    const { width, height, tiles } = state.world;
    const water = new Set<number>();
    const pastures: { id: string; x: number; y: number }[] = [];
    let boatPlaces = 0;
    for (const [id, b] of this.buildings) {
      const base = b.key.replace(/^(mars|proxima)[:~]/, '');
      if (base.startsWith('pasture')) pastures.push({ id, ...b.position });
      if (!base.startsWith('fishery') && !base.startsWith('harbor')) continue;
      boatPlaces += base.startsWith('harbor') ? 2 : 1;
      for (let y = b.position.y - 6; y <= b.position.y + 6; y++)
        for (let x = b.position.x - 6; x <= b.position.x + 6; x++)
          if (
            x >= 0 &&
            y >= 0 &&
            x < width &&
            y < height &&
            tiles[y * width + x]!.terrain === 'water'
          )
            water.add(y * width + x);
    }
    this.waterNearCity = [...water];
    this.pastures = state.planet === 'mars' ? [] : pastures.slice(0, MAX_GRAZERS / 2);
    this.boatTarget =
      state.planet === 'mars' || water.size < 4 ? 0 : Math.min(MAX_BOATS, boatPlaces);
  }

  private boatTarget = 0;

  private waterNeighbors(index: number): number[] {
    const { width, tiles } = this.state!.world;
    const x = index % width;
    return [
      index - width,
      index + width,
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
    ].filter((n) => n >= 0 && tiles[n]?.terrain === 'water');
  }

  private updateWanderers(dt: number): void {
    const planet = this.state!.planet;
    // Loďky po vode pri rybároch a prístavoch.
    while (this.boats.length > this.boatTarget) this.boats.pop()!.sprite.destroy();
    if (this.boats.length < this.boatTarget && this.waterNearCity.length > 0) {
      const tile = this.waterNearCity[Math.floor(Math.random() * this.waterNearCity.length)]!;
      const sprite = new Sprite(this.planetTexture(`boat-${planet}`, () => drawBoat(planet)));
      sprite.anchor.set(0.5, 1);
      this.layers.actors.addChild(sprite);
      const at = this.tileCenter(tile);
      this.boats.push({ sprite, from: at, to: at, progress: 1, speed: 0.22, tile, rest: 0 });
    }
    for (const boat of this.boats) {
      boat.progress += (boat.speed * dt) / 1000;
      if (boat.progress >= 1) {
        const options = this.waterNeighbors(boat.tile);
        if (options.length > 0) {
          boat.tile = options[Math.floor(Math.random() * options.length)]!;
          boat.from = boat.to;
          boat.to = this.tileCenter(boat.tile);
          boat.progress = 0;
        }
      }
      this.placeWanderer(boat, 2);
    }
    // Pasúce sa zvieratá: dve na pastvinu, pomaly sa presúvajú a postoja.
    const wanted = this.pastures.flatMap((p) => [p, p]);
    while (this.grazers.length > wanted.length) this.grazers.pop()!.sprite.destroy();
    while (this.grazers.length < wanted.length) {
      const p = wanted[this.grazers.length]!;
      const home = tileToWorld(p.x, p.y);
      const sprite = new Sprite(this.planetTexture(`grazer-${planet}`, () => drawGrazer(planet)));
      sprite.anchor.set(0.5, 1);
      this.layers.actors.addChild(sprite);
      this.grazers.push({
        sprite,
        from: home,
        to: home,
        progress: 1,
        speed: 0.4,
        tile: p.y * 1000 + p.x,
        home,
        rest: Math.random() * 2000,
      });
    }
    this.grazers.forEach((g, i) => {
      const p = wanted[i]!;
      const home = tileToWorld(p.x, p.y);
      if (g.home!.x !== home.x || g.home!.y !== home.y) {
        g.home = home;
        g.from = home;
        g.to = home;
      }
      if (g.progress >= 1) {
        g.rest -= dt;
        if (g.rest <= 0) {
          g.from = g.to;
          g.to = { x: home.x + (Math.random() - 0.5) * 16, y: home.y + (Math.random() - 0.5) * 6 };
          g.progress = 0;
          g.rest = 800 + Math.random() * 2500;
        }
      } else g.progress = Math.min(1, g.progress + (g.speed * dt) / 1000);
      this.placeWanderer(g, 0.6, p);
    });
  }

  private placeWanderer(w: Wanderer, lift: number, tile?: { x: number; y: number }): void {
    const t = Math.min(1, w.progress);
    const x = w.from.x + (w.to.x - w.from.x) * t;
    const y = w.from.y + (w.to.y - w.from.y) * t;
    w.sprite.position.set(Math.round(x), Math.round(y + lift + 2));
    if (w.to.x !== w.from.x) w.sprite.scale.x = w.to.x < w.from.x ? -1 : 1;
    const width = this.state!.world.width;
    const depth = tile ? tile.x + tile.y : (w.tile % width) + Math.floor(w.tile / width);
    w.sprite.zIndex = depth + 0.3;
  }

  private updateFlocks(dt: number): void {
    this.flockTimer -= dt;
    if (this.flockTimer > 0 || this.buildings.size === 0) return;
    this.flockTimer = 9000 + Math.random() * 12000;
    const planet = this.state!.planet;
    if (planet === 'earth' && this.night > 0.5) return; // vtáky v noci spia
    const frames = [0, 1].map((f) =>
      this.planetTexture(`flyer-${planet}-${f}`, () => drawFlyer(planet, f)),
    );
    const visuals = [...this.buildings.values()];
    const b = visuals[Math.floor(Math.random() * visuals.length)]!;
    const origin = tileToWorld(b.position.x, b.position.y);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const count =
      planet === 'mars' ? 1 + Math.floor(Math.random() * 2) : 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      this.spawnParticle(
        frames[0]!,
        origin.x - dir * (180 + i * 9) + (Math.random() - 0.5) * 8,
        origin.y - 70 - Math.random() * 30 + (i % 2) * 6,
        {
          vx: dir * (36 + Math.random() * 6),
          vy: (Math.random() - 0.5) * 4,
          life: 10000,
          grow: 0,
          solid: true,
          frames,
        },
      )?.scale.set(dir, 1);
    }
  }

  private updateFish(dt: number): void {
    this.fishTimer -= dt;
    if (this.fishTimer > 0) return;
    this.fishTimer = 2500 + Math.random() * 4000;
    const planet = this.state!.planet;
    if (planet === 'mars' || this.waterNearCity.length === 0) return;
    const tile = this.waterNearCity[Math.floor(Math.random() * this.waterNearCity.length)]!;
    const at = this.tileCenter(tile);
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.spawnParticle(
      this.planetTexture(`fish-${planet}`, () => drawFish(planet)),
      at.x,
      at.y,
      {
        vx: dir * 10,
        vy: -34,
        life: 900,
        grow: 0,
        gravity: 75,
        solid: true,
      },
    )?.scale.set(dir, 1);
    for (let i = 0; i < 2; i++) {
      this.spawnParticle(this.splashTexture, at.x + (Math.random() - 0.5) * 6, at.y + 1, {
        vx: (Math.random() - 0.5) * 8,
        vy: -6,
        life: 500,
        grow: 0.5,
      });
    }
  }
}
