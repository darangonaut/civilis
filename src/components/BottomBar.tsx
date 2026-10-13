import { t, type TranslationKey } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { currentMilestone } from '@/engine';
import { useUiStore, type PanelId } from '@/stores/uiStore';

const PANELS: { id: PanelId; label: TranslationKey }[] = [
  { id: 'research', label: 'bottom.research' },
  { id: 'milestones', label: 'bottom.milestones' },
  { id: 'statistics', label: 'bottom.statistics' },
];

export function BottomBar() {
  const openPanel = useUiStore((s) => s.openPanel);
  const togglePanel = useUiStore((s) => s.togglePanel);
  const activeTech = useGameState((s) => s.research.activeTechnologyId);
  const milestone = useGameState((s) => currentMilestone(s, gameData));

  return (
    <footer className="bottom-bar" data-testid="bottom-bar">
      {PANELS.map((panel) => (
        <button
          key={panel.id}
          className={openPanel === panel.id ? 'active' : ''}
          aria-pressed={openPanel === panel.id}
          onClick={() => togglePanel(panel.id)}
          data-testid={`open-${panel.id}`}
        >
          {t(panel.label)}
        </button>
      ))}
      {/* Ukladanie a nastavenia pribudnú v etape 6. */}
      <button disabled title={t('common.notYetAvailable')}>
        {t('bottom.save')}
      </button>
      <button disabled title={t('common.notYetAvailable')}>
        {t('bottom.settings')}
      </button>
      <div className="bottom-status">
        <span>
          <span className="muted">{t('research.title')}:</span>{' '}
          {activeTech ? gameData.technologiesById.get(activeTech)?.name : '—'}
        </span>
        <span>
          <span className="muted">{t('milestones.current')}:</span> {milestone?.title ?? '✓'}
        </span>
      </div>
    </footer>
  );
}
