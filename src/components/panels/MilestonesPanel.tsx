import { formatAmount } from '@/app/format';
import { achievementDescription, achievementName, eraName, milestoneTitle } from '@/app/names';
import { resourceLabel, t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import {
  achievementProgress,
  cityScore,
  conditionProgress,
  currentMilestone,
  nextPlanet,
  type ConditionProgress,
} from '@/engine';
import { useState } from 'react';
import { RESOURCE_IDS, type MilestoneCondition, type MilestoneDefinition } from '@/types';
import { conditionLabel } from '@/app/conditions';
import { useUiStore } from '@/stores/uiStore';
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
  const [tab, setTab] = useState<'milestones' | 'achievements'>('milestones');
  const score = useGameState((s) => cityScore(s, gameData));
  const achievementsDone = useGameState((s) => s.achievements.completedIds.length);

  return (
    <PanelFrame title={t('milestones.title')} testId="milestones-panel">
      <div className="panel-tabs">
        <div className="segmented" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'milestones'}
            className={tab === 'milestones' ? 'active' : ''}
            onClick={() => setTab('milestones')}
          >
            {t('milestones.tab')}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'achievements'}
            className={tab === 'achievements' ? 'active' : ''}
            onClick={() => setTab('achievements')}
            data-testid="tab-achievements"
          >
            {t('achievements.count', {
              done: achievementsDone,
              total: gameData.achievements.length,
            })}
          </button>
        </div>
        <span className="score" data-testid="city-score">
          {t('score.title')}: <strong>{score}</strong>
        </span>
      </div>
      {tab === 'milestones' ? <MilestoneList /> : <AchievementList />}
    </PanelFrame>
  );
}

function AchievementList() {
  const completed = useGameState((s) => s.achievements.completedIds);
  const progress = useGameState((s) =>
    gameData.achievements.map((a) => achievementProgress(s, gameData, a.condition)),
  );
  return (
    <ul className="achievement-list" data-testid="achievement-list">
      {gameData.achievements.map((achievement, i) => {
        const done = completed.includes(achievement.id);
        const p = progress[i]!;
        const showBar = !done && achievement.condition.type !== 'finished_before_day';
        return (
          <li
            key={achievement.id}
            className={`achievement ${done ? 'done' : ''}`}
            data-achievement-id={achievement.id}
          >
            <span className="achievement-badge" aria-hidden>
              {done ? '★' : '☆'}
            </span>
            <div className="achievement-text">
              <strong>{achievementName(achievement.id)}</strong>
              <span className="muted">{achievementDescription(achievement.id)}</span>
              {showBar && (
                <span className="bar">
                  <span style={{ width: `${Math.min(1, p.current / p.target) * 100}%` }} />
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MilestoneList() {
  const completedIds = useGameState((s) => s.milestones.completedIds);
  const current = useGameState((s) => currentMilestone(s, gameData));
  const openColony = useUiStore((s) => s.setColonyOpen);
  const openVictory = useUiStore((s) => s.setVictoryOpen);
  const hasNext = useGameState((s) => nextPlanet(s, gameData) !== null);
  const hasHistory = useGameState((s) => s.colony.history.length > 0);

  return (
    <>
      {!current && (
        <div className="all-done">
          <p>{t('milestones.allDone')}</p>
          {gameData.colony && hasNext && (
            <button
              className="primary"
              data-testid="milestones-colony"
              onClick={() => openColony(true)}
            >
              🚀 {t('colony.button')}
            </button>
          )}
          {!hasNext && hasHistory && (
            <button
              className="primary"
              data-testid="milestones-saga"
              onClick={() => openVictory(true)}
            >
              ★ {t('saga.chronicle')}
            </button>
          )}
        </div>
      )}
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
    </>
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
