import { categoryLabel, t } from '@/app/i18n';
import { gameData } from '@/data';
import { buildingSwatchColor } from '@/renderer/palette';
import { useUiStore } from '@/stores/uiStore';
import { BUILDING_CATEGORIES } from '@/types';

export function BuildingCatalog() {
  const category = useUiStore((s) => s.catalogCategory);
  const buildModeId = useUiStore((s) => s.buildModeId);
  const setCategory = useUiStore((s) => s.setCatalogCategory);
  const setBuildMode = useUiStore((s) => s.setBuildMode);

  const buildings = gameData.buildings.filter((b) => category === 'all' || b.category === category);

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
          {buildings.map((b) => (
            <li key={b.id}>
              <button
                className={buildModeId === b.id ? 'selected' : ''}
                aria-pressed={buildModeId === b.id}
                data-building-id={b.id}
                onClick={() => setBuildMode(buildModeId === b.id ? null : b.id)}
              >
                <span
                  className="building-swatch"
                  style={{ background: buildingSwatchColor(b.id) }}
                  aria-hidden
                />
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
