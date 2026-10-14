import { useEffect, useRef } from 'react';
import { formatCompact } from '@/app/format';
import { controller } from '@/app/game';
import { commandReasonLabel, resourceLabel, t, type TranslationKey } from '@/app/i18n';
import { buildingName, eventDescription, eventName } from '@/app/names';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { useUiStore } from '@/stores/uiStore';

/** Karta udalosti s voľbou. Hra je počas rozhodovania pozastavená. */
export function EventDialog() {
  const pending = useGameState((s) => s.events.pending);
  const money = useGameState((s) => s.city.economy.money);
  const showNotice = useUiStore((s) => s.showNotice);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const definition = pending ? gameData.events.find((e) => e.id === pending.eventId) : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (definition && !dialog.open) dialog.showModal();
    if (!definition && dialog.open) dialog.close();
  }, [definition]);

  const building = pending?.buildingId
    ? controller.state.city.buildings.find((b) => b.id === pending.buildingId)
    : undefined;
  const params = {
    building: building ? buildingName(building.definitionId, building.level) : '',
    resource: pending?.resource ? resourceLabel(pending.resource).toLowerCase() : '',
    amount: pending?.amount ?? 0,
    cost:
      pending?.cost !== undefined
        ? `${formatCompact(pending.cost)} ${t('topbar.money').toLowerCase()}`
        : '',
  };

  const choose = (choiceId: string) => {
    const result = controller.execute({ type: 'RESOLVE_EVENT', choiceId });
    if (!result.success) {
      showNotice(commandReasonLabel(result.reason));
      return;
    }
    if (controller.state.simulation.speed === 0) controller.togglePause();
  };

  return (
    <dialog
      ref={dialogRef}
      className="victory-dialog event-dialog"
      data-testid="event-dialog"
      onCancel={(e) => e.preventDefault()}
    >
      {definition && pending && (
        <>
          <span className="hud-caption">{t('event.title')}</span>
          <h2>{eventName(definition.id)}</h2>
          <p>{eventDescription(definition.id, params)}</p>
          <div className="event-choices">
            {definition.choices!.map((choice, index) => {
              const cost = index === 0 ? (pending.cost ?? 0) : 0;
              const paid = index === 0 && cost > 0;
              return (
                <button
                  key={choice.id}
                  className={`btn${index === 0 ? ' primary' : ''}`}
                  disabled={paid && cost > money}
                  onClick={() => choose(choice.id)}
                  data-testid={`event-choice-${choice.id}`}
                >
                  {t(`event.choice.${choice.id}` as TranslationKey)}
                  {paid && definition.id !== 'caravan' && ` (${formatCompact(cost)})`}
                </button>
              );
            })}
          </div>
          <p className="muted hint">
            {t('event.autoResolve', { days: gameData.balance.events.pendingDays })}
          </p>
        </>
      )}
    </dialog>
  );
}
