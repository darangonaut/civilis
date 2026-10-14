import type { ReactNode } from 'react';
import { buildingName, techName } from '@/app/names';
import { formatAmount } from '@/app/format';
import { commandReasonLabel, problemLabel, t } from '@/app/i18n';
import { controller } from '@/app/game';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { demolishRefund, effectiveDefinition, maxLevel, upgradeRequirements } from '@/engine';
import { buildingSpriteKey, TECH_LOOKS } from '@/renderer/pixel/sprites';
import { useUiStore } from '@/stores/uiStore';
import { RESOURCE_IDS, type BuildingInstance, type Resources } from '@/types';
import { BuildingIcon } from '../BuildingIcon';
import { ResourceIcon } from '../ResourceIcon';
import { Cost } from './Cost';
import { Icon } from './Icon';

function hasAny(resources: Partial<Resources>): boolean {
  return RESOURCE_IDS.some((id) => (resources[id] ?? 0) > 0);
}

/** Karta vybranej budovy vpravo hore — zobrazí sa len pri výbere na mape. */
export function Inspector() {
  const selectedInstanceId = useUiStore((s) => s.selectedInstanceId);
  const instance = useGameState((s) =>
    selectedInstanceId ? s.city.buildings.find((b) => b.id === selectedInstanceId) : undefined,
  );
  if (!instance) return null;
  return <InspectorCard key={instance.id} instance={instance} />;
}

function InspectorCard({ instance }: { instance: BuildingInstance }) {
  const showNotice = useUiStore((s) => s.showNotice);
  const selectInstance = useUiStore((s) => s.selectInstance);
  const status = useGameState(() => controller.analysis.statuses.get(instance.id));
  const occupancy = useGameState(() => controller.activity.occupancy.get(instance.id));
  const completedTech = useGameState((s) => s.research.completedTechnologyIds);

  const base = gameData.buildingsById.get(instance.definitionId)!;
  const definition = effectiveDefinition(base, instance.level);
  const levels = maxLevel(base);
  const problems = status?.problems ?? [];
  const refund = demolishRefund(base, instance.level, gameData.balance.demolishRefund);
  const lookTechId = TECH_LOOKS[instance.definitionId];
  const lookTech =
    lookTechId && completedTech.includes(lookTechId) ? techName(lookTechId) : undefined;

  const run = (command: Parameters<typeof controller.execute>[0]) => {
    const result = controller.execute(command);
    if (!result.success) showNotice(commandReasonLabel(result.reason));
    return result.success;
  };
  const demolish = () => {
    if (run({ type: 'DEMOLISH_BUILDING', instanceId: instance.id })) {
      selectInstance(null);
      showNotice(t('detail.demolished'));
    }
  };

  const usesPriority =
    status !== undefined && (status.workersRequired > 0 || hasAny(status.consumed));
  const producing = status && (hasAny(status.produced) || status.moneyIncome > 0);

  return (
    <aside
      className="hud-panel inspector"
      data-testid="detail-panel"
      aria-label={buildingName(instance.definitionId, instance.level)}
    >
      <div className="inspector-head">
        <div className="inspector-icon">
          <BuildingIcon
            spriteKey={buildingSpriteKey(instance.definitionId, instance.level, completedTech)}
          />
        </div>
        <div className="inspector-title">
          <div className="inspector-title-row">
            <h2>{buildingName(instance.definitionId, instance.level)}</h2>
            <button
              className="icon-button"
              onClick={() => selectInstance(null)}
              aria-label={t('common.close')}
              title={t('common.close')}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          {levels > 1 && (
            <div
              className="level-pips"
              aria-label={t('hud.levelOf', { level: instance.level, max: levels })}
            >
              {Array.from({ length: levels }, (_, i) => (
                <span key={i} className={i < instance.level ? 'on' : ''} />
              ))}
            </div>
          )}
          <span className="inspector-sub">
            {levels > 1 && (
              <>
                <span data-testid="building-level">
                  {t('detail.level')} {instance.level} / {levels}
                </span>{' '}
                ·{' '}
              </>
            )}
            [{instance.position.x}, {instance.position.y}]
          </span>
        </div>
      </div>

      <ul className="status-list" data-testid="building-status">
        {problems.length === 0 ? (
          <li className="ok">✓ {t('detail.ok')}</li>
        ) : (
          problems.map((problem, i) => (
            <li key={i} className={problem.code === 'disabled' ? 'paused' : 'problem'}>
              ⚠ {problemLabel(problem)}
            </li>
          ))
        )}
      </ul>

      {definition.housingCapacity > 0 && (
        <Meter
          label={t('hud.residents')}
          value={`${Math.round((occupancy ?? 0) * definition.housingCapacity)} / ${definition.housingCapacity}`}
          ratio={occupancy ?? 0}
          tone="gold"
        />
      )}
      {status && status.workersRequired > 0 && (
        <Meter
          label={t('detail.workersAssigned')}
          value={`${status.workersAssigned} / ${status.workersRequired}`}
          ratio={status.workersAssigned / status.workersRequired}
          tone="blue"
        />
      )}

      {(producing || (status && hasAny(status.consumed)) || lookTech) && (
        <dl className="inspector-stats">
          {producing && (
            <>
              <dt>{t('detail.producing')}</dt>
              <dd>
                <Amounts resources={status.produced} money={status.moneyIncome} />
                <span className="muted"> · {Math.round(status.efficiency * 100)} %</span>
              </dd>
            </>
          )}
          {status && hasAny(status.consumed) && (
            <>
              <dt>{t('detail.consuming')}</dt>
              <dd>
                <Amounts resources={status.consumed} money={0} />
              </dd>
            </>
          )}
          {lookTech && (
            <>
              <dt>{t('detail.lookUpgraded')}</dt>
              <dd>{lookTech}</dd>
            </>
          )}
        </dl>
      )}

      {usesPriority && (
        <div className="segmented" role="group" aria-label={t('detail.priority')}>
          <span className="segmented-label">{t('detail.priority')}</span>
          {([1, 2, 3] as const).map((priority) => (
            <button
              key={priority}
              className={instance.priority === priority ? 'active' : ''}
              aria-pressed={instance.priority === priority}
              onClick={() =>
                run({ type: 'SET_BUILDING_PRIORITY', instanceId: instance.id, priority })
              }
            >
              {t(`priority.${priority}`)}
            </button>
          ))}
        </div>
      )}

      <UpgradeSection instance={instance} />

      <div className="inspector-actions">
        {(status?.workersRequired ?? 0) > 0 && (
          <button
            className="btn"
            onClick={() =>
              run({
                type: 'SET_BUILDING_ENABLED',
                instanceId: instance.id,
                enabled: !instance.enabled,
              })
            }
            data-testid="toggle-enabled"
          >
            {instance.enabled ? t('detail.pause') : t('detail.resume')}
          </button>
        )}
        <button
          className="btn danger"
          onClick={demolish}
          data-testid="demolish"
          title={hasAny(refund) ? t('detail.refund') : undefined}
        >
          {t('detail.demolish')}
          {hasAny(refund) && (
            <span className="refund">
              {' '}
              <Cost cost={refund} limit={3} />
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}

function UpgradeSection({ instance }: { instance: BuildingInstance }) {
  const showNotice = useUiStore((s) => s.showNotice);
  const requirements = useGameState((s) =>
    upgradeRequirements(s, gameData, instance, controller.analysis),
  );
  const resources = useGameState((s) => s.city.economy.resources);
  const sameReady = useGameState(
    (s) =>
      s.city.buildings.filter(
        (b) =>
          b.definitionId === instance.definitionId &&
          b.level === instance.level &&
          controller.upgradable.has(b.id),
      ).length,
  );
  const base = gameData.buildingsById.get(instance.definitionId)!;
  if (maxLevel(base) <= 1) return null;
  if (!requirements) return <p className="muted hint">{t('detail.maxLevel')}</p>;

  const { next, technologyMet, services, affordable } = requirements;
  const ready = technologyMet && affordable && services.every((s) => s.met);
  const tech = next.requiredTechnologyId
    ? gameData.technologiesById.get(next.requiredTechnologyId)
    : undefined;
  const nextDefinition = effectiveDefinition(base, instance.level + 1);

  const upgrade = () => {
    const result = controller.execute({ type: 'UPGRADE_BUILDING', instanceId: instance.id });
    if (result.success)
      showNotice(
        `${t('detail.upgraded')}: ${buildingName(instance.definitionId, instance.level + 1)}`,
        'success',
      );
    else showNotice(commandReasonLabel(result.reason));
  };

  // Rovnaké budovy na rovnakej úrovni, ktoré sa dajú hneď vylepšiť (bloky polí, lesov…).
  const upgradeAll = () => {
    const ids = controller.state.city.buildings
      .filter(
        (b) =>
          b.definitionId === instance.definitionId &&
          b.level === instance.level &&
          controller.upgradable.has(b.id),
      )
      .map((b) => b.id);
    let upgraded = 0;
    for (const id of ids) {
      const result = controller.execute({ type: 'UPGRADE_BUILDING', instanceId: id });
      if (!result.success) break;
      upgraded++;
    }
    showNotice(t('detail.upgradedMany', { n: upgraded }), upgraded > 0 ? 'success' : 'info');
  };

  return (
    <div className="upgrade-box" data-testid="upgrade-section">
      <h3>
        {t('detail.upgradeTo')}: {buildingName(instance.definitionId, instance.level + 1)}
        {nextDefinition.housingCapacity > 0 && (
          <span className="muted">
            {' '}
            ({t('hud.residentsShort', { n: nextDefinition.housingCapacity })})
          </span>
        )}
      </h3>
      {hasAny(nextDefinition.outputs) && (
        <div className="upgrade-gain">
          <span className="muted">{t('detail.outputs')}:</span>{' '}
          <Amounts resources={effectiveDefinition(base, instance.level).outputs} money={0} /> →{' '}
          <Amounts resources={nextDefinition.outputs} money={0} />
        </div>
      )}
      <ul className="requirement-list">
        {tech && <Requirement met={technologyMet}>{techName(tech.id)}</Requirement>}
        {services.map((service) => (
          <Requirement key={service.type} met={service.met}>
            {t(`detail.service.${service.type}`)}
          </Requirement>
        ))}
      </ul>
      <Cost cost={next.upgradeCost} stock={resources} />
      <div className="upgrade-actions">
        <button className="btn primary" disabled={!ready} onClick={upgrade} data-testid="upgrade">
          {t('detail.upgrade')}
        </button>
        {ready && sameReady > 1 && (
          <button className="btn" onClick={upgradeAll} data-testid="upgrade-all">
            {t('detail.upgradeAll', { n: sameReady })}
          </button>
        )}
      </div>
    </div>
  );
}

function Requirement({ met, children }: { met: boolean; children: ReactNode }) {
  return (
    <li className={met ? 'met' : 'unmet'}>
      {met ? '✓' : '✗'} {children}
    </li>
  );
}

function Meter({
  label,
  value,
  ratio,
  tone,
}: {
  label: string;
  value: string;
  ratio: number;
  tone: 'gold' | 'blue';
}) {
  return (
    <div className="meter">
      <div className="meter-row">
        <span className="muted">{label}</span>
        <span className="num">{value}</span>
      </div>
      <div className={`bar thick ${tone}`}>
        <div style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%` }} />
      </div>
    </div>
  );
}

function Amounts({ resources, money }: { resources: Partial<Resources>; money: number }) {
  const parts = RESOURCE_IDS.filter((id) => (resources[id] ?? 0) > 0);
  return (
    <span className="amounts">
      {parts.map((id) => (
        <Cost key={id} cost={{ [id]: resources[id] }} />
      ))}
      {money > 0 && (
        <span className="cost-item" title={t('topbar.money')}>
          <ResourceIcon kind="money" />
          {formatAmount(money)}
        </span>
      )}
    </span>
  );
}
