import { t, type TranslationKey } from '@/app/i18n';

const ACTIONS: TranslationKey[] = [
  'bottom.research',
  'bottom.milestones',
  'bottom.statistics',
  'bottom.save',
  'bottom.settings',
];

// Akcie sa sprístupnia v etapách 4–6.
export function BottomBar() {
  return (
    <footer className="bottom-bar" data-testid="bottom-bar">
      {ACTIONS.map((key) => (
        <button key={key} disabled title={t('common.notYetAvailable')}>
          {t(key)}
        </button>
      ))}
    </footer>
  );
}
