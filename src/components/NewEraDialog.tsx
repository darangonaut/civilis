import { useEffect, useRef } from 'react';
import { buildingName, eraDescription, eraName, techName } from '@/app/names';
import { controller } from '@/app/game';
import { t } from '@/app/i18n';
import { gameData } from '@/data';
import { buildingEraIndex } from '@/engine';
import { useUiStore } from '@/stores/uiStore';
import { BuildingIcon } from './BuildingIcon';

/** Obrazovka po dosiahnutí novej éry: čo pribudlo (technológie, budovy). */
export function NewEraDialog() {
  const eraId = useUiStore((s) => s.newEraId);
  const setNewEra = useUiStore((s) => s.setNewEra);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const eraIndex = gameData.eras.findIndex((e) => e.id === eraId);
  const era = gameData.eras[eraIndex];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (era && !dialog.open) dialog.showModal();
    if (!era && dialog.open) dialog.close();
  }, [era]);

  const close = () => {
    setNewEra(null);
    controller.setSpeed(1);
  };

  const technologies = era ? gameData.technologies.filter((tech) => tech.era === era.id) : [];
  const buildings = era
    ? gameData.buildings.filter((b) => buildingEraIndex(gameData, b.id) === eraIndex)
    : [];

  return (
    <dialog
      ref={dialogRef}
      className="victory-dialog era-dialog"
      data-testid="new-era"
      onCancel={close}
    >
      {era && (
        <>
          <div className="badge" aria-hidden>
            ⚑
          </div>
          <h2>{t('era.reached', { era: eraName(era.id) })}</h2>
          <p>{eraDescription(era.id)}</p>
          <h3>{t('era.newBuildings')}</h3>
          <ul className="era-buildings">
            {buildings.map((b) => (
              <li key={b.id}>
                <BuildingIcon definitionId={b.id} />
                <span>{buildingName(b.id)}</span>
              </li>
            ))}
          </ul>
          <h3>{t('era.newTechnologies')}</h3>
          <p className="muted">{technologies.map((tech) => techName(tech.id)).join(', ')}</p>
          <button className="primary" onClick={close}>
            {t('era.continue')}
          </button>
        </>
      )}
    </dialog>
  );
}
