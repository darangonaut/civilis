import { formatAmount, formatDelta } from '@/app/format';
import { buildingName } from '@/app/names';
import { controller } from '@/app/game';
import { resourceLabel, t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { RESOURCE_IDS } from '@/types';
import { PanelFrame } from './PanelFrame';
import { Progress } from './Progress';

const FACTORS = ['food', 'housing', 'water', 'education', 'leisure'] as const;

export function StatisticsPanel() {
  const population = useGameState((s) => s.city.population);
  const economy = useGameState((s) => s.city.economy);
  const buildings = useGameState((s) => s.city.buildings);
  const problemCount = useGameState(
    () =>
      [...controller.analysis.statuses.values()].filter((s) =>
        s.problems.some((p) => p.code !== 'disabled'),
      ).length,
  );
  const weights = gameData.balance.happinessWeights;

  const counts = gameData.buildings
    .map((definition) => ({
      definition,
      count: buildings.filter((b) => b.definitionId === definition.id).length,
    }))
    .filter((entry) => entry.count > 0);

  return (
    <PanelFrame title={t('stats.title')} testId="statistics-panel">
      <div className="stats-grid">
        <section>
          <h3>{t('stats.population')}</h3>
          <dl className="detail-list">
            <dt>{t('topbar.population')}</dt>
            <dd>{population.total}</dd>
            <dt>{t('stats.housing')}</dt>
            <dd>{population.housingCapacity}</dd>
            <dt>{t('stats.workers')}</dt>
            <dd>
              {population.employedWorkers} {t('stats.employed')} / {population.availableWorkers}
            </dd>
          </dl>
          <h3>
            {t('stats.happiness')}: {Math.round(population.happiness)}
          </h3>
          <ul className="factor-list">
            {FACTORS.map((key) => (
              <li key={key}>
                <span>
                  {t(`happiness.${key}`)}{' '}
                  <span className="muted">
                    {key === 'leisure'
                      ? `(+${gameData.balance.leisureBonus})`
                      : `(${Math.round(weights[key] * 100)} %)`}
                  </span>
                </span>
                <Progress value={population.happinessFactors[key] / 100} />
                <span className="factor-value">{population.happinessFactors[key]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>{t('stats.economy')}</h3>
          <table className="stats-table">
            <thead>
              <tr>
                <th>{t('stats.resource')}</th>
                <th>{t('stats.stock')}</th>
                <th>{t('stats.production')}</th>
                <th>{t('stats.consumption')}</th>
                <th>{t('stats.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {RESOURCE_IDS.map((id) => {
                const produced = economy.dailyProduction[id] ?? 0;
                const consumed = economy.dailyConsumption[id] ?? 0;
                const balance = produced - consumed;
                return (
                  <tr key={id}>
                    <td>{resourceLabel(id)}</td>
                    <td>{formatAmount(economy.resources[id])}</td>
                    <td>{formatAmount(produced)}</td>
                    <td>{formatAmount(consumed)}</td>
                    <td className={balance < 0 ? 'negative' : balance > 0 ? 'positive' : ''}>
                      {formatDelta(balance)}
                    </td>
                  </tr>
                );
              })}
              <tr className="money-row">
                <td>{t('stats.money')}</td>
                <td>{formatAmount(economy.money)}</td>
                <td>{formatAmount(economy.dailyIncome)}</td>
                <td>{formatAmount(economy.dailyExpenses)}</td>
                <td
                  className={
                    economy.dailyIncome - economy.dailyExpenses < 0
                      ? 'negative'
                      : economy.dailyIncome > economy.dailyExpenses
                        ? 'positive'
                        : ''
                  }
                >
                  {formatDelta(economy.dailyIncome - economy.dailyExpenses)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="muted">
            {t('stats.storage')}: {economy.storageCapacity}
          </p>
        </section>

        <section>
          <h3>{t('stats.buildings')}</h3>
          <dl className="detail-list">
            {counts.map(({ definition, count }) => (
              <div key={definition.id} className="detail-row">
                <dt>{buildingName(definition.id)}</dt>
                <dd>{count}</dd>
              </div>
            ))}
            <div className="detail-row">
              <dt>{t('stats.problems')}</dt>
              <dd className={problemCount > 0 ? 'negative' : ''}>{problemCount}</dd>
            </div>
          </dl>
        </section>
      </div>
    </PanelFrame>
  );
}
