import { formatDelta } from '@/app/format';
import { controller } from '@/app/game';
import { resourceLabel, t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { RESOURCE_IDS, type SimulationSpeed } from '@/types';

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

  return (
    <header className="top-bar" data-testid="top-bar">
      <span className="brand">{t('app.title')}</span>
      <Stat label={t('topbar.day')} value={day} testId="day" />
      <Stat
        label={t('topbar.population')}
        value={`${population.total} / ${population.housingCapacity}`}
      />
      <Stat
        label={t('topbar.workers')}
        value={`${population.employedWorkers} / ${population.availableWorkers}`}
      />
      <Stat label={t('topbar.happiness')} value={Math.round(population.happiness)} />
      {RESOURCE_IDS.map((id) => {
        const delta = (economy.dailyProduction[id] ?? 0) - (economy.dailyConsumption[id] ?? 0);
        const capped = id !== 'knowledge';
        return (
          <Stat
            key={id}
            label={resourceLabel(id)}
            value={Math.floor(economy.resources[id])}
            delta={day > 0 ? delta : undefined}
            warn={capped && economy.resources[id] >= economy.storageCapacity}
            title={capped ? `${t('topbar.storage')}: ${economy.storageCapacity}` : undefined}
            testId={`resource-${id}`}
          />
        );
      })}
      <Stat
        label={t('topbar.money')}
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
  value,
  delta,
  warn,
  title,
  testId,
}: {
  label: string;
  value: string | number;
  delta?: number | undefined;
  warn?: boolean;
  title?: string | undefined;
  testId?: string;
}) {
  return (
    <div className={`stat${warn ? ' warn' : ''}`} title={title} data-testid={testId}>
      <span className="stat-label">{label}</span>
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
