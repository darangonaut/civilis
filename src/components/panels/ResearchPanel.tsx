import { useState } from 'react';
import { buildingName, eraName, techName } from '@/app/names';
import { formatAmount, formatCompact } from '@/app/format';
import { controller } from '@/app/game';
import { commandReasonLabel, effectLabel, t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { currentEraIndex, validateResearch } from '@/engine';
import { useUiStore } from '@/stores/uiStore';
import type { ResearchState, TechnologyDefinition } from '@/types';
import { BuildingIcon } from '../BuildingIcon';
import { ResourceIcon } from '../ResourceIcon';
import { PanelFrame } from './PanelFrame';

type TechStatus = 'completed' | 'active' | 'available' | 'locked';

const NODE_W = 220;
const NODE_H = 92;
const GAP_X = 56;
const GAP_Y = 18;

/** Čo technológia odomyká: nové budovy aj vyššie úrovne budov (sprite + názov). */
const unlocks = new Map<string, { spriteKey: string; buildingId: string; level: number }[]>();
for (const building of gameData.buildings) {
  if (building.requiredTechnologyId) {
    const list = unlocks.get(building.requiredTechnologyId) ?? [];
    list.push({ spriteKey: building.id, buildingId: building.id, level: 1 });
    unlocks.set(building.requiredTechnologyId, list);
  }
  building.levels?.forEach((level, index) => {
    if (!level.requiredTechnologyId) return;
    const list = unlocks.get(level.requiredTechnologyId) ?? [];
    list.push({
      spriteKey: `${building.id}@${index + 2}`,
      buildingId: building.id,
      level: index + 2,
    });
    unlocks.set(level.requiredTechnologyId, list);
  });
}

interface Node {
  tech: TechnologyDefinition;
  x: number;
  y: number;
}

/** Rozloženie stromu éry: stĺpec = hĺbka prerekvizít v rámci éry. */
function layoutEra(eraId: string): { nodes: Node[]; width: number; height: number } {
  const techs = gameData.technologies.filter((tech) => tech.era === eraId);
  const ids = new Set(techs.map((tech) => tech.id));
  const depth = new Map<string, number>();
  const depthOf = (tech: TechnologyDefinition): number => {
    const cached = depth.get(tech.id);
    if (cached !== undefined) return cached;
    const inEra = tech.prerequisites.filter((id) => ids.has(id));
    const d = inEra.length
      ? 1 + Math.max(...inEra.map((id) => depthOf(gameData.technologiesById.get(id)!)))
      : 0;
    depth.set(tech.id, d);
    return d;
  };
  const columns: TechnologyDefinition[][] = [];
  for (const tech of techs) (columns[depthOf(tech)] ??= []).push(tech);
  const rows = Math.max(...columns.map((c) => c.length));
  const height = rows * NODE_H + (rows - 1) * GAP_Y;
  const nodes = columns.flatMap((column, col) => {
    const columnHeight = column.length * NODE_H + (column.length - 1) * GAP_Y;
    const top = (height - columnHeight) / 2;
    return column.map((tech, row) => ({
      tech,
      x: col * (NODE_W + GAP_X),
      y: top + row * (NODE_H + GAP_Y),
    }));
  });
  return { nodes, width: columns.length * (NODE_W + GAP_X) - GAP_X, height };
}

function statusOf(research: ResearchState, tech: TechnologyDefinition): TechStatus {
  if (research.completedTechnologyIds.includes(tech.id)) return 'completed';
  if (research.activeTechnologyId === tech.id) return 'active';
  return validateResearch(controller.state, gameData, tech.id).success ? 'available' : 'locked';
}

export function ResearchPanel() {
  const research = useGameState((s) => s.research);
  const knowledge = useGameState((s) => s.city.economy.resources.knowledge);
  const rate = useGameState((s) => s.city.economy.dailyProduction.knowledge ?? 0);
  const eraIndex = useGameState((s) => currentEraIndex(s, gameData));
  const [tab, setTab] = useState(eraIndex);
  const era = gameData.eras[Math.min(tab, eraIndex)]!;
  const active = research.activeTechnologyId
    ? gameData.technologiesById.get(research.activeTechnologyId)
    : undefined;
  const defaultSelection =
    active ??
    gameData.technologies.find(
      (tech) => tech.era === era.id && statusOf(research, tech) === 'available',
    );
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultSelection?.id);
  const selected =
    (selectedId && gameData.technologiesById.get(selectedId)) || defaultSelection || undefined;

  const ratio = active ? research.investedKnowledge / active.cost : 0;
  const header = (
    <div className="research-header">
      <span className="research-knowledge" title={t('research.knowledge')}>
        <ResourceIcon kind="knowledge" />
        <span className="num">{formatCompact(knowledge)}</span>
        <span className="muted">
          +{formatAmount(rate)} / {t('topbar.perDay')}
        </span>
      </span>
      {active ? (
        <span className="research-active">
          <span className="muted">
            {t('research.active')}: <span className="text">{techName(active.id)}</span>
          </span>
          <span className="bar thick green">
            <span style={{ width: `${ratio * 100}%` }} />
          </span>
          <span className="num">
            {Math.floor(ratio * 100)} %
            {rate > 0 &&
              ` · ${t('research.daysLeft', {
                days: Math.ceil((active.cost - research.investedKnowledge) / rate),
              })}`}
          </span>
        </span>
      ) : (
        <span className="research-active muted">
          {t('research.noneActive')}
          {rate === 0 && ` ${t('research.noSchool')}`}
        </span>
      )}
    </div>
  );

  return (
    <PanelFrame title={t('research.title')} testId="research-panel" wide header={header}>
      <div className="era-tabs" role="tablist" aria-label={t('research.eras')}>
        {gameData.eras.map((e, index) => {
          const techs = gameData.technologies.filter((tech) => tech.era === e.id);
          const done = techs.filter((tech) =>
            research.completedTechnologyIds.includes(tech.id),
          ).length;
          const locked = index > eraIndex;
          return (
            <button
              key={e.id}
              role="tab"
              aria-selected={e.id === era.id}
              disabled={locked}
              title={
                locked
                  ? t('research.eraLocked', { era: eraName(gameData.eras[index - 1]!.id) })
                  : undefined
              }
              className={`${e.id === era.id ? 'active' : ''}${done === techs.length ? ' done' : ''}`}
              onClick={() => setTab(index)}
              data-era-id={e.id}
            >
              {done === techs.length && '✓ '}
              {eraName(e.id)}
              {!locked && done < techs.length && (
                <span className="tab-count">
                  {done}/{techs.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="research-body">
        <TechTree
          eraId={era.id}
          research={research}
          selectedId={selected?.id}
          onSelect={setSelectedId}
        />
        <aside className="research-side">
          {selected && <TechDetail tech={selected} research={research} />}
          <ResearchQueue research={research} />
        </aside>
      </div>
    </PanelFrame>
  );
}

function TechTree({
  eraId,
  research,
  selectedId,
  onSelect,
}: {
  eraId: string;
  research: ResearchState;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const { nodes, width, height } = layoutEra(eraId);
  const byId = new Map(nodes.map((node) => [node.tech.id, node]));
  const external = [
    ...new Set(nodes.flatMap((node) => node.tech.prerequisites.filter((id) => !byId.has(id)))),
  ];

  return (
    <div className="tech-tree">
      {external.length > 0 && (
        <span className="tree-external">
          {t('research.fromPrevious')}:{' '}
          {external.map((id) => {
            const done = research.completedTechnologyIds.includes(id);
            return (
              <span key={id} className={done ? 'met' : 'unmet'}>
                {done ? '✓' : '○'} {techName(id)}{' '}
              </span>
            );
          })}
        </span>
      )}
      <div className="tree-canvas" style={{ width, height }}>
        <svg className="tree-links" width={width} height={height} aria-hidden>
          {nodes.flatMap((node) =>
            node.tech.prerequisites
              .map((id) => byId.get(id))
              .filter((from): from is Node => from !== undefined)
              .map((from) => {
                const x1 = from.x + NODE_W;
                const y1 = from.y + NODE_H / 2;
                const x2 = node.x;
                const y2 = node.y + NODE_H / 2;
                const mid = x1 + GAP_X / 2;
                const done = research.completedTechnologyIds.includes(from.tech.id);
                return (
                  <path
                    key={`${from.tech.id}-${node.tech.id}`}
                    d={`M${x1} ${y1}H${mid}V${y2}H${x2}`}
                    className={done ? 'done' : ''}
                  />
                );
              }),
          )}
        </svg>
        {nodes.map((node) => (
          <TechNode
            key={node.tech.id}
            node={node}
            status={statusOf(research, node.tech)}
            research={research}
            selected={node.tech.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className="tree-legend">
        <span className="legend completed">{t('research.completed')}</span>
        <span className="legend active">{t('research.active')}</span>
        <span className="legend available">{t('research.available')}</span>
        <span className="legend locked">{t('research.locked')}</span>
      </div>
    </div>
  );
}

function useStartResearch() {
  const showNotice = useUiStore((s) => s.showNotice);
  return (id: string) => {
    const result = controller.execute({ type: 'START_RESEARCH', technologyId: id });
    if (!result.success) showNotice(commandReasonLabel(result.reason));
  };
}

function TechNode({
  node,
  status,
  research,
  selected,
  onSelect,
}: {
  node: Node;
  status: TechStatus;
  research: ResearchState;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const start = useStartResearch();
  const { tech } = node;
  const queueIndex = research.queue.indexOf(tech.id);
  const icons = unlocks.get(tech.id) ?? [];
  const ratio = status === 'active' ? research.investedKnowledge / tech.cost : 0;

  return (
    <div
      className={`tech-node ${status}${selected ? ' selected' : ''}`}
      style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
      data-tech-id={tech.id}
      data-status={status}
      onClick={() => onSelect(tech.id)}
    >
      <div className="tech-node-head">
        <span className="tech-node-name">{techName(tech.id)}</span>
        <span className="tech-node-badge">
          {status === 'completed' ? (
            '✓'
          ) : status === 'active' ? (
            `${Math.floor(ratio * 100)} %`
          ) : queueIndex >= 0 ? (
            <span className="queue-badge" title={t('research.queued')}>
              #{queueIndex + 1}
            </span>
          ) : (
            <span className="num">{formatCompact(tech.cost)}</span>
          )}
        </span>
      </div>
      <span className="tech-node-effects">{tech.effects.map(effectLabel).join(' · ')}</span>
      {status === 'active' ? (
        <span className="bar green">
          <span style={{ width: `${ratio * 100}%` }} />
        </span>
      ) : (
        <div className="tech-node-foot">
          {icons.length > 0 && (
            <span
              className="tech-unlocks"
              title={icons.map((i) => buildingName(i.buildingId, i.level)).join(', ')}
            >
              {icons.slice(0, 4).map((icon) => (
                <span key={icon.spriteKey} className="mini-icon">
                  <BuildingIcon spriteKey={icon.spriteKey} />
                </span>
              ))}
            </span>
          )}
          {status === 'available' && (
            <button
              className="btn small"
              onClick={(event) => {
                event.stopPropagation();
                start(tech.id);
              }}
              title={research.activeTechnologyId ? t('research.switchHint') : undefined}
            >
              {research.activeTechnologyId ? t('research.switch') : t('research.start')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TechDetail({ tech, research }: { tech: TechnologyDefinition; research: ResearchState }) {
  const start = useStartResearch();
  const showNotice = useUiStore((s) => s.showNotice);
  const status = statusOf(research, tech);
  const icons = unlocks.get(tech.id) ?? [];
  const queued = research.queue.includes(tech.id);

  const enqueue = () => {
    const result = controller.execute({
      type: 'SET_RESEARCH_QUEUE',
      technologyIds: [...research.queue, tech.id],
    });
    if (!result.success) showNotice(commandReasonLabel(result.reason));
  };

  return (
    <div className="tech-detail" data-testid="tech-detail">
      <span className="hud-caption">{t('research.selected')}</span>
      <div className="tech-detail-head">
        {icons[0] && (
          <span className="inspector-icon">
            <BuildingIcon spriteKey={icons[0].spriteKey} />
          </span>
        )}
        <div>
          <span className="tech-detail-name">{techName(tech.id)}</span>
          <span className="muted">
            {t('research.cost')}: {formatCompact(tech.cost)}
          </span>
        </div>
      </div>
      <ul className="tech-detail-list">
        {tech.effects.map((effect, i) => (
          <li key={i}>{effectLabel(effect)}</li>
        ))}
        {icons.map((icon) => (
          <li key={icon.spriteKey}>
            {t('research.unlocks')}: {buildingName(icon.buildingId, icon.level)}
          </li>
        ))}
      </ul>
      {tech.prerequisites.length > 0 && (
        <div className="muted">
          {t('research.requires')}: {tech.prerequisites.map(techName).join(', ')}
        </div>
      )}
      <div className="tech-detail-actions">
        {status === 'available' && (
          <button className="btn primary" onClick={() => start(tech.id)}>
            {research.activeTechnologyId ? t('research.switch') : t('research.start')}
          </button>
        )}
        {(status === 'available' || status === 'locked') && !queued && (
          <button className="btn" onClick={enqueue} data-testid="enqueue">
            {t('research.enqueue')}
          </button>
        )}
        {status === 'completed' && <span className="tag ok">{t('research.completed')}</span>}
        {status === 'active' && <span className="tag active">{t('research.active')}</span>}
      </div>
    </div>
  );
}

function ResearchQueue({ research }: { research: ResearchState }) {
  const showNotice = useUiStore((s) => s.showNotice);
  const setQueue = (ids: string[]) => {
    const result = controller.execute({ type: 'SET_RESEARCH_QUEUE', technologyIds: ids });
    if (!result.success) showNotice(commandReasonLabel(result.reason));
  };
  // Odobratie technológie odoberie aj tie, ktoré na nej v poradí závisia.
  const remove = (id: string) => {
    const removed = new Set([id]);
    const next: string[] = [];
    for (const queued of research.queue) {
      const tech = gameData.technologiesById.get(queued)!;
      if (removed.has(queued) || tech.prerequisites.some((p) => removed.has(p)))
        removed.add(queued);
      else next.push(queued);
    }
    setQueue(next);
  };

  return (
    <div className="research-queue" data-testid="research-queue">
      <span className="hud-caption">{t('research.queue')}</span>
      {research.queue.length === 0 ? (
        <p className="muted hint">{t('research.queueEmpty')}</p>
      ) : (
        <ol>
          {research.queue.map((id) => (
            <li key={id}>
              <span>{techName(id)}</span>
              <button
                className="icon-button"
                onClick={() => remove(id)}
                aria-label={t('research.dequeue')}
                title={t('research.dequeue')}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
