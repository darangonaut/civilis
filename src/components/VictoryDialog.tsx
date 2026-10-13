import { useEffect, useRef } from 'react';
import { controller } from '@/app/game';
import { t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { useUiStore } from '@/stores/uiStore';

/** Obrazovka úspechu po splnení posledného míľnika. Hra potom pokračuje ako sandbox. */
export function VictoryDialog() {
  const open = useUiStore((s) => s.victoryOpen);
  const setOpen = useUiStore((s) => s.setVictoryOpen);
  const day = useGameState((s) => s.simulation.day);
  const population = useGameState((s) => s.city.population.total);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const continuePlaying = () => {
    setOpen(false);
    controller.setSpeed(1);
  };

  return (
    <dialog
      ref={dialogRef}
      className="victory-dialog"
      data-testid="victory"
      onCancel={continuePlaying}
    >
      <div className="badge" aria-hidden>
        ★
      </div>
      <h2>{t('victory.title')}</h2>
      <p>{t('victory.text')}</p>
      <p className="muted">
        {t('topbar.day')} {day} · {t('topbar.population')} {population}
      </p>
      <button className="primary" onClick={continuePlaying}>
        {t('victory.continue')}
      </button>
    </dialog>
  );
}
