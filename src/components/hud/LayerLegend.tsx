import { coverageOverlay, cssColor, effectiveLayer, LAYER_COLORS, layerName } from '@/app/coverage';
import { t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { useUiStore } from '@/stores/uiStore';
import { Icon } from './Icon';

/** Legenda zapnutej vrstvy: farby a podiel bývania v dosahu služby. */
export function LayerLegend() {
  const buildModeId = useUiStore((s) => s.buildModeId);
  const mapLayer = useUiStore((s) => s.mapLayer);
  const setLayer = useUiStore((s) => s.setMapLayer);
  const layer = effectiveLayer(buildModeId, mapLayer);
  const share = useGameState(() => (layer ? coverageOverlay(layer).share : 0));
  if (!layer) return null;
  const automatic = layer !== mapLayer;

  return (
    <section className="hud-panel layer-legend" data-testid="layer-legend">
      <div className="layer-legend-head">
        <span className="hud-caption">
          {t('layers.title')}: <span className="capitalize">{layerName(layer)}</span>
        </span>
        {!automatic && (
          <button
            className="icon-button"
            onClick={() => setLayer(null)}
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      <span className="layer-row">
        <span className="layer-swatch" style={{ background: cssColor(LAYER_COLORS[layer]) }} />
        {layer === 'pollution' ? t('layers.pollutedTiles') : t('layers.covered')}
      </span>
      <span className="layer-row">
        <span className="layer-swatch missing" />
        {layer === 'pollution' ? t('layers.pollutedHomes') : t('layers.missing')}
      </span>
      <span className="layer-share">
        {t(layer === 'pollution' ? 'layers.clean' : 'layers.share', {
          percent: Math.round(share * 100),
        })}
      </span>
    </section>
  );
}
