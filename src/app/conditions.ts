import { gameData } from '@/data';
import { levelName } from '@/engine';
import type { MilestoneCondition } from '@/types';
import { resourceLabel, t } from './i18n';

/** Text podmienky míľnika, napr. „Postaviť: Katedrála“. */
export function conditionLabel(condition: MilestoneCondition): string {
  switch (condition.type) {
    case 'building_count': {
      const name = gameData.buildingsById.get(condition.buildingId)?.name ?? condition.buildingId;
      return `${t('condition.building_count')}: ${name}`;
    }
    case 'building_level': {
      const definition = gameData.buildingsById.get(condition.buildingId);
      const name = definition ? levelName(definition, condition.level) : condition.buildingId;
      return `${t('condition.building_level')}: ${name}`;
    }
    case 'resource_balance':
      return `${t('condition.resource_balance')} (${resourceLabel(condition.resource).toLowerCase()})`;
    default:
      return t(`condition.${condition.type}`);
  }
}
