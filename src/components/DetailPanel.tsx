import { formatAmount } from '@/app/format';
import { commandReasonLabel, problemLabel, resourceLabel, t } from '@/app/i18n';
import { controller } from '@/app/game';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { effectiveDefinition, maxLevel, upgradeRequirements } from '@/engine';
import { TECH_LOOKS } from '@/renderer/pixel/sprites';
import { useUiStore } from '@/stores/uiStore';
import {
  RESOURCE_IDS,
  type BuildingDefinition,
  type BuildingInstance,
  type Resources,
} from '@/types';

function formatResources(resources: Partial<Resources>): string {
  const parts = RESOURCE_IDS.filter((id) => resources[id]).map(
    (id) => `${resourceLabel(id)}: ${resources[id]}`,
  );
  return parts.length > 0 ? parts.join(', ') : t('detail.none');
}

export function DetailPanel() {
  const buildModeId = useUiStore((s) => s.buildModeId);
  const selectedInstanceId = useUiStore((s) => s.selectedInstanceId);
  const instance = useGameState((s) =>
    selectedInstanceId ? s.city.buildings.find((b) => b.id === selectedInstanceId) : undefined,
  );

  const definitionId = instance?.definitionId ?? buildModeId;
  const base = definitionId ? gameData.buildingsById.get(definitionId) : undefined;
  // Parametre a názov podľa aktuálnej úrovne budovy.
  const definition = base && instance ? effectiveDefinition(base, instance.level) : base;

  return (
    <aside className="right-panel" data-testid="detail-panel">
      <h2>{definition ? definition.name : t('detail.title')}</h2>
      {!definition ? (
        <p className="muted">{t('detail.empty')}</p>
      ) : (
        <>
          {instance ? (
            <InstanceSection instance={instance} />
          ) : (
            <p className="muted hint">{t('detail.buildHint')}</p>
          )}
          <DefinitionDetails building={definition} />
        </>
      )}
    </aside>
  );
}

function InstanceSection({ instance }: { instance: BuildingInstance }) {
  const showNotice = useUiStore((s) => s.showNotice);
  const selectInstance = useUiStore((s) => s.selectInstance);
  const status = useGameState(() => controller.analysis.statuses.get(instance.id));

  const demolish = () => {
    const result = controller.execute({ type: 'DEMOLISH_BUILDING', instanceId: instance.id });
    if (result.success) {
      selectInstance(null);
      showNotice(t('detail.demolished'));
    } else {
      showNotice(commandReasonLabel(result.reason));
    }
  };

  const setPriority = (priority: number) => {
    const result = controller.execute({
      type: 'SET_BUILDING_PRIORITY',
      instanceId: instance.id,
      priority,
    });
    if (!result.success) showNotice(commandReasonLabel(result.reason));
  };

  const problems = status?.problems ?? [];
  const baseDefinition = gameData.buildingsById.get(instance.definitionId)!;
  const techId = TECH_LOOKS[instance.definitionId];
  const research = useGameState((s) => s.research.completedTechnologyIds);
  const lookTech =
    techId && research.includes(techId) ? gameData.technologiesById.get(techId)?.name : undefined;

  const toggleEnabled = () => {
    const result = controller.execute({
      type: 'SET_BUILDING_ENABLED',
      instanceId: instance.id,
      enabled: !instance.enabled,
    });
    if (!result.success) showNotice(commandReasonLabel(result.reason));
  };
  const usesPriority =
    status !== undefined && (status.workersRequired > 0 || hasAny(status.consumed));

  return (
    <div className="instance-section">
      <ul className="problem-list" data-testid="building-status">
        {problems.length === 0 ? (
          <li className="ok">{t('detail.ok')}</li>
        ) : (
          problems.map((problem, i) => (
            <li key={i} className="problem">
              {problemLabel(problem)}
            </li>
          ))
        )}
      </ul>
      <dl className="detail-list">
        {maxLevel(baseDefinition) > 1 && (
          <>
            <dt>{t('detail.level')}</dt>
            <dd data-testid="building-level">
              {instance.level} / {maxLevel(baseDefinition)}
            </dd>
          </>
        )}
        {lookTech && (
          <>
            <dt>{t('detail.lookUpgraded')}</dt>
            <dd>{lookTech}</dd>
          </>
        )}
        <dt>{t('detail.position')}</dt>
        <dd>
          [{instance.position.x}, {instance.position.y}]
        </dd>
        {status && status.workersRequired > 0 && (
          <>
            <dt>{t('detail.workersAssigned')}</dt>
            <dd>
              {status.workersAssigned} / {status.workersRequired}
            </dd>
          </>
        )}
        {status && (hasAny(status.produced) || status.moneyIncome > 0) && (
          <>
            <dt>{t('detail.efficiency')}</dt>
            <dd>{Math.round(status.efficiency * 100)} %</dd>
            <dt>{t('detail.producing')}</dt>
            <dd>{formatAmounts(status.produced, status.moneyIncome)}</dd>
          </>
        )}
        {status && hasAny(status.consumed) && (
          <>
            <dt>{t('detail.consuming')}</dt>
            <dd>{formatAmounts(status.consumed, 0)}</dd>
          </>
        )}
      </dl>
      {usesPriority && (
        <div className="priority-control" role="group" aria-label={t('detail.priority')}>
          <span className="muted">{t('detail.priority')}</span>
          {([1, 2, 3] as const).map((priority) => (
            <button
              key={priority}
              className={instance.priority === priority ? 'active' : ''}
              aria-pressed={instance.priority === priority}
              onClick={() => setPriority(priority)}
            >
              {t(`priority.${priority}`)}
            </button>
          ))}
        </div>
      )}
      <UpgradeSection instance={instance} />
      <div className="instance-actions">
        {(status?.workersRequired ?? 0) > 0 && (
          <button onClick={toggleEnabled} data-testid="toggle-enabled">
            {instance.enabled ? t('detail.pause') : t('detail.resume')}
          </button>
        )}
        <button className="danger" onClick={demolish} data-testid="demolish">
          {t('detail.demolish')}
        </button>
      </div>
    </div>
  );
}

function UpgradeSection({ instance }: { instance: BuildingInstance }) {
  const showNotice = useUiStore((s) => s.showNotice);
  const requirements = useGameState((s) =>
    upgradeRequirements(s, gameData, instance, controller.analysis),
  );
  const definition = gameData.buildingsById.get(instance.definitionId)!;
  if (maxLevel(definition) <= 1) return null;
  if (!requirements) return <p className="muted hint">{t('detail.maxLevel')}</p>;

  const { next, technologyMet, services, affordable } = requirements;
  const ready = technologyMet && affordable && services.every((s) => s.met);
  const tech = next.requiredTechnologyId
    ? gameData.technologiesById.get(next.requiredTechnologyId)
    : undefined;

  const upgrade = () => {
    const result = controller.execute({ type: 'UPGRADE_BUILDING', instanceId: instance.id });
    if (result.success) showNotice(`${t('detail.upgraded')}: ${next.name}`, 'success');
    else showNotice(commandReasonLabel(result.reason));
  };

  return (
    <div className="upgrade-section" data-testid="upgrade-section">
      <h3>
        {t('detail.upgradeTo')}: {next.name}
      </h3>
      <ul className="requirement-list">
        {tech && <Requirement met={technologyMet}>{tech.name}</Requirement>}
        {services.map((service) => (
          <Requirement key={service.type} met={service.met}>
            {t(`detail.service.${service.type}`)}
          </Requirement>
        ))}
        <Requirement met={affordable}>
          {t('detail.upgradeCost')}: {formatResources(next.upgradeCost)}
        </Requirement>
      </ul>
      <button className="primary" disabled={!ready} onClick={upgrade} data-testid="upgrade">
        {t('detail.upgrade')}
      </button>
    </div>
  );
}

function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li className={met ? 'met' : 'unmet'}>
      {met ? '✓' : '✗'} {children}
    </li>
  );
}

function hasAny(resources: Partial<Resources>): boolean {
  return RESOURCE_IDS.some((id) => (resources[id] ?? 0) > 0);
}

function formatAmounts(resources: Partial<Resources>, money: number): string {
  const parts = RESOURCE_IDS.filter((id) => (resources[id] ?? 0) > 0).map(
    (id) => `${resourceLabel(id)}: ${formatAmount(resources[id]!)}`,
  );
  if (money > 0) parts.push(`${t('topbar.money')}: ${formatAmount(money)}`);
  return parts.length > 0 ? parts.join(', ') : t('detail.none');
}

function DefinitionDetails({ building }: { building: BuildingDefinition }) {
  return (
    <dl className="detail-list">
      <dt>{t('detail.cost')}</dt>
      <dd>{formatResources(building.constructionCost)}</dd>
      <dt>{t('detail.outputs')}</dt>
      <dd>{formatResources(building.outputs)}</dd>
      <dt>{t('detail.inputs')}</dt>
      <dd>{formatResources(building.inputs)}</dd>
      {building.moneyOutput > 0 && (
        <>
          <dt>{t('detail.moneyOutput')}</dt>
          <dd>{building.moneyOutput}</dd>
        </>
      )}
      {building.housingCapacity > 0 && (
        <>
          <dt>{t('detail.housing')}</dt>
          <dd>+{building.housingCapacity}</dd>
        </>
      )}
      {building.storageCapacity > 0 && (
        <>
          <dt>{t('detail.storage')}</dt>
          <dd>+{building.storageCapacity}</dd>
        </>
      )}
      {building.service && (
        <>
          <dt>{t('detail.serviceRadius')}</dt>
          <dd>
            {t(`service.${building.service.type}`)}, {building.service.radius}
          </dd>
        </>
      )}
      <dt>{t('detail.workers')}</dt>
      <dd>{building.workersRequired}</dd>
      <dt>{t('detail.maintenance')}</dt>
      <dd>{building.maintenanceCost}</dd>
      <dt>{t('detail.requiresRoad')}</dt>
      <dd>{building.requiresRoad ? t('detail.yes') : t('detail.no')}</dd>
      <dt>{t('detail.terrain')}</dt>
      <dd>{building.allowedTerrain.map((terrain) => t(`terrain.${terrain}`)).join(', ')}</dd>
    </dl>
  );
}
