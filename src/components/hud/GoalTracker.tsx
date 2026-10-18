import { useState } from 'react';
import { milestoneTitle } from '@/app/names';
import { formatAmount } from '@/app/format';
import { useCompact } from '@/app/useCompact';
import { t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { conditionProgress, currentEraIndex, currentMilestone } from '@/engine';
import { useUiStore } from '@/stores/uiStore';
import { conditionLabel } from '@/app/conditions';
import { LayerLegend } from './LayerLegend';
import { ActiveEvents } from './ActiveEvents';
import { StreetVoice } from './StreetVoice';

/** Vľavo hore: aktuálny míľnik s priebehom podmienok a krátky záznam udalostí. */
export function GoalTracker() {
  const milestone = useGameState((s) => currentMilestone(s, gameData));
  const completed = useGameState((s) => s.milestones.completedIds);
  const eraIndex = useGameState((s) => currentEraIndex(s, gameData));
  const progress = useGameState((s) =>
    milestone
      ? milestone.conditions.map((condition, index) =>
          conditionProgress(s, gameData, milestone.id, index, condition),
        )
      : [],
  );
  const togglePanel = useUiStore((s) => s.togglePanel);
  const compact = useCompact();
  // Na mobile je cieľ predvolene zbalený (zaberá málo miesta nad mapou).
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const isCollapsed = collapsed ?? compact;
  const metCount = progress.filter((p) => p.days >= p.requiredDays).length;
  const era = gameData.eras[eraIndex]!;
  const eraMilestones = gameData.milestones.filter((m) => m.era === era.id);

  return (
    <div className="hud-left">
      <section
        className={`hud-panel goal-tracker${isCollapsed ? ' collapsed' : ''}`}
        data-testid="goal-tracker"
      >
        <button
          className="goal-head"
          onClick={() => setCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? t('hud.expand') : t('hud.collapse')}
        >
          <span className="hud-caption">
            <span className="chevron" aria-hidden>
              {isCollapsed ? '▸' : '▾'}
            </span>{' '}
            {t('milestones.current')}
          </span>
          <span
            className="era-pips"
            aria-label={t('hud.eraMilestones', {
              done: eraMilestones.filter((m) => completed.includes(m.id)).length,
              total: eraMilestones.length,
            })}
          >
            {eraMilestones.map((m) => (
              <span
                key={m.id}
                className={
                  completed.includes(m.id)
                    ? 'pip done'
                    : m.id === milestone?.id
                      ? 'pip current'
                      : 'pip'
                }
              />
            ))}
          </span>
        </button>
        {milestone && isCollapsed ? (
          <span className="goal-title small">
            {milestoneTitle(milestone.id)}{' '}
            <span className="muted">
              {metCount}/{milestone.conditions.length}
            </span>
          </span>
        ) : milestone ? (
          <>
            <span className="goal-title">{milestoneTitle(milestone.id)}</span>
            <ul className="goal-conditions">
              {milestone.conditions.map((condition, index) => {
                const p = progress[index]!;
                const multiDay = p.requiredDays > 1;
                const done = p.days >= p.requiredDays;
                const balance =
                  condition.type === 'resource_balance' || condition.type === 'money_balance';
                const ratio = multiDay
                  ? p.days / p.requiredDays
                  : balance
                    ? p.metToday
                      ? 1
                      : 0
                    : p.target > 0
                      ? p.current / p.target
                      : 1;
                const value = multiDay
                  ? `${p.days} / ${p.requiredDays} ${t('milestones.days')}`
                  : balance
                    ? `${formatAmount(p.current)} (min. ${p.target})`
                    : `${formatAmount(Math.floor(p.current))} / ${p.target}`;
                return (
                  <li key={index} className={done ? 'met' : ''} data-testid="goal-condition">
                    <div className="goal-row">
                      <span>
                        {done ? '✓' : '○'} {conditionLabel(condition)}
                      </span>
                      <span className="goal-value">{value}</span>
                    </div>
                    <div className="bar">
                      <div style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <span className="goal-title">{t('milestones.allDone')}</span>
        )}
        {!isCollapsed && (
          <button className="link-button" onClick={() => togglePanel('milestones')}>
            {t('hud.allMilestones')} ›
          </button>
        )}
      </section>
      <ActiveEvents />
      <LayerLegend />
      <StreetVoice />
      {!compact && <EventLog />}
    </div>
  );
}

function EventLog() {
  const log = useUiStore((s) => s.log);
  if (log.length === 0) return null;
  return (
    <section className="hud-panel event-log" data-testid="event-log">
      <span className="hud-caption">{t('hud.events')}</span>
      <ul>
        {log.slice(0, 4).map((entry) => (
          <li key={entry.id}>
            <span className="log-day">d {entry.day}</span>
            <span>
              <span className={`log-label ${entry.kind}`}>{entry.label}:</span> {entry.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
