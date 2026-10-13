import { categoryLabel, t } from '@/app/i18n';
import { gameData } from '@/data';
import { useUiStore } from '@/stores/uiStore';
import { BuildingIcon } from './BuildingIcon';
import { useGameState } from '@/app/useGameState';
import { buildingEraIndex, currentEraIndex } from '@/engine';
import { ResourceIcon } from './ResourceIcon';
import {
  BUILDING_CATEGORIES,
  RESOURCE_IDS,
  type BuildingDefinition,
  type Resources,
} from '@/types';

function formatCost(cost: Partial<Resources>, stock: Resources) {
  return RESOURCE_IDS.filter((id) => cost[id]).map((id) => (
    <span key={id} className={cost[id]! > stock[id] ? 'missing' : ''}>
      {cost[id]}
      <ResourceIcon kind={id} />
    </span>
  ));
}

export function BuildingCatalog() {
  const category = useUiStore((s) => s.catalogCategory);
  const buildModeId = useUiStore((s) => s.buildModeId);
  const setCategory = useUiStore((s) => s.setCatalogCategory);
  const setBuildMode = useUiStore((s) => s.setBuildMode);

  const resources = useGameState((s) => s.city.economy.resources);
  const completedTech = useGameState((s) => s.research.completedTechnologyIds);
  const eraIndex = useGameState((s) => currentEraIndex(s, gameData));
  // Budovy budúcich ér sa nezobrazujú; budovy aktuálnej éry čakajúce na technológiu sú zamknuté.
  const buildings = gameData.buildings.filter(
    (b) =>
      (category === 'all' || b.category === category) &&
      buildingEraIndex(gameData, b.id) <= eraIndex,
  );

  const availability = (b: BuildingDefinition): 'ok' | 'locked' | 'unaffordable' => {
    if (b.requiredTechnologyId && !completedTech.includes(b.requiredTechnologyId)) return 'locked';
    return RESOURCE_IDS.every((id) => (b.constructionCost[id] ?? 0) <= resources[id])
      ? 'ok'
      : 'unaffordable';
  };

  return (
    <aside className="left-panel" data-testid="building-catalog">
      <h2>{t('catalog.title')}</h2>
      <div className="category-filter" role="tablist">
        {(['all', ...BUILDING_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={category === c}
            className={category === c ? 'active' : ''}
            onClick={() => setCategory(c)}
          >
            {c === 'all' ? t('catalog.all') : categoryLabel(c)}
          </button>
        ))}
      </div>
      {buildings.length === 0 ? (
        <p className="muted">{t('catalog.empty')}</p>
      ) : (
        <ul className="building-list">
          {buildings.map((b) => {
            const state = availability(b);
            return (
              <li key={b.id}>
                <button
                  className={`${buildModeId === b.id ? 'selected' : ''} ${state !== 'ok' ? 'unavailable' : ''}`}
                  title={
                    state === 'locked'
                      ? `${t('catalog.locked')}: ${gameData.technologiesById.get(b.requiredTechnologyId!)?.name ?? ''}`
                      : state === 'unaffordable'
                        ? t('catalog.unaffordable')
                        : undefined
                  }
                  data-available={state === 'ok'}
                  aria-pressed={buildModeId === b.id}
                  data-building-id={b.id}
                  onClick={() => setBuildMode(buildModeId === b.id ? null : b.id)}
                >
                  <BuildingIcon definitionId={b.id} />
                  <span className="building-name">{b.name}</span>
                  <span className="building-cost">{formatCost(b.constructionCost, resources)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
