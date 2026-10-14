import { gameData } from '@/data';
import { eraName, milestoneTitle, techName } from './names';
import type { GameEvent } from '@/engine';
import { RESOURCE_IDS } from '@/types';
import { useUiStore } from '@/stores/uiStore';
import { controller } from './game';
import { resourceLabel, t } from './i18n';

const FINAL_MILESTONE_ID = gameData.milestones.at(-1)?.id;

function rewardText(milestoneId: string): string {
  const rewards = gameData.milestones.find((m) => m.id === milestoneId)?.rewards;
  if (!rewards) return '';
  const parts = RESOURCE_IDS.filter((id) => rewards.resources?.[id]).map(
    (id) => `${resourceLabel(id)} +${rewards.resources![id]}`,
  );
  if (rewards.money) parts.push(`${t('topbar.money')} +${rewards.money}`);
  if (rewards.badgeId) parts.push(t('events.badge'));
  return parts.join(', ');
}

/** Prevedie udalosti zo simulácie na hlásenia v UI. Hlad hlási len pri jeho začiatku. */
export function installGameEventNotifications(): () => void {
  let starving = false;

  return controller.onEvents((events: GameEvent[]) => {
    const ui = useUiStore.getState();
    const day = controller.state.simulation.day;
    const log = (label: string, text: string, kind: 'info' | 'success' | 'warning') =>
      ui.addLog({ day, label, text, kind });
    const starvingToday = events.some((e) => e.type === 'food_shortage');
    if (starvingToday && !starving) {
      ui.showNotice(t('events.foodShortage'), 'warning');
      log(t('events.hunger'), t('events.hungerText'), 'warning');
    }
    starving = starvingToday;

    for (const event of events) {
      if (event.type === 'research_completed') {
        const name = techName(event.technologyId);
        ui.showNotice(`${t('events.researchCompleted')}: ${name}`, 'success');
        log(t('events.researchCompleted'), name, 'success');
      } else if (event.type === 'era_reached') {
        controller.setSpeed(0);
        ui.setNewEra(event.eraId);
        log(t('events.newEra'), eraName(event.eraId), 'info');
      } else if (event.type === 'milestone_completed') {
        const title = milestoneTitle(event.milestoneId);
        const reward = rewardText(event.milestoneId);
        ui.showNotice(
          `${t('events.milestoneCompleted')}: ${title}${reward ? ` (${reward})` : ''}`,
          'success',
        );
        log(t('events.milestoneCompleted'), title, 'success');
        if (event.milestoneId === FINAL_MILESTONE_ID) {
          controller.setSpeed(0);
          ui.setVictoryOpen(true);
        }
      }
    }
  });
}
