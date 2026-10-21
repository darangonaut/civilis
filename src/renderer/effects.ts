import { Container, Sprite, Texture } from 'pixi.js';
import type { GameState, Position } from '@/types';
import { DAY_CYCLE_MS, dayPhase, nightFactor, nightTint, type DayPhase } from './dayNight';
import { tileToWorld } from './iso';
import {
  CHIMNEYS,
  DUST_COLOR,
  SMOKE_COLOR,
  drawCar,
  drawLights,
  drawPuff,
  drawWalker,
  hasLights,
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

    this.updateWater(dt);
    if (timeScale > 0) {
      this.emitSmoke(dt * timeScale);
      this.updateWalkers(dt * timeScale);
    }
    this.updateParticles(dt * Math.max(timeScale, 0.5));
  }

  /** Počty efektov (pre testy). */
  stats(): { walkers: number; particles: number; lights: number; night: number } {
    return {
      walkers: this.walkers.length,
      particles: this.particles.length,
      lights: this.lights.size,
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
    motion: { vx: number; vy: number; life: number; grow: number },
  ): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.alpha = 0.8;
    this.layers.particles.addChild(sprite);
    this.particles.push({ sprite, age: 0, ...motion });
  }

  private emitSmoke(dt: number): void {
    this.smokeTimer += dt;
    if (this.smokeTimer < SMOKE_INTERVAL_MS) return;
    this.smokeTimer = 0;
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
      p.sprite.x += (p.vx * dt) / 1000;
      p.sprite.y += (p.vy * dt) / 1000;
      p.sprite.alpha = 0.8 * (1 - t);
      p.sprite.scale.set(1 + p.grow * t);
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
    const car = this.activity.cars && Math.random() < 0.4;
    const textures = car ? this.carTextures : this.walkerTextures;
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
  }
}
