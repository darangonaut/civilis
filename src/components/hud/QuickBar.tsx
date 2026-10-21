import { zoomCamera } from '@/app/camera';
import { techName } from '@/app/names';
import { t, type TranslationKey } from '@/app/i18n';
import { useCompact } from '@/app/useCompact';
import { problemBuildingCount } from '@/app/problems';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { difficultyOf, scaleAmount } from '@/engine';
import { useUiStore, type PanelId } from '@/stores/uiStore';
import { Icon, type IconName } from './Icon';
import { LayerControl } from './LayerControl';
import { cssColor, LAYER_COLORS, layerName, MAP_LAYERS } from '@/app/coverage';
import { MiniMap } from './MiniMap';

const PANELS: { id: PanelId; label: TranslationKey; icon: IconName }[] = [
  { id: 'research', label: 'bottom.research', icon: 'research' },
  { id: 'milestones', label: 'bottom.milestones', icon: 'milestones' },
  { id: 'trade', label: 'bottom.trade', icon: 'trade' },
  { id: 'problems', label: 'bottom.problems', icon: 'alert' },
  { id: 'statistics', label: 'bottom.statistics', icon: 'statistics' },
  { id: 'saves', label: 'bottom.save', icon: 'saves' },
  { id: 'settings', label: 'bottom.settings', icon: 'settings' },
];

/** Vpravo dole: tlačidlá panelov (výskum s priebehom) a minimapa. */
export function QuickBar() {
  const openPanel = useUiStore((s) => s.openPanel);
  const togglePanel = useUiStore((s) => s.togglePanel);
  const demolishMode = useUiStore((s) => s.demolishMode);
  const setDemolishMode = useUiStore((s) => s.setDemolishMode);
  const compact = useCompact();
  const problems = useGameState(() => problemBuildingCount());
  const research = useGameState((s) => {
    const tech = s.research.activeTechnologyId
      ? gameData.technologiesById.get(s.research.activeTechnologyId)
      : undefined;
    return tech
      ? {
          name: techName(tech.id),
          ratio:
            s.research.investedKnowledge /
            scaleAmount(tech.cost, difficultyOf(s, gameData).researchCost),
        }
      : null;
  });

  if (compact) return <CompactBar problems={problems} researchIdle={!research} />;

  return (
    <div className="hud-right-bottom">
      <nav className="quick-bar" data-testid="bottom-bar" aria-label={t('hud.panels')}>
        {PANELS.map((panel) => {
          const label = t(panel.label);
          const title =
            panel.id === 'research'
              ? `${label}: ${research ? `${research.name} (${Math.floor(research.ratio * 100)} %)` : t('research.noneActive')}`
              : label;
          return (
            <button
              key={panel.id}
              className={`quick-button${openPanel === panel.id ? ' active' : ''}${panel.id === 'research' && !research ? ' attention' : ''}`}
              aria-pressed={openPanel === panel.id}
              aria-label={label}
              title={title}
              onClick={() => togglePanel(panel.id)}
              data-testid={`open-${panel.id}`}
            >
              <Icon name={panel.icon} size={22} />
              {panel.id === 'problems' && problems > 0 && (
                <span className="quick-badge" data-testid="problem-count">
                  {problems > 99 ? '99+' : problems}
                </span>
              )}
              {panel.id === 'research' && research && (
                <span className="quick-progress">
                  <span style={{ width: `${Math.min(1, research.ratio) * 100}%` }} />
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="map-tools">
        <button
          className={`quick-button small${demolishMode ? ' active' : ''}`}
          onClick={() => setDemolishMode(!demolishMode)}
          aria-pressed={demolishMode}
          aria-label={t('hud.demolishMode')}
          title={t('hud.demolishHint')}
          data-testid="demolish-mode"
        >
          <Icon name="demolish" size={18} />
        </button>
        <LayerControl />
        <div className="zoom-buttons">
          <button
            className="quick-button small"
            onClick={() => zoomCamera(1)}
            aria-label={t('hud.zoomIn')}
            title={t('hud.zoomIn')}
          >
            +
          </button>
          <button
            className="quick-button small"
            onClick={() => zoomCamera(-1)}
            aria-label={t('hud.zoomOut')}
            title={t('hud.zoomOut')}
          >
            −
          </button>
        </div>
      </div>
      <MiniMap />
    </div>
  );
}

/**
 * Mobil: namiesto stĺpca tlačidiel tri plávajúce — Stavať, Menu (panely, vrstvy, zoom)
 * a Búrať. Kým sa stavia alebo je otvorený dok, tlačidlá ustúpia.
 */
function CompactBar({ problems, researchIdle }: { problems: number; researchIdle: boolean }) {
  const dockOpen = useUiStore((s) => s.dockOpen);
  const setDockOpen = useUiStore((s) => s.setDockOpen);
  const building = useUiStore((s) => s.buildModeId !== null);
  const menuOpen = useUiStore((s) => s.menuOpen);
  const setMenuOpen = useUiStore((s) => s.setMenuOpen);
  const demolishMode = useUiStore((s) => s.demolishMode);
  const setDemolishMode = useUiStore((s) => s.setDemolishMode);

  return (
    <>
      {!dockOpen && !building && (
        <div className="compact-bar">
          <button
            className={`quick-button small${demolishMode ? ' active' : ''}`}
            onClick={() => setDemolishMode(!demolishMode)}
            aria-pressed={demolishMode}
            aria-label={t('hud.demolishMode')}
            data-testid="demolish-mode"
          >
            <Icon name="demolish" size={18} />
          </button>
          <button
            className="quick-button"
            onClick={() => setMenuOpen(true)}
            aria-label={t('hud.menu')}
            data-testid="open-menu"
          >
            <Icon name="menu" size={22} />
            {(problems > 0 || researchIdle) && (
              <span className="quick-badge" data-testid="menu-badge">
                {problems > 0 ? (problems > 99 ? '99+' : problems) : '!'}
              </span>
            )}
          </button>
          <button
            className="quick-button build-button"
            onClick={() => {
              setDemolishMode(false);
              setDockOpen(true);
            }}
            aria-label={t('hud.build')}
            data-testid="open-dock"
          >
            <Icon name="hammer" size={22} />
            <span>{t('hud.build')}</span>
          </button>
        </div>
      )}
      {menuOpen && (
        <MenuSheet
          problems={problems}
          researchIdle={researchIdle}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </>
  );
}

function MenuSheet({
  problems,
  researchIdle,
  onClose,
}: {
  problems: number;
  researchIdle: boolean;
  onClose: () => void;
}) {
  const togglePanel = useUiStore((s) => s.togglePanel);
  const layer = useUiStore((s) => s.mapLayer);
  const setLayer = useUiStore((s) => s.setMapLayer);

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <section
        className="hud-panel menu-sheet"
        data-testid="menu-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="menu-grid">
          {PANELS.map((panel) => (
            <button
              key={panel.id}
              className={`menu-item${panel.id === 'research' && researchIdle ? ' attention' : ''}`}
              data-testid={`open-${panel.id}`}
              onClick={() => {
                onClose();
                togglePanel(panel.id);
              }}
            >
              <Icon name={panel.icon} size={24} />
              <span>{t(panel.label)}</span>
              {panel.id === 'problems' && problems > 0 && (
                <span className="quick-badge" data-testid="problem-count">
                  {problems > 99 ? '99+' : problems}
                </span>
              )}
            </button>
          ))}
        </div>
        <span className="hud-caption">{t('layers.title')}</span>
        <div className="menu-layers">
          {[null, ...MAP_LAYERS].map((type) => (
            <button
              key={type ?? 'none'}
              aria-pressed={layer === type}
              className={layer === type ? 'active' : ''}
              data-testid={`layer-${type ?? 'none'}`}
              onClick={() => {
                setLayer(type);
                onClose();
              }}
            >
              <span
                className="layer-swatch"
                style={{ background: type ? cssColor(LAYER_COLORS[type]) : 'transparent' }}
              />
              <span className="capitalize">{type ? layerName(type) : t('layers.none')}</span>
            </button>
          ))}
        </div>
        <div className="menu-footer">
          <span className="hud-caption">{t('hud.zoom')}</span>
          <button
            className="quick-button small"
            onClick={() => zoomCamera(-1)}
            aria-label={t('hud.zoomOut')}
          >
            −
          </button>
          <button
            className="quick-button small"
            onClick={() => zoomCamera(1)}
            aria-label={t('hud.zoomIn')}
          >
            +
          </button>
          <button className="btn menu-close" onClick={onClose} data-testid="close-menu">
            <Icon name="close" size={14} /> {t('hud.closeDock')}
          </button>
        </div>
      </section>
    </div>
  );
}
