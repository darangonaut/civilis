import { useLayoutEffect, useRef } from 'react';
import { eraName } from '@/app/names';
import { formatCompact, formatDelta } from '@/app/format';
import { controller } from '@/app/game';
import { resourceLabel, t, type TranslationKey } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { resourceVisible } from '@/app/eras';
import { gameData } from '@/data';
import { currentEraIndex } from '@/engine';
import type { IconKind } from '@/renderer/pixel/sprites';
import { useUiStore } from '@/stores/uiStore';
import { RESOURCE_IDS, type SimulationSpeed } from '@/types';
import { ResourceIcon } from '../ResourceIcon';
import { Icon } from './Icon';

const SPEEDS: SimulationSpeed[] = [0, 1, 2, 4];

/** Horná plávajúca lišta: názov, éra a deň, suroviny s trendom, obyvatelia a rýchlosť. */
export function TopHud() {
  const day = useGameState((s) => s.simulation.day);
  const speed = useGameState((s) => s.simulation.speed);
  const population = useGameState((s) => s.city.population);
  const economy = useGameState((s) => s.city.economy);
  const eraIndex = useGameState((s) => currentEraIndex(s, gameData));
  const phase = useUiStore((s) => s.dayPhase);
  const era = gameData.eras[eraIndex]!;
  const happy = Math.round(population.happiness);
  const ref = useRef<HTMLElement>(null);
  // Panely pod lištou sa posunú, keď sa lišta na užšej obrazovke zalomí.
  useLayoutEffect(() => {
    const element = ref.current!;
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty(
        '--hud-top',
        `${element.offsetTop + element.offsetHeight + 18}px`,
      ),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <header ref={ref} className="top-hud" data-testid="top-bar">
      <div className="hud-panel hud-brand">
        <div className="brand-block">
          <span className="brand">{t('app.title')}</span>
          <span className="brand-era">
            {t('hud.era', { n: eraIndex + 1, total: gameData.eras.length })}
          </span>
        </div>
        <div className="hud-divider" />
        <div className="era-block">
          <span className="era-name" data-testid="era-name">
            {eraName(era.id)}
          </span>
          <span className="era-day">
            {phase && (
              <span className={`phase-icon ${phase}`}>
                <Icon name={phase === 'night' || phase === 'dusk' ? 'moon' : 'sun'} size={14} />
              </span>
            )}
            {t('topbar.day')} <span data-testid="day">{day}</span>
            {phase && (
              <span className="phase-text"> · {t(`phase.${phase}` as TranslationKey)}</span>
            )}
          </span>
        </div>
      </div>

      <div className="hud-panel hud-resources">
        {RESOURCE_IDS.filter((id) => resourceVisible(id, eraIndex, economy.resources[id])).map(
          (id) => {
            const capped = id !== 'knowledge';
            const full = capped && economy.resources[id] >= economy.storageCapacity;
            const empty = id === 'food' && economy.resources.food <= 0;
            return (
              <Chip
                key={id}
                icon={id}
                value={formatCompact(economy.resources[id])}
                delta={
                  day > 0
                    ? (economy.dailyProduction[id] ?? 0) - (economy.dailyConsumption[id] ?? 0)
                    : undefined
                }
                warn={empty}
                full={full}
                title={
                  capped
                    ? `${resourceLabel(id)} · ${t('topbar.storage')}: ${formatCompact(economy.resources[id])} / ${economy.storageCapacity}${full ? ` (${t('hud.full')})` : ''}`
                    : resourceLabel(id)
                }
                testId={`resource-${id}`}
              />
            );
          },
        )}
        <div className="hud-divider" />
        <Chip
          icon="money"
          value={formatCompact(economy.money)}
          delta={day > 0 ? economy.dailyIncome - economy.dailyExpenses : undefined}
          title={t('topbar.money')}
          money
          testId="money"
        />
      </div>

      <div className="hud-panel hud-people">
        <span className="hud-stat" title={`${t('topbar.population')} / ${t('hud.housing')}`}>
          <Icon name="people" />
          <span className="hud-value">{population.total}</span>
          <span className="hud-sub">/ {population.housingCapacity}</span>
          <span className="sr-only">{`${population.total} / ${population.housingCapacity}`}</span>
        </span>
        <span className="hud-stat workers" title={`${t('hud.employed')} / ${t('topbar.workers')}`}>
          <Icon name="workers" />
          <span className="hud-value">{population.employedWorkers}</span>
          <span className="hud-sub">/ {population.availableWorkers}</span>
        </span>
        <span
          className={`hud-stat happiness ${happy < 40 ? 'bad' : happy < 70 ? 'mid' : 'good'}`}
          title={`${t('topbar.happiness')} — ${(['food', 'housing', 'water', 'education'] as const)
            .map((key) => `${t(`happiness.${key}`)} ${population.happinessFactors[key]}`)
            .join(', ')}`}
          data-testid="happiness"
        >
          <Icon name="smile" />
          <span className="hud-value">{happy}</span>
        </span>
        <div className="hud-divider" />
        <div
          className="speed-controls"
          role="group"
          aria-label={t('topbar.speed')}
          title={t('topbar.speedHint')}
        >
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={speed === s ? 'active' : ''}
              aria-pressed={speed === s}
              aria-label={s === 0 ? t('topbar.pause') : `${s}×`}
              onClick={() => controller.setSpeed(s)}
              data-testid={`speed-${s}`}
            >
              {s === 0 ? <Icon name="pause" size={14} /> : `${s}×`}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function Chip({
  icon,
  value,
  delta,
  warn,
  full,
  money,
  title,
  testId,
}: {
  icon: IconKind;
  value: string;
  delta?: number | undefined;
  warn?: boolean;
  full?: boolean;
  money?: boolean;
  title: string;
  testId: string;
}) {
  const trend = delta === undefined ? '' : delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat';
  return (
    <span
      className={`res-chip${warn ? ' warn' : ''}${full ? ' full' : ''}${money ? ' money' : ''}`}
      title={title}
      data-testid={testId}
    >
      <ResourceIcon kind={icon} />
      <span className="res-value">{value}</span>
      {delta !== undefined && (
        <span className={`res-delta ${trend}`}>
          {trend === 'up' ? '▲' : trend === 'down' ? '▼' : ''}
          {trend === 'flat' ? '±0' : formatDelta(Math.abs(delta)).replace('+', '')}
        </span>
      )}
    </span>
  );
}
