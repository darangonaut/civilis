import { categoryLabel, t } from '@/app/i18n';
import { gameData } from '@/data';
import { buildingSwatchColor } from '@/renderer/palette';
import { useUiStore } from '@/stores/uiStore';
import { useGameState } from '@/app/useGameState';
import {
  BUILDING_CATEGORIES,
  RESOURCE_IDS,
  type BuildingDefinition,
  type Resources,
} from '@/types';

const SHORT_RESOURCE: Record<string, string> = {
  food: '🌾',
  wood: '🪵',
  stone: '🪨',
  tools: '🔨',
  knowledge: '📜',
};

function formatCost(cost: Partial<Resources>, stock: Resources) {
  return RESOURCE_IDS.filter((id) => cost[id]).map((id) => (
    <span key={id} className={cost[id]! > stock[id] ? 'missing' : ''}>
      {cost[id]} {SHORT_RESOURCE[id]}
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
  const buildings = gameData.buildings.filter((b) => category === 'all' || b.category === category);

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
                      ? t('catalog.locked')
                      : state === 'unaffordable'
                        ? t('catalog.unaffordable')
                        : undefined
                  }
                  data-available={state === 'ok'}
                  aria-pressed={buildModeId === b.id}
                  data-building-id={b.id}
                  onClick={() => setBuildMode(buildModeId === b.id ? null : b.id)}
                >
                  <span
                    className="building-swatch"
                    style={{ background: buildingSwatchColor(b.id) }}
                    aria-hidden
                  />
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
