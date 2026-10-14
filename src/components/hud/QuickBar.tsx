import { zoomCamera } from '@/app/camera';
import { techName } from '@/app/names';
import { t, type TranslationKey } from '@/app/i18n';
import { useCompact } from '@/app/useCompact';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { useUiStore, type PanelId } from '@/stores/uiStore';
import { Icon, type IconName } from './Icon';
import { MiniMap } from './MiniMap';

const PANELS: { id: PanelId; label: TranslationKey; icon: IconName }[] = [
  { id: 'research', label: 'bottom.research', icon: 'research' },
  { id: 'milestones', label: 'bottom.milestones', icon: 'milestones' },
  { id: 'statistics', label: 'bottom.statistics', icon: 'statistics' },
  { id: 'saves', label: 'bottom.save', icon: 'saves' },
  { id: 'settings', label: 'bottom.settings', icon: 'settings' },
];

/** Vpravo dole: tlačidlá panelov (výskum s priebehom) a minimapa. */
export function QuickBar() {
  const openPanel = useUiStore((s) => s.openPanel);
  const togglePanel = useUiStore((s) => s.togglePanel);
  const compact = useCompact();
  const research = useGameState((s) => {
    const tech = s.research.activeTechnologyId
      ? gameData.technologiesById.get(s.research.activeTechnologyId)
      : undefined;
    return tech
      ? { name: techName(tech.id), ratio: s.research.investedKnowledge / tech.cost }
      : null;
  });

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
              {panel.id === 'research' && research && (
                <span className="quick-progress">
                  <span style={{ width: `${Math.min(1, research.ratio) * 100}%` }} />
                </span>
              )}
            </button>
          );
        })}
      </nav>
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
      {!compact && <MiniMap />}
    </div>
  );
}
