import type { ReactNode } from 'react';
import { t } from '@/app/i18n';
import { useUiStore } from '@/stores/uiStore';

/** Spoločný rám panelov otváraných zo spodnej lišty (prekrýva mapu). */
export function PanelFrame({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  const close = useUiStore((s) => s.togglePanel);
  return (
    <section className="overlay-panel" data-testid={testId} aria-label={title}>
      <header className="overlay-panel-header">
        <h2>{title}</h2>
        <button
          onClick={() => close(null)}
          aria-label={t('common.close')}
          title={t('common.close')}
        >
          ✕
        </button>
      </header>
      <div className="overlay-panel-body">{children}</div>
    </section>
  );
}
