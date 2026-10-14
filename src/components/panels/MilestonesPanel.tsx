import { formatAmount } from '@/app/format';
import { eraName, milestoneTitle } from '@/app/names';
import { resourceLabel, t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { conditionProgress, currentMilestone, type ConditionProgress } from '@/engine';
import { RESOURCE_IDS, type MilestoneCondition, type MilestoneDefinition } from '@/types';
import { conditionLabel } from '@/app/conditions';
import { PanelFrame } from './PanelFrame';
import { Progress } from './Progress';

function rewardLabel(milestone: MilestoneDefinition): string {
  const { rewards } = milestone;
  const parts = RESOURCE_IDS.filter((id) => rewards.resources?.[id]).map(
    (id) => `${resourceLabel(id)} +${rewards.resources![id]}`,
  );
  if (rewards.money) parts.push(`${t('topbar.money')} +${rewards.money}`);
  if (rewards.badgeId) parts.push(t('events.badge'));
  return parts.join(', ');
}

export function MilestonesPanel() {
  const completedIds = useGameState((s) => s.milestones.completedIds);
  const current = useGameState((s) => currentMilestone(s, gameData));

  return (
    <PanelFrame title={t('milestones.title')} testId="milestones-panel">
      {!current && <p className="all-done">{t('milestones.allDone')}</p>}
      {gameData.eras.map((era) => (
        <section key={era.id} className="era-group" data-era-id={era.id}>
          <h3>{eraName(era.id)}</h3>
          <ol className="milestone-list">
            {gameData.milestones
              .filter((m) => m.era === era.id)
              .map((milestone) => {
                const done = completedIds.includes(milestone.id);
                const isCurrent = current?.id === milestone.id;
                return (
                  <li
                    key={milestone.id}
                    className={`milestone ${done ? 'done' : isCurrent ? 'current' : 'upcoming'}`}
                    data-milestone-id={milestone.id}
                  >
                    <div className="milestone-header">
                      <strong>{milestoneTitle(milestone.id)}</strong>
                      <span className="tag">
                        {done
                          ? t('milestones.completed')
                          : isCurrent
                            ? t('milestones.current')
                            : t('milestones.upcoming')}
                      </span>
                    </div>
                    {isCurrent && <ConditionList milestone={milestone} />}
                    <div className="muted milestone-reward">
                      {t('milestones.reward')}: {rewardLabel(milestone)}
                    </div>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
    </PanelFrame>
  );
}

function ConditionList({ milestone }: { milestone: MilestoneDefinition }) {
  const progress = useGameState((s) =>
    milestone.conditions.map((condition, index) =>
      conditionProgress(s, gameData, milestone.id, index, condition),
    ),
  );
  return (
    <ul className="condition-list">
      {milestone.conditions.map((condition, index) => (
        <ConditionRow key={index} condition={condition} progress={progress[index]!} />
      ))}
    </ul>
  );
}

function ConditionRow({
  condition,
  progress,
}: {
  condition: MilestoneCondition;
  progress: ConditionProgress;
}) {
  const done = progress.days >= progress.requiredDays;
  const value =
    condition.type === 'resource_balance' || condition.type === 'money_balance'
      ? `${formatAmount(progress.current)} (min. ${progress.target})`
      : `${formatAmount(Math.floor(progress.current))} / ${progress.target}`;
  return (
    <li
      className={`condition ${done ? 'met' : progress.metToday ? 'partial' : ''}`}
      data-testid="milestone-condition"
    >
      <span className="condition-check" aria-hidden>
        {done ? '✓' : '○'}
      </span>
      <span className="condition-label">{conditionLabel(condition)}</span>
      <span className="condition-value">{value}</span>
      {progress.requiredDays > 1 && (
        <div className="condition-days">
          <Progress value={progress.days / progress.requiredDays} />
          <span className="muted">
            {progress.days} / {progress.requiredDays} {t('milestones.days')}
          </span>
        </div>
      )}
    </li>
  );
}
