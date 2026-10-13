import { gameData } from '@/data';
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
    const starvingToday = events.some((e) => e.type === 'food_shortage');
    if (starvingToday && !starving) ui.showNotice(t('events.foodShortage'), 'warning');
    starving = starvingToday;

    for (const event of events) {
      if (event.type === 'research_completed') {
        const name = gameData.technologiesById.get(event.technologyId)?.name ?? event.technologyId;
        ui.showNotice(`${t('events.researchCompleted')}: ${name}`, 'success');
      } else if (event.type === 'milestone_completed') {
        const title =
          gameData.milestones.find((m) => m.id === event.milestoneId)?.title ?? event.milestoneId;
        const reward = rewardText(event.milestoneId);
        ui.showNotice(
          `${t('events.milestoneCompleted')}: ${title}${reward ? ` (${reward})` : ''}`,
          'success',
        );
        if (event.milestoneId === FINAL_MILESTONE_ID) {
          controller.setSpeed(0);
          ui.setVictoryOpen(true);
        }
      }
    }
  });
}
