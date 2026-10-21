import { formatAmount } from '@/app/format';
import { buildingName, techName } from '@/app/names';
import { categoryLabel, effectLabel, t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import {
  buildCostAtLevel,
  buildingEraIndex,
  currentEraIndex,
  effectiveDefinition,
  maxLevel,
  nextLevel,
  technologiesForLevel,
  difficultyOf,
} from '@/engine';
import { useUiStore } from '@/stores/uiStore';
import { useCompact } from '@/app/useCompact';
import { clearPendingBuild, confirmPendingBuild } from '@/app/camera';
import {
  BUILDING_CATEGORIES,
  RESOURCE_IDS,
  type BuildingDefinition,
  type Resources,
} from '@/types';
import { BuildingIcon } from '../BuildingIcon';
import { Cost } from './Cost';
import { Icon } from './Icon';

interface DockTile {
  definition: BuildingDefinition;
  level: number;
  locked: boolean;
  /** Div sveta, ktorý už v meste stojí. */
  built: boolean;
  cost: Partial<Resources>;
}

/** Dlaždice kategórie: budovy dostupných ér + vyššie úrovne, ktoré už má hráč odomknuté. */
function dockTiles(
  category: string,
  eraIndex: number,
  completed: readonly string[],
  builtWonders: ReadonlySet<string>,
  costFactor: number,
): DockTile[] {
  const tiles: DockTile[] = [];
  for (const definition of gameData.buildings) {
    if (definition.category !== category || buildingEraIndex(gameData, definition.id) > eraIndex)
      continue;
    const locked =
      !!definition.requiredTechnologyId && !completed.includes(definition.requiredTechnologyId);
    const built = builtWonders.has(definition.id);
    tiles.push({
      definition,
      level: 1,
      locked,
      built,
      cost: buildCostAtLevel(definition, 1, costFactor),
    });
    if (locked) continue;
    for (let level = 2; level <= maxLevel(definition); level++) {
      if (!technologiesForLevel(definition, level).every((id) => completed.includes(id))) break;
      tiles.push({
        definition,
        level,
        locked: false,
        built: false,
        cost: buildCostAtLevel(definition, level, costFactor),
      });
    }
  }
  return tiles;
}

const affordable = (cost: Partial<Resources>, stock: Resources) =>
  RESOURCE_IDS.every((id) => (cost[id] ?? 0) <= stock[id]);

let touchHintShown = false;

/** Na dotykovej obrazovke raz vysvetlí ovládanie stavby (žiadne prejdenie myšou). */
function showTouchHint(): void {
  if (touchHintShown || !window.matchMedia('(pointer: coarse)').matches) return;
  touchHintShown = true;
  useUiStore.getState().showNotice(t('hud.touchBuildHint'));
}

/** Stavebný dok dole: záložky kategórií a dlaždice budov s ikonou a cenou. */
export function BuildDock() {
  const category = useUiStore((s) => s.catalogCategory);
  const buildModeId = useUiStore((s) => s.buildModeId);
  const buildLevel = useUiStore((s) => s.buildLevel);
  const hovered = useUiStore((s) => s.hoveredDockTile);
  const setCategory = useUiStore((s) => s.setCatalogCategory);
  const setBuildMode = useUiStore((s) => s.setBuildMode);
  const setHovered = useUiStore((s) => s.setHoveredDockTile);

  const resources = useGameState((s) => s.city.economy.resources);
  const completed = useGameState((s) => s.research.completedTechnologyIds);
  const eraIndex = useGameState((s) => currentEraIndex(s, gameData));
  const builtKey = useGameState((s) =>
    s.city.buildings
      .filter((b) => gameData.buildingsById.get(b.definitionId)?.wonder)
      .map((b) => b.definitionId)
      .join(','),
  );
  const costFactor = useGameState((s) => difficultyOf(s, gameData).constructionCost);
  const tiles = dockTiles(category, eraIndex, completed, new Set(builtKey.split(',')), costFactor);
  const tooltipTile =
    tiles.find((tile) => tile.definition.id === hovered?.id && tile.level === hovered.level) ??
    tiles.find((tile) => tile.definition.id === buildModeId && tile.level === buildLevel);
  const compact = useCompact();
  const dockOpen = useUiStore((s) => s.dockOpen);
  const setDockOpen = useUiStore((s) => s.setDockOpen);
  const pending = useUiStore((s) => s.pendingBuild);

  // Mobil: dok sa otvára tlačidlom Stavať; počas stavby je z neho úzky pruh s potvrdením.
  if (compact && buildModeId) {
    const tile = tooltipTile;
    return (
      <div className="build-dock-wrap">
        <section className="hud-panel build-bar" data-testid="build-bar">
          <span className="build-bar-icon">
            <BuildingIcon
              spriteKey={buildLevel > 1 ? `${buildModeId}@${buildLevel}` : buildModeId}
            />
          </span>
          <div className="build-bar-text">
            <strong>{buildingName(buildModeId, buildLevel)}</strong>
            {tile && <Cost cost={tile.cost} stock={resources} limit={3} />}
            {pending === null && <span className="muted">{t('hud.tapToPlace')}</span>}
          </div>
          <button
            className="btn primary build-confirm"
            disabled={pending === null}
            onClick={confirmPendingBuild}
            data-testid="confirm-build"
          >
            <Icon name="check" size={16} /> {t('hud.confirmBuild')}
            {pending !== null && pending > 1 && ` (${pending})`}
          </button>
          <button
            className="icon-button"
            onClick={() => {
              if (pending !== null) clearPendingBuild();
              else setBuildMode(null);
            }}
            aria-label={t('hud.cancelBuild')}
            data-testid="cancel-build"
          >
            <Icon name="close" size={16} />
          </button>
        </section>
      </div>
    );
  }
  if (compact && !dockOpen) return null;

  return (
    <div className="build-dock-wrap">
      {tooltipTile && <DockTooltip tile={tooltipTile} stock={resources} />}
      <section className="hud-panel build-dock" data-testid="building-catalog">
        <div className="dock-tabs" role="tablist" aria-label={t('catalog.title')}>
          {BUILDING_CATEGORIES.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              className={category === c ? 'active' : ''}
              onClick={() => setCategory(c)}
              data-category={c}
            >
              {categoryLabel(c)}
            </button>
          ))}
          {!buildModeId && <span className="dock-hint">{t('hud.dockHint')}</span>}
          {buildModeId && (
            <button
              className="dock-cancel"
              onClick={() => setBuildMode(null)}
              data-testid="cancel-build"
              title={t('hud.cancelBuild')}
            >
              <Icon name="close" size={14} /> {t('hud.cancelBuild')}
            </button>
          )}
          {compact && !buildModeId && (
            <button
              className="dock-cancel"
              onClick={() => setDockOpen(false)}
              data-testid="close-dock"
              aria-label={t('hud.closeDock')}
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
        <div className="dock-tiles" onMouseLeave={() => setHovered(null)}>
          {tiles.length === 0 && <p className="muted">{t('catalog.empty')}</p>}
          {tiles.map((tile) => {
            const { definition, level, locked, built, cost } = tile;
            const selected = buildModeId === definition.id && buildLevel === level;
            const canAfford = affordable(cost, resources);
            const name = buildingName(definition.id, level);
            return (
              <button
                key={`${definition.id}@${level}`}
                className={`dock-tile${selected ? ' selected' : ''}${locked || built ? ' locked' : ''}${!locked && !canAfford ? ' unaffordable' : ''}`}
                aria-pressed={selected}
                aria-label={name}
                disabled={locked || built}
                data-building-id={level === 1 ? definition.id : undefined}
                data-building-level={`${definition.id}@${level}`}
                data-available={!locked && !built && canAfford}
                onMouseEnter={() => setHovered({ id: definition.id, level })}
                onFocus={() => setHovered({ id: definition.id, level })}
                onClick={() => {
                  setBuildMode(selected ? null : definition.id, level);
                  if (!selected) showTouchHint();
                }}
              >
                <span className="dock-tile-icon">
                  <BuildingIcon
                    spriteKey={level > 1 ? `${definition.id}@${level}` : definition.id}
                  />
                </span>
                {level > 1 && <span className="dock-tile-level">{level}</span>}
                <span className="dock-tile-cost">
                  {built ? (
                    <span className="dock-built">✓</span>
                  ) : locked ? (
                    <Icon name="lock" size={14} />
                  ) : (
                    <Cost cost={cost} stock={resources} limit={2} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function DockTooltip({ tile, stock }: { tile: DockTile; stock: Resources }) {
  const { definition: base, level, locked, cost } = tile;
  const maintenanceFactor = useGameState((s) => difficultyOf(s, gameData).maintenance);
  const definition = effectiveDefinition(base, level);
  const services = level > 1 ? (nextLevel(base, level - 1)?.requiredServices ?? []) : [];
  const tech = locked ? gameData.technologiesById.get(base.requiredTechnologyId!) : undefined;
  const amounts = (resources: Partial<Resources>) =>
    RESOURCE_IDS.filter((id) => (resources[id] ?? 0) > 0)
      .map((id) => `${formatAmount(resources[id]!)} ${t(`resourceGenitive.${id}`)}`)
      .join(', ');

  return (
    <div className="hud-panel dock-tooltip" role="tooltip" data-testid="dock-tooltip">
      <div className="tooltip-head">
        <span className="tooltip-title">{buildingName(base.id, level)}</span>
        <span className="muted">
          {categoryLabel(base.category)}
          {maxLevel(base) > 1 && ` · ${t('detail.level')} ${level}`}
        </span>
      </div>
      {locked && tech && (
        <span className="tooltip-note warn">
          <Icon name="lock" size={13} /> {t('catalog.locked')}: {techName(tech.id)}
        </span>
      )}
      {level > 1 && <span className="tooltip-note">{t('hud.directBuild')}</span>}
      {base.wonder && (
        <>
          <span className="tooltip-note">{t('wonder.unique')}</span>
          <ul className="wonder-effects">
            {base.wonder.effects.map((effect, i) => (
              <li key={i}>{effectLabel(effect)}</li>
            ))}
            {base.wonder.happiness && (
              <li>{t('wonder.happiness', { n: base.wonder.happiness })}</li>
            )}
          </ul>
        </>
      )}
      {base.connectsAdjacent && <span className="tooltip-note">{t('hud.connectsAdjacent')}</span>}
      {base.id === 'road' && <span className="tooltip-note">{t('hud.bridgeHint')}</span>}
      {(base.service || base.pollution) && (
        <span className="tooltip-note">{t('hud.rangeHint')}</span>
      )}
      <dl className="tooltip-grid">
        <dt>{t('detail.cost')}</dt>
        <dd>
          <Cost cost={cost} stock={stock} />
        </dd>
        {Object.keys(definition.outputs).length > 0 && (
          <>
            <dt>{t('detail.outputs')}</dt>
            <dd>{amounts(definition.outputs)}</dd>
          </>
        )}
        {Object.keys(definition.inputs).length > 0 && (
          <>
            <dt>{t('detail.inputs')}</dt>
            <dd>{amounts(definition.inputs)}</dd>
          </>
        )}
        {definition.moneyOutput > 0 && (
          <>
            <dt>{t('detail.moneyOutput')}</dt>
            <dd>{formatAmount(definition.moneyOutput)}</dd>
          </>
        )}
        {definition.housingCapacity > 0 && (
          <>
            <dt>{t('detail.housing')}</dt>
            <dd>{definition.housingCapacity}</dd>
          </>
        )}
        {definition.storageCapacity > 0 && (
          <>
            <dt>{t('detail.storage')}</dt>
            <dd>+{definition.storageCapacity}</dd>
          </>
        )}
        {definition.service && (
          <>
            <dt>{t('detail.serviceRadius')}</dt>
            <dd>
              {t(`service.${definition.service.type}`)}, {definition.service.radius}
            </dd>
          </>
        )}
        {definition.workersRequired > 0 && (
          <>
            <dt>{t('detail.workers')}</dt>
            <dd>{definition.workersRequired}</dd>
          </>
        )}
        {definition.maintenanceCost > 0 && (
          <>
            <dt>{t('detail.maintenance')}</dt>
            <dd>{formatAmount(definition.maintenanceCost * maintenanceFactor)}</dd>
          </>
        )}
        {definition.needs && (
          <>
            <dt>{t('needs.title')}</dt>
            <dd>
              {amounts(
                Object.fromEntries(
                  Object.entries(definition.needs).map(([id, perResident]) => [
                    id,
                    perResident * definition.housingCapacity,
                  ]),
                ),
              )}{' '}
              / {t('topbar.perDay')}
            </dd>
          </>
        )}
        {definition.pollution && (
          <>
            <dt>{t('pollution.label')}</dt>
            <dd>{t('pollution.range', definition.pollution)}</dd>
          </>
        )}
        {services.length > 0 && (
          <>
            <dt>{t('detail.requires')}</dt>
            <dd>{services.map((s) => t(`detail.service.${s}`)).join(', ')}</dd>
          </>
        )}
        <dt>{t('detail.terrain')}</dt>
        <dd>{base.allowedTerrain.map((terrain) => t(`terrain.${terrain}`)).join(', ')}</dd>
      </dl>
    </div>
  );
}
