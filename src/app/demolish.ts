import { gameData } from '@/data';
import { demolishRefund } from '@/engine';
import { useUiStore } from '@/stores/uiStore';
import { RESOURCE_IDS, type Resources } from '@/types';
import { controller } from './game';
import { commandReasonLabel, t } from './i18n';

/** Suroviny, ktoré vráti zbúranie budov (pred orezaním na kapacitu skladu). */
export function demolishRefundTotal(instanceIds: readonly string[]): Partial<Resources> {
  const total: Partial<Resources> = {};
  for (const id of instanceIds) {
    const instance = controller.state.city.buildings.find((b) => b.id === id);
    if (!instance) continue;
    const definition = gameData.buildingsById.get(instance.definitionId);
    if (!definition) continue;
    const refund = demolishRefund(definition, instance.level, gameData.balance.demolishRefund);
    for (const resource of RESOURCE_IDS) {
      const amount = refund[resource] ?? 0;
      if (amount > 0) total[resource] = (total[resource] ?? 0) + amount;
    }
  }
  return total;
}

/** Zbúra budovy postupne a zhrnie výsledok (posledný sklad engine odmietne). */
export function demolishBuildings(instanceIds: readonly string[]): void {
  const ui = useUiStore.getState();
  let demolished = 0;
  let firstFailure: string | null = null;
  for (const instanceId of instanceIds) {
    const result = controller.execute({ type: 'DEMOLISH_BUILDING', instanceId });
    if (result.success) demolished++;
    else firstFailure ??= result.reason;
  }
  if (!firstFailure) {
    ui.showNotice(
      demolished === 1 ? t('detail.demolished') : t('demolish.done', { n: demolished }),
    );
  } else if (instanceIds.length === 1) {
    ui.showNotice(commandReasonLabel(firstFailure));
  } else {
    ui.showNotice(
      t('demolish.partial', {
        demolished,
        failed: instanceIds.length - demolished,
        reason: commandReasonLabel(firstFailure),
      }),
      demolished > 0 ? 'info' : 'warning',
    );
  }
}
