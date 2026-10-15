import { useState } from 'react';
import { cssColor, LAYER_COLORS, layerName, MAP_LAYERS } from '@/app/coverage';
import { t } from '@/app/i18n';
import { useUiStore } from '@/stores/uiStore';
import { Icon } from './Icon';

/** Tlačidlo mapových vrstiev s ponukou služieb. */
export function LayerControl() {
  const [open, setOpen] = useState(false);
  const layer = useUiStore((s) => s.mapLayer);
  const setLayer = useUiStore((s) => s.setMapLayer);

  return (
    <div className="layer-control">
      {open && (
        <div className="hud-panel layer-menu" role="menu" data-testid="layer-menu">
          <span className="hud-caption">{t('layers.title')}</span>
          {[null, ...MAP_LAYERS].map((type) => (
            <button
              key={type ?? 'none'}
              role="menuitemradio"
              aria-checked={layer === type}
              className={layer === type ? 'active' : ''}
              onClick={() => {
                setLayer(type);
                setOpen(false);
              }}
              data-testid={`layer-${type ?? 'none'}`}
            >
              <span
                className="layer-swatch"
                style={{ background: type ? cssColor(LAYER_COLORS[type]) : 'transparent' }}
              />
              <span className="capitalize">{type ? layerName(type) : t('layers.none')}</span>
            </button>
          ))}
        </div>
      )}
      <button
        className={`quick-button small${layer ? ' active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label={t('layers.title')}
        aria-expanded={open}
        title={t('layers.title')}
        data-testid="open-layers"
      >
        <Icon name="layers" size={18} />
      </button>
    </div>
  );
}
