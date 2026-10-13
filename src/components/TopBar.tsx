import { formatDelta } from '@/app/format';
import { controller } from '@/app/game';
import { resourceLabel, t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { resourceVisible } from '@/app/eras';
import { gameData } from '@/data';
import { currentEraIndex } from '@/engine';
import type { IconKind } from '@/renderer/pixel/sprites';
import { RESOURCE_IDS, type SimulationSpeed } from '@/types';
import { ResourceIcon } from './ResourceIcon';

const SPEED_BUTTONS: { speed: SimulationSpeed; label: string }[] = [
  { speed: 0, label: t('topbar.pause') },
  { speed: 1, label: '1×' },
  { speed: 2, label: '2×' },
  { speed: 4, label: '4×' },
];

export function TopBar() {
  const day = useGameState((s) => s.simulation.day);
  const speed = useGameState((s) => s.simulation.speed);
  const population = useGameState((s) => s.city.population);
  const economy = useGameState((s) => s.city.economy);
  const eraIndex = useGameState((s) => currentEraIndex(s, gameData));
  const era = gameData.eras[eraIndex]!;

  return (
    <header className="top-bar" data-testid="top-bar">
      <span className="brand">
        {t('app.title')}
        <span className="era-name" data-testid="era-name">
          {era.name}
        </span>
      </span>
      <Stat label={t('topbar.day')} value={day} testId="day" />
      <Stat
        label={t('topbar.population')}
        value={`${population.total} / ${population.housingCapacity}`}
      />
      <Stat
        label={t('topbar.workers')}
        value={`${population.employedWorkers} / ${population.availableWorkers}`}
      />
      <Stat
        label={t('topbar.happiness')}
        value={Math.round(population.happiness)}
        warn={population.happiness < 40}
        title={`${t('happiness.factors')}: ${(['food', 'housing', 'water', 'education'] as const)
          .map((key) => `${t(`happiness.${key}`)} ${population.happinessFactors[key]}`)
          .join(', ')}`}
        testId="happiness"
      />
      {RESOURCE_IDS.filter((id) => resourceVisible(id, eraIndex, economy.resources[id])).map(
        (id) => {
          const delta = (economy.dailyProduction[id] ?? 0) - (economy.dailyConsumption[id] ?? 0);
          const capped = id !== 'knowledge';
          return (
            <Stat
              key={id}
              label={resourceLabel(id)}
              icon={id}
              value={Math.floor(economy.resources[id])}
              delta={day > 0 ? delta : undefined}
              warn={
                (capped && economy.resources[id] >= economy.storageCapacity) ||
                (id === 'food' && economy.resources.food <= 0)
              }
              title={
                capped
                  ? `${resourceLabel(id)} · ${t('topbar.storage')}: ${economy.storageCapacity}`
                  : resourceLabel(id)
              }
              testId={`resource-${id}`}
            />
          );
        },
      )}
      <Stat
        label={t('topbar.money')}
        icon="money"
        value={Math.floor(economy.money)}
        delta={day > 0 ? economy.dailyIncome - economy.dailyExpenses : undefined}
        testId="money"
      />
      <div className="speed-controls" title={t('topbar.speedHint')}>
        <span className="stat-label">{t('topbar.speed')}</span>
        {SPEED_BUTTONS.map((button) => (
          <button
            key={button.speed}
            className={speed === button.speed ? 'active' : ''}
            aria-pressed={speed === button.speed}
            onClick={() => controller.setSpeed(button.speed)}
            data-testid={`speed-${button.speed}`}
          >
            {button.label}
          </button>
        ))}
      </div>
    </header>
  );
}

function Stat({
  label,
  icon,
  value,
  delta,
  warn,
  title,
  testId,
}: {
  label: string;
  icon?: IconKind;
  value: string | number;
  delta?: number | undefined;
  warn?: boolean;
  title?: string | undefined;
  testId?: string;
}) {
  return (
    <div
      className={`stat${warn ? ' warn' : ''}${icon ? ' with-icon' : ''}`}
      title={title ?? label}
      data-testid={testId}
    >
      {icon ? <ResourceIcon kind={icon} /> : <span className="stat-label">{label}</span>}
      <span className="stat-value">
        {value}
        {delta !== undefined && (
          <span className={`stat-delta ${delta < 0 ? 'negative' : delta > 0 ? 'positive' : ''}`}>
            {formatDelta(delta)}
          </span>
        )}
      </span>
    </div>
  );
}
