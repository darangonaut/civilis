import { t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { useUiStore } from '@/stores/uiStore';

/** Informácia o políčku pod kurzorom a aktívnom režime výstavby. */
export function MapInfo() {
  const hovered = useUiStore((s) => s.hoveredTile);
  const buildModeId = useUiStore((s) => s.buildModeId);
  const tile = useGameState((state) =>
    hovered ? state.world.tiles[hovered.y * state.world.width + hovered.x] : undefined,
  );
  const buildName = buildModeId ? gameData.buildingsById.get(buildModeId)?.name : undefined;

  if (!tile && !buildName) return null;
  return (
    <div className="map-info" data-testid="map-info">
      {buildName && (
        <div>
          <span className="muted">{t('map.buildMode')}:</span> {buildName}
        </div>
      )}
      {tile && hovered && (
        <div>
          <span className="muted">{t('map.tile')}</span> [{hovered.x}, {hovered.y}] ·{' '}
          {t(`terrain.${tile.terrain}`)} · {t('map.fertility')} {tile.fertility}
        </div>
      )}
    </div>
  );
}
