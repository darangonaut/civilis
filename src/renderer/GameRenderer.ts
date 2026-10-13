import { Application, Container, CullerPlugin, Sprite, extensions } from 'pixi.js';
import type { GameState, Position } from '@/types';
import { tileToWorld, worldBounds, worldToTile } from './iso';
import type { DayPhase } from './dayNight';
import { dragPositions, dragShapeFor } from './dragPath';
import { CityEffects, type BuildingVisual, type CityActivity } from './effects';
import { buildingSpriteKey, type MarkerKind } from './pixel/sprites';
import {
  TERRAIN_VARIANTS,
  createTextureAtlas,
  type AnchoredTexture,
  type TextureAtlas,
} from './textures';

extensions.add(CullerPlugin);

/** Celočíselné úrovne zoomu drží pixely rovnako veľké (½ je prehľad celej mapy). */
const ZOOM_LEVELS = [0.5, 1, 2, 3, 4] as const;
/** Pomer roztiahnutia prstov na jeden krok zoomu. */
const PINCH_STEP = 1.4;
/** Prst sa pri ťuknutí trochu pohne — väčšia tolerancia ako pri myši. */
const TOUCH_DRAG_THRESHOLD = 10;
const DEFAULT_ZOOM = 2;
/** Posun myšou väčší ako toto (px) sa berie ako ťahanie, nie klik. */
const DRAG_THRESHOLD = 5;

const PREVIEW_VALID = 0x8cff8c;
const PREVIEW_INVALID = 0xff6b6b;
const SELECTION_COLOR = 0xffd75e;
/** Strana bloku terénu pre culling. */
const TERRAIN_CHUNK = 16;
/** Výška výstražnej značky nad stredom políčka (logické pixely). */
const MARKER_OFFSET = 14;

export interface CameraView {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RendererCallbacks {
  onTileHover(position: Position | null): void;
  onTileClick(position: Position): void;
  /** Ťahanie v režime stavby: postaviť budovu na všetky políčka (v poradí). */
  onPlaceMany(buildingId: string, positions: Position[]): void;
  /** Či sa dá budova na políčko postaviť — pre farbu náhľadu. */
  canPlace(buildingId: string, position: Position): boolean;
  /** Zmena výhľadu kamery (svetové súradnice) — minimapa. */
  onCameraChange?(view: CameraView): void;
  /** Zmena fázy dňa (null = deň a noc vypnuté). */
  onDayPhase?(phase: DayPhase | null): void;
}

/** Pseudonáhodný, ale stabilný variant textúry terénu pre políčko. */
function terrainVariant(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) % TERRAIN_VARIANTS;
}

function applyTexture(sprite: Sprite, anchored: AnchoredTexture): void {
  sprite.texture = anchored.texture;
  sprite.anchor.set(anchored.anchorX, anchored.anchorY);
}

function placeOnTile(sprite: Sprite, position: Position): void {
  const world = tileToWorld(position.x, position.y);
  sprite.position.set(world.x, world.y);
}

/**
 * Izometrický PixiJS renderer. Číta iba dátový stav (`GameState`), nič v ňom nemení;
 * všetky akcie hráča posiela cez callbacky.
 */
export class GameRenderer {
  private app = new Application();
  private atlas!: TextureAtlas;
  private camera = new Container();
  private terrainLayer = new Container();
  private roadLayer = new Container();
  private groundOverlay = new Container();
  private buildingLayer = new Container({ sortableChildren: true });

  private buildingSprites = new Map<string, Sprite>();
  private markerLayer = new Container();
  private lightLayer = new Container();
  private particleLayer = new Container();
  private effects!: CityEffects;
  private waterSprites: Sprite[] = [];
  /** Po prvej synchronizácii nového sveta sa nové budovy animujú („vyskočia“). */
  private animateNewBuildings = false;
  private markerSprites = new Map<string, Sprite>();
  private renderedWorld: GameState['world'] | null = null;
  private state: Readonly<GameState> | null = null;

  private hoverOutline = new Sprite();
  private selectionOutline = new Sprite();
  private preview = new Sprite();

  private hoveredTile: Position | null = null;
  private buildModeId: string | null = null;
  private buildLevel = 1;
  private selectedInstanceId: string | null = null;

  /** Ťahanie v režime stavby: začiatočné a aktuálne políčko. */
  private dragBuild: { start: Position; end: Position } | null = null;
  private dragPreview: Sprite[] = [];

  private pointer: {
    id: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    dragging: boolean;
    mode: 'pan' | 'build';
  } | null = null;
  /** Aktívne dotyky (pre priblíženie dvoma prstami). */
  private touches = new Map<number, { x: number; y: number }>();
  /** Gesto dvoma prstami: vzdialenosť pri poslednom kroku zoomu a posledný stred. */
  private pinch: { distance: number; midX: number; midY: number } | null = null;
  private destroyed = false;
  private cleanup: (() => void)[] = [];

  private constructor(
    private readonly host: HTMLElement,
    private readonly callbacks: RendererCallbacks,
  ) {}

  static async create(
    host: HTMLElement,
    buildingIds: readonly string[],
    callbacks: RendererCallbacks,
  ) {
    const renderer = new GameRenderer(host, callbacks);
    await renderer.init(buildingIds);
    return renderer;
  }

  private async init(buildingIds: readonly string[]): Promise<void> {
    await this.app.init({
      resizeTo: this.host,
      background: 0x15171b,
      antialias: false,
      roundPixels: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    this.app.canvas.classList.add('map-canvas');
    this.host.appendChild(this.app.canvas);
    this.atlas = createTextureAtlas(buildingIds);

    this.camera.addChild(
      this.terrainLayer,
      this.roadLayer,
      this.groundOverlay,
      this.buildingLayer,
      this.lightLayer,
      this.particleLayer,
      this.markerLayer,
    );
    this.app.stage.addChild(this.camera);

    this.effects = new CityEffects(
      {
        tinted: [this.terrainLayer, this.roadLayer, this.buildingLayer],
        lights: this.lightLayer,
        particles: this.particleLayer,
        actors: this.buildingLayer,
      },
      {
        sprites: () => this.waterSprites,
        frames: () => this.atlas.terrain.water.map((t) => t.texture),
      },
      (phase) => this.callbacks.onDayPhase?.(phase),
    );
    const onTick = () =>
      this.effects.update(this.app.ticker.deltaMS, this.state?.simulation.speed ?? 0);
    this.app.ticker.add(onTick);
    this.cleanup.push(() => this.app.ticker.remove(onTick));

    applyTexture(this.hoverOutline, this.atlas.outline);
    applyTexture(this.selectionOutline, this.atlas.outline);
    this.hoverOutline.visible = false;
    this.selectionOutline.visible = false;
    this.selectionOutline.tint = SELECTION_COLOR;
    this.groundOverlay.addChild(this.hoverOutline, this.selectionOutline);
    this.preview.visible = false;
    this.preview.alpha = 0.7;
    this.buildingLayer.addChild(this.preview);

    this.bindInput();
    const onResize = () => this.clampCamera();
    this.app.renderer.on('resize', onResize);
    this.cleanup.push(() => this.app.renderer.off('resize', onResize));
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cleanup.forEach((fn) => fn());
    this.effects.destroy();
    this.atlas.destroy();
    this.app.destroy(true, { children: true });
  }

  /**
   * Synchronizuje sprity s herným stavom. Volá sa po každej zmene stavu.
   * `markers` určuje, nad ktorými budovami sa zobrazí značka a akého druhu.
   */
  sync(
    state: Readonly<GameState>,
    markers: ReadonlyMap<string, MarkerKind> = new Map(),
    activity?: CityActivity,
  ): void {
    const worldChanged = this.renderedWorld !== state.world;
    this.state = state;
    if (worldChanged) {
      this.buildTerrain(state.world);
      this.animateNewBuildings = false;
    }
    this.syncBuildings(state);
    this.animateNewBuildings = true;
    this.syncMarkers(state, markers);
    if (activity) this.effects.sync(state, this.buildingVisuals(state), activity);
    // Nová alebo načítaná hra: kamera späť na mesto.
    if (worldChanged) this.centerOnStart();
    this.refreshOverlay();
  }

  effectsStats() {
    return this.effects.stats();
  }

  /** Animácie (dym, chodci, voda) a cyklus dňa a noci. */
  setEffectsOptions(options: { animations: boolean; dayNight: boolean }): void {
    this.effects.setOptions(options);
  }

  private buildingVisuals(state: Readonly<GameState>): Map<string, BuildingVisual> {
    const visuals = new Map<string, BuildingVisual>();
    for (const building of state.city.buildings) {
      const sprite = this.buildingSprites.get(building.id);
      if (sprite)
        visuals.set(building.id, { sprite, key: sprite.label, position: building.position });
    }
    return visuals;
  }

  setBuildMode(buildingId: string | null, level = 1): void {
    this.buildModeId = buildingId;
    this.buildLevel = level;
    this.refreshOverlay();
  }

  setSelectedInstance(instanceId: string | null): void {
    this.selectedInstanceId = instanceId;
    this.refreshOverlay();
  }

  /** Stred políčka v súradniciach okna prehliadača (pre E2E testy). */
  tileToClient(position: Position): { x: number; y: number } {
    const world = tileToWorld(position.x, position.y);
    const rect = this.app.canvas.getBoundingClientRect();
    return {
      x: rect.left + this.camera.x + world.x * this.camera.scale.x,
      y: rect.top + this.camera.y + world.y * this.camera.scale.y,
    };
  }

  /**
   * Terén je rozdelený do blokov TERRAIN_CHUNK × TERRAIN_CHUNK políčok. Culling vyradí
   * celý blok mimo obrazovky naraz, takže cena nerastie s veľkosťou mapy (až 256 × 256).
   * Bloky aj políčka v nich sa kreslia odzadu dopredu (podľa x + y), aby stromy správne
   * prekrývali políčka za sebou.
   */
  private buildTerrain(world: GameState['world']): void {
    this.terrainLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.waterSprites = [];
    const chunksX = Math.ceil(world.width / TERRAIN_CHUNK);
    const chunksY = Math.ceil(world.height / TERRAIN_CHUNK);
    const chunks: { order: number; container: Container }[] = [];
    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const container = new Container({ cullable: true, cullableChildren: false });
        for (let depth = 0; depth < 2 * TERRAIN_CHUNK - 1; depth++) {
          for (let dy = 0; dy <= depth; dy++) {
            const x = cx * TERRAIN_CHUNK + depth - dy;
            const y = cy * TERRAIN_CHUNK + dy;
            if (
              depth - dy >= TERRAIN_CHUNK ||
              dy >= TERRAIN_CHUNK ||
              x >= world.width ||
              y >= world.height
            )
              continue;
            const tile = world.tiles[y * world.width + x]!;
            const sprite = new Sprite();
            applyTexture(
              sprite,
              this.atlas.terrain[tile.terrain][terrainVariant(x, y, world.seed)]!,
            );
            placeOnTile(sprite, { x, y });
            container.addChild(sprite);
            if (tile.terrain === 'water') this.waterSprites.push(sprite);
          }
        }
        chunks.push({ order: cx + cy, container });
      }
    }
    chunks
      .sort((a, b) => a.order - b.order)
      .forEach(({ container }) => this.terrainLayer.addChild(container));
    this.renderedWorld = world;
  }

  private syncBuildings(state: Readonly<GameState>): void {
    const present = new Set<string>();
    for (const building of state.city.buildings) {
      present.add(building.id);
      // Vzhľad závisí od úrovne a preskúmaných technológií.
      const key = buildingSpriteKey(
        building.definitionId,
        building.level,
        state.research.completedTechnologyIds,
      );
      let sprite = this.buildingSprites.get(building.id);
      if (
        sprite &&
        sprite.label !== key &&
        sprite.label.split(/[@+]/)[0] === building.definitionId
      ) {
        sprite.label = key;
        applyTexture(sprite, this.atlas.building(key));
      }
      if (!sprite || sprite.label !== key) {
        sprite?.destroy();
        sprite = new Sprite();
        sprite.label = key;
        sprite.cullable = true;
        applyTexture(sprite, this.atlas.building(key));
        (building.definitionId === 'road' ? this.roadLayer : this.buildingLayer).addChild(sprite);
        this.buildingSprites.set(building.id, sprite);
        placeOnTile(sprite, building.position);
        if (this.animateNewBuildings && building.definitionId !== 'road') {
          this.effects.pop(sprite, building.position);
        }
      }
      placeOnTile(sprite, building.position);
      sprite.zIndex = building.position.x + building.position.y;
    }
    for (const [id, sprite] of this.buildingSprites) {
      if (!present.has(id)) {
        sprite.destroy();
        this.buildingSprites.delete(id);
      }
    }
  }

  private syncMarkers(state: Readonly<GameState>, markers: ReadonlyMap<string, MarkerKind>): void {
    for (const [id, sprite] of this.markerSprites) {
      if (!markers.has(id)) {
        sprite.destroy();
        this.markerSprites.delete(id);
      }
    }
    for (const building of state.city.buildings) {
      const kind = markers.get(building.id);
      if (!kind) continue;
      let marker = this.markerSprites.get(building.id);
      if (!marker) {
        marker = new Sprite();
        marker.cullable = true;
        this.markerLayer.addChild(marker);
        this.markerSprites.set(building.id, marker);
      }
      if (marker.label !== kind) {
        marker.label = kind;
        applyTexture(marker, this.atlas.marker(kind));
      }
      const world = tileToWorld(building.position.x, building.position.y);
      marker.position.set(world.x, world.y - MARKER_OFFSET);
    }
  }

  private refreshOverlay(): void {
    if (!this.state) return;
    const hovered = this.hoveredTile;

    this.hoverOutline.visible = hovered !== null;
    if (hovered) placeOnTile(this.hoverOutline, hovered);

    const selected = this.selectedInstanceId
      ? this.state.city.buildings.find((b) => b.id === this.selectedInstanceId)
      : undefined;
    this.selectionOutline.visible = selected !== undefined;
    if (selected) placeOnTile(this.selectionOutline, selected.position);

    this.refreshDragPreview();
    const showPreview = this.buildModeId !== null && hovered !== null && this.dragBuild === null;
    this.preview.visible = showPreview;
    if (showPreview) {
      const valid = this.callbacks.canPlace(this.buildModeId!, hovered);
      const previewKey = buildingSpriteKey(
        this.buildModeId!,
        this.buildLevel,
        this.state.research.completedTechnologyIds,
      );
      applyTexture(this.preview, this.atlas.building(previewKey));
      placeOnTile(this.preview, hovered);
      this.preview.zIndex = hovered.x + hovered.y + 0.5;
      this.preview.tint = valid ? PREVIEW_VALID : PREVIEW_INVALID;
      this.hoverOutline.tint = valid ? PREVIEW_VALID : PREVIEW_INVALID;
    } else {
      this.hoverOutline.tint = 0xffffff;
    }
  }

  /** Náhľad všetkých políčok ťahania (zelené = dá sa postaviť, červené = nie). */
  private refreshDragPreview(): void {
    const drag = this.dragBuild;
    const positions =
      drag && this.buildModeId
        ? dragPositions(dragShapeFor(this.buildModeId), drag.start, drag.end)
        : [];
    while (this.dragPreview.length < positions.length) {
      const sprite = new Sprite();
      sprite.alpha = 0.7;
      this.buildingLayer.addChild(sprite);
      this.dragPreview.push(sprite);
    }
    const key = this.buildModeId
      ? buildingSpriteKey(
          this.buildModeId,
          this.buildLevel,
          this.state?.research.completedTechnologyIds ?? [],
        )
      : null;
    this.dragPreview.forEach((sprite, i) => {
      const position = positions[i];
      sprite.visible = position !== undefined && key !== null;
      if (!position || !key) return;
      applyTexture(sprite, this.atlas.building(key));
      placeOnTile(sprite, position);
      sprite.zIndex = position.x + position.y + 0.5;
      sprite.tint = this.callbacks.canPlace(this.buildModeId!, position)
        ? PREVIEW_VALID
        : PREVIEW_INVALID;
    });
  }

  // --- Kamera a vstup ---

  private centerOnStart(): void {
    const state = this.state!;
    const anchor = state.city.buildings.find((b) => b.definitionId === 'warehouse')?.position ?? {
      x: Math.floor(state.world.width / 2),
      y: Math.floor(state.world.height / 2),
    };
    const world = tileToWorld(anchor.x, anchor.y);
    this.camera.scale.set(DEFAULT_ZOOM);
    this.camera.position.set(
      this.app.screen.width / 2 - world.x * DEFAULT_ZOOM,
      this.app.screen.height / 2 - world.y * DEFAULT_ZOOM,
    );
    this.clampCamera();
  }

  /** Udrží stred obrazovky v hraniciach mapy. */
  private clampCamera(): void {
    if (!this.state) return;
    const bounds = worldBounds(this.state.world.width, this.state.world.height);
    const scale = this.camera.scale.x;
    const cx = this.app.screen.width / 2;
    const cy = this.app.screen.height / 2;
    const worldCx = Math.min(bounds.maxX, Math.max(bounds.minX, (cx - this.camera.x) / scale));
    const worldCy = Math.min(bounds.maxY, Math.max(bounds.minY, (cy - this.camera.y) / scale));
    // Celé obrazovkové pixely — pixel art ostane ostrý.
    this.camera.position.set(Math.round(cx - worldCx * scale), Math.round(cy - worldCy * scale));
    // Pri oddialení pod 1× sa pixely vyhladzujú — bez toho by medzi políčkami ostávali švy.
    this.atlas.setSmoothing(scale < 1);
    this.callbacks.onCameraChange?.({
      minX: -this.camera.x / scale,
      minY: -this.camera.y / scale,
      maxX: (this.app.screen.width - this.camera.x) / scale,
      maxY: (this.app.screen.height - this.camera.y) / scale,
    });
  }

  /** Presunie kameru tak, aby bol bod (svetové súradnice) v strede obrazovky — minimapa. */
  centerOnWorld(wx: number, wy: number): void {
    const scale = this.camera.scale.x;
    this.camera.position.set(
      this.app.screen.width / 2 - wx * scale,
      this.app.screen.height / 2 - wy * scale,
    );
    this.clampCamera();
  }

  private tileAt(clientX: number, clientY: number): Position | null {
    if (!this.state) return null;
    const rect = this.app.canvas.getBoundingClientRect();
    const wx = (clientX - rect.left - this.camera.x) / this.camera.scale.x;
    const wy = (clientY - rect.top - this.camera.y) / this.camera.scale.y;
    const tile = worldToTile(wx, wy);
    const { width, height } = this.state.world;
    return tile.x >= 0 && tile.y >= 0 && tile.x < width && tile.y < height ? tile : null;
  }

  private setHover(tile: Position | null): void {
    const previous = this.hoveredTile;
    if (previous?.x === tile?.x && previous?.y === tile?.y) return;
    this.hoveredTile = tile;
    this.refreshOverlay();
    this.callbacks.onTileHover(tile);
  }

  /** Priblíženie o jednu úroveň; bod (sx, sy) na plátne zostane na mieste. */
  zoomStep(
    direction: 1 | -1,
    sx = this.app.screen.width / 2,
    sy = this.app.screen.height / 2,
  ): void {
    const oldScale = this.camera.scale.x;
    const level = ZOOM_LEVELS.findIndex((z) => z >= oldScale - 1e-6);
    const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, level + direction));
    const newScale = ZOOM_LEVELS[next]!;
    if (newScale === oldScale) return;
    const wx = (sx - this.camera.x) / oldScale;
    const wy = (sy - this.camera.y) / oldScale;
    this.camera.scale.set(newScale);
    this.camera.position.set(sx - wx * newScale, sy - wy * newScale);
    this.clampCamera();
  }

  private bindInput(): void {
    const canvas = this.app.canvas;

    const pinchState = () => {
      const [a, b] = [...this.touches.values()];
      return {
        distance: Math.hypot(a!.x - b!.x, a!.y - b!.y),
        midX: (a!.x + b!.x) / 2,
        midY: (a!.y + b!.y) / 2,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.touches.size === 2) {
          // Druhý prst: zruší rozpracované ťahanie (bez stavby) a začne gesto.
          if (this.pointer && canvas.hasPointerCapture(this.pointer.id))
            canvas.releasePointerCapture(this.pointer.id);
          this.pointer = null;
          this.dragBuild = null;
          this.refreshOverlay();
          this.pinch = pinchState();
          return;
        }
        if (this.touches.size > 2 || this.pinch) return;
      }
      if (this.pointer || e.button > 2) return;
      // Ľavé tlačidlo v režime stavby kreslí, inak (a pravé/stredné vždy) posúva mapu.
      const mode: 'pan' | 'build' = e.button === 0 && this.buildModeId ? 'build' : 'pan';
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ukazovateľ už nie je aktívny (napr. syntetická udalosť) — pokračuje sa bez zachytenia.
      }
      this.pointer = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        dragging: false,
        mode,
      };
      if (mode === 'build') {
        const tile = this.tileAt(e.clientX, e.clientY);
        if (tile) this.dragBuild = { start: tile, end: tile };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
        this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.pinch && this.touches.size === 2) {
          const now = pinchState();
          this.camera.x += now.midX - this.pinch.midX;
          this.camera.y += now.midY - this.pinch.midY;
          this.pinch.midX = now.midX;
          this.pinch.midY = now.midY;
          // Zoom má pevné úrovne — krok, keď sa prsty dostatočne roztiahnu / stiahnu.
          const ratio = now.distance / this.pinch.distance;
          if (ratio > PINCH_STEP || ratio < 1 / PINCH_STEP) {
            const rect = canvas.getBoundingClientRect();
            this.zoomStep(ratio > 1 ? 1 : -1, now.midX - rect.left, now.midY - rect.top);
            this.pinch.distance = now.distance;
          } else {
            this.clampCamera();
          }
          return;
        }
      }
      const p = this.pointer;
      if (p && p.id === e.pointerId) {
        if (
          !p.dragging &&
          Math.hypot(e.clientX - p.startX, e.clientY - p.startY) >
            (e.pointerType === 'touch' ? TOUCH_DRAG_THRESHOLD : DRAG_THRESHOLD)
        ) {
          p.dragging = true;
          canvas.classList.add('dragging');
        }
        if (p.dragging && p.mode === 'pan') {
          this.camera.x += e.clientX - p.lastX;
          this.camera.y += e.clientY - p.lastY;
          this.clampCamera();
        }
        if (p.mode === 'build' && this.dragBuild) {
          const tile = this.tileAt(e.clientX, e.clientY);
          if (tile && (tile.x !== this.dragBuild.end.x || tile.y !== this.dragBuild.end.y)) {
            this.dragBuild.end = tile;
            this.refreshOverlay();
          }
        }
        p.lastX = e.clientX;
        p.lastY = e.clientY;
      }
      this.setHover(this.tileAt(e.clientX, e.clientY));
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        this.touches.delete(e.pointerId);
        // Gesto končí až keď sa zdvihnú všetky prsty (zvyšný prst nič nespustí).
        if (this.pinch) {
          if (this.touches.size === 0) this.pinch = null;
          return;
        }
      }
      const p = this.pointer;
      if (!p || p.id !== e.pointerId) return;
      this.pointer = null;
      canvas.classList.remove('dragging');
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (p.mode === 'build') {
        const drag = this.dragBuild;
        this.dragBuild = null;
        if (drag && this.buildModeId) {
          this.callbacks.onPlaceMany(
            this.buildModeId,
            dragPositions(dragShapeFor(this.buildModeId), drag.start, drag.end),
          );
        }
        this.refreshOverlay();
      } else if (!p.dragging && e.button === 0) {
        const tile = this.tileAt(e.clientX, e.clientY);
        if (tile) this.callbacks.onTileClick(tile);
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    // Posun mapy šípkami / WASD.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const step = 48;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        a: [step, 0],
        ArrowRight: [-step, 0],
        d: [-step, 0],
        ArrowUp: [0, step],
        w: [0, step],
        ArrowDown: [0, -step],
        s: [0, -step],
      };
      const move = moves[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!move) return;
      e.preventDefault();
      this.camera.x += move[0];
      this.camera.y += move[1];
      this.clampCamera();
    };

    const onPointerLeave = () => {
      if (!this.pointer) this.setHover(null);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (e.deltaY === 0) return;
      this.zoomStep(e.deltaY < 0 ? 1 : -1, sx, sy);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    this.cleanup.push(() => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    });
  }
}
