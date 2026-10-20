import { useEffect, useRef, useState } from 'react';
import { freeSlotForColony, launchColony } from '@/app/colony';
import { t } from '@/app/i18n';
import { buildingName, legacyDescription, legacyName } from '@/app/names';
import { slotLabel } from '@/app/saving';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { availableLegacies, colonyLaunchBlock, nextPlanet } from '@/engine';
import type { PlanetId } from '@/types';
import type { SlotId } from '@/persistence/db';
import { useUiStore } from '@/stores/uiStore';
import { Cost } from './hud/Cost';

/** Kolonizačná loď: cieľ, cena štartu a výber výhody, ktorú si kolonisti zachránia. */
export function ColonyDialog() {
  const open = useUiStore((s) => s.colonyOpen);
  const setOpen = useUiStore((s) => s.setColonyOpen);
  const block = useGameState((s) => colonyLaunchBlock(s, gameData));
  const resources = useGameState((s) => s.city.economy.resources);
  const inherited = useGameState((s) => s.colony.legacyIds);
  const legacies = useGameState((s) =>
    availableLegacies(s, gameData)
      .map((l) => l.id)
      .join(','),
  );
  const [choice, setChoice] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotId | null | undefined>(undefined);
  const [launching, setLaunching] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const colony = gameData.colony;
  const destination = useGameState((s) => nextPlanet(s, gameData)) as Exclude<
    PlanetId,
    'earth'
  > | null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setChoice(null);
      setSlot(undefined);
      void freeSlotForColony().then(setSlot);
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const launch = async () => {
    if (!choice) return;
    setLaunching(true);
    try {
      if (await launchColony(choice)) setOpen(false);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="victory-dialog colony-dialog"
      data-testid="colony-dialog"
      onCancel={() => setOpen(false)}
    >
      {open && colony && destination && (
        <>
          <div className="badge" aria-hidden>
            🚀
          </div>
          <h2>{t('colony.title')}</h2>
          <p>{t(`colony.intro.${destination}`)}</p>
          <h3>{t('colony.destination')}</h3>
          <div className="colony-planet">
            <span className={`colony-planet-globe ${destination}`} aria-hidden />
            <div>
              <strong>{t(`planet.${destination}`)}</strong>
              <p className="muted">{t(`colony.description.${destination}`)}</p>
            </div>
          </div>
          <h3>{t('colony.cost')}</h3>
          <p>
            <Cost cost={colony.launchCost} stock={resources} />
          </p>
          {inherited.length > 0 && (
            <>
              <h3>{t('colony.inherited')}</h3>
              <p className="muted">{inherited.map(legacyName).join(', ')}</p>
            </>
          )}
          <h3>{t('colony.legacyTitle')}</h3>
          <div className="colony-legacies" role="radiogroup">
            {legacies
              .split(',')
              .filter(Boolean)
              .map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={choice === id}
                  className={choice === id ? 'colony-legacy selected' : 'colony-legacy'}
                  data-testid={`legacy-${id}`}
                  onClick={() => setChoice(id)}
                >
                  <strong>{legacyName(id)}</strong>
                  <span>{legacyDescription(id)}</span>
                </button>
              ))}
          </div>
          {block && (
            <p className="colony-block" data-testid="colony-block">
              {t(`colony.block.${block}`, {
                building: buildingName(colony.requiredBuilding),
              })}
            </p>
          )}
          {slot !== undefined && (
            <p className="muted">
              {slot ? t('colony.saveSlot', { slot: slotLabel(slot) }) : t('colony.noSlot')}
            </p>
          )}
          <div className="event-choices">
            <button className="btn" onClick={() => setOpen(false)}>
              {t('colony.cancel')}
            </button>
            <button
              className="primary"
              data-testid="colony-launch"
              disabled={block !== null || !choice || launching}
              onClick={() => void launch()}
            >
              {t('colony.launch')}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
