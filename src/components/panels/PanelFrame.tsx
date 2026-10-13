import type { ReactNode } from 'react';
import { t } from '@/app/i18n';
import { useUiStore } from '@/stores/uiStore';
import { Icon } from '../hud/Icon';

/** Spoločné modálne okno panelov (výskum, míľniky, štatistiky…) v strede nad mapou. */
export function PanelFrame({
  title,
  testId,
  wide,
  header,
  children,
}: {
  title: string;
  testId: string;
  /** Široké okno (strom výskumu). */
  wide?: boolean;
  /** Doplnok hlavičky vedľa názvu. */
  header?: ReactNode;
  children: ReactNode;
}) {
  const close = useUiStore((s) => s.togglePanel);
  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => e.target === e.currentTarget && close(null)}
    >
      <section
        className={`hud-panel modal${wide ? ' wide' : ''}`}
        data-testid={testId}
        aria-label={title}
        role="dialog"
      >
        <header className="modal-header">
          <h2>{title}</h2>
          {header}
          <button
            className="icon-button boxed"
            onClick={() => close(null)}
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
