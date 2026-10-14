import { controller } from '@/app/game';
import { buildingName } from '@/app/names';
import { problemLabel, t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { useUiStore } from '@/stores/uiStore';

/** Informácia o políčku a budove pod kurzorom — vrátane dôvodu výstražnej značky. */
export function MapInfo() {
  const hovered = useUiStore((s) => s.hoveredTile);
  const buildModeId = useUiStore((s) => s.buildModeId);
  const info = useGameState((state) => {
    if (!hovered) return null;
    const tile = state.world.tiles[hovered.y * state.world.width + hovered.x];
    if (!tile) return null;
    const building = tile.buildingId
      ? state.city.buildings.find((b) => b.id === tile.buildingId)
      : undefined;
    const definition = building ? gameData.buildingsById.get(building.definitionId) : undefined;
    const problems = building
      ? (controller.analysis.statuses.get(building.id)?.problems ?? []).filter(
          (p) => p.code !== 'disabled',
        )
      : [];
    return {
      tile,
      buildingName:
        building && definition ? buildingName(building.definitionId, building.level) : null,
      problems,
      canUpgrade: building ? controller.upgradable.has(building.id) : false,
    };
  });
  const buildLevel = useUiStore((s) => s.buildLevel);
  const buildName = buildModeId ? buildingName(buildModeId, buildLevel) : undefined;

  if (!info && !buildName) return null;
  return (
    <div className="map-info" data-testid="map-info">
      {buildName && (
        <div>
          <span className="muted">{t('map.buildMode')}:</span> {buildName}
        </div>
      )}
      {info?.buildingName && (
        <div className="map-info-building">
          <strong>{info.buildingName}</strong>
          {info.problems.length > 0 ? (
            info.problems.map((problem, i) => (
              <div key={i} className="map-info-problem">
                ⚠ {problemLabel(problem)}
              </div>
            ))
          ) : (
            <div className="map-info-ok">✓ {t('map.ok')}</div>
          )}
          {info.canUpgrade && <div className="map-info-upgrade">⬆ {t('map.canUpgrade')}</div>}
        </div>
      )}
      {info && hovered && (
        <div className="muted">
          {t('map.tile')} [{hovered.x}, {hovered.y}] · {t(`terrain.${info.tile.terrain}`)} ·{' '}
          {t('map.fertility')} {info.tile.fertility}
        </div>
      )}
    </div>
  );
}
