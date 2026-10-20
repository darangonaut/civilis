import { useEffect, useRef } from 'react';
import { controller } from '@/app/game';
import { t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { useUiStore } from '@/stores/uiStore';
import { gameData } from '@/data';
import { cityRecord, cityScore, nextPlanet } from '@/engine';
import type { CityRecord } from '@/types';

/** Obrazovka úspechu po splnení posledného míľnika. Hra potom pokračuje ako sandbox. */
export function VictoryDialog() {
  const open = useUiStore((s) => s.victoryOpen);
  const setOpen = useUiStore((s) => s.setVictoryOpen);
  const openColony = useUiStore((s) => s.setColonyOpen);
  const day = useGameState((s) => s.simulation.day);
  const population = useGameState((s) => s.city.population.total);
  const finishedDay = useGameState((s) => s.achievements.finishedDay);
  const score = useGameState((s) => cityScore(s, gameData));
  const hasNext = useGameState((s) => nextPlanet(s, gameData) !== null);
  const history = useGameState((s) => s.colony.history);
  // Posledný svet: kronika celej ságy vrátane terajšieho mesta.
  const saga = !hasNext && history.length > 0;
  const current = saga ? cityRecord(controller.state, gameData) : null;
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
      <h2>{saga ? t('saga.title') : t('victory.title')}</h2>
      <p>{saga ? t('saga.text') : t('victory.text')}</p>
      {saga && current && <SagaChronicle history={history} current={current} />}
      <p className="victory-score" data-testid="victory-score">
        {t('score.title')}: <strong>{score}</strong>
      </p>
      <p className="muted">
        {finishedDay !== null
          ? t('score.finished', { days: finishedDay })
          : `${t('topbar.day')} ${day}`}{' '}
        · {t('topbar.population')} {population}
      </p>
      <div className="event-choices">
        {gameData.colony && hasNext && (
          <button
            className="btn"
            data-testid="victory-colony"
            onClick={() => {
              setOpen(false);
              openColony(true);
            }}
          >
            {t('colony.button')}
          </button>
        )}
        <button className="primary" onClick={continuePlaying}>
          {t('victory.continue')}
        </button>
      </div>
    </dialog>
  );
}

/** Kronika ságy: mestá na všetkých planétach a súčet skóre. */
function SagaChronicle({ history, current }: { history: CityRecord[]; current: CityRecord }) {
  const all = [...history, current];
  return (
    <div className="saga-chronicle" data-testid="saga-chronicle">
      <h3>{t('saga.chronicle')}</h3>
      <ol>
        {all.map((record, i) => (
          <li key={i}>
            <strong>
              {record.city} · {t(`planet.${record.planet}`)}
            </strong>
            {record === current && <em className="muted"> ({t('saga.current')})</em>}
            <span className="muted">
              {t('saga.entry', {
                days: record.days,
                population: record.population,
                score: record.score,
              })}
            </span>
          </li>
        ))}
      </ol>
      <p className="saga-total">
        {t('saga.total', { score: all.reduce((sum, r) => sum + r.score, 0) })}
      </p>
    </div>
  );
}
