import { useEffect, useRef } from 'react';
import { demolishBuildings, demolishRefundTotal } from '@/app/demolish';
import { t } from '@/app/i18n';
import { useUiStore } from '@/stores/uiStore';
import { RESOURCE_IDS } from '@/types';
import { Cost } from './hud/Cost';

/** Potvrdenie hromadného zbúrania (2+ budovy z ťahania v režime búrania). */
export function DemolishDialog() {
  const pending = useUiStore((s) => s.pendingDemolish);
  const setPending = useUiStore((s) => s.setPendingDemolish);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  const refund = pending ? demolishRefundTotal(pending) : {};
  const confirm = () => {
    if (!pending) return;
    setPending(null);
    demolishBuildings(pending);
  };

  return (
    <dialog
      ref={dialogRef}
      className="victory-dialog event-dialog"
      data-testid="demolish-dialog"
      onCancel={() => setPending(null)}
    >
      {pending && (
        <>
          <h2>{t('demolish.confirmTitle', { n: pending.length })}</h2>
          {RESOURCE_IDS.some((id) => (refund[id] ?? 0) > 0) && (
            <p>
              {t('demolish.refund')} <Cost cost={refund} />
            </p>
          )}
          {/* Zrušiť je prvé — po showModal() má fokus, Enter nič nezbúra. */}
          <div className="event-choices">
            <button className="btn" onClick={() => setPending(null)} data-testid="demolish-cancel">
              {t('demolish.cancel')}
            </button>
            <button className="btn danger" onClick={confirm} data-testid="demolish-confirm">
              {t('detail.demolish')}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
