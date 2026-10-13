import { formatAmount } from '@/app/format';
import { controller } from '@/app/game';
import { commandReasonLabel, effectLabel, t } from '@/app/i18n';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import { validateResearch } from '@/engine';
import { useUiStore } from '@/stores/uiStore';
import type { TechnologyDefinition } from '@/types';
import { PanelFrame } from './PanelFrame';
import { Progress } from './Progress';

type TechStatus = 'completed' | 'active' | 'available' | 'locked';

export function ResearchPanel() {
  const research = useGameState((s) => s.research);
  const knowledge = useGameState((s) => s.city.economy.resources.knowledge);
  const knowledgeRate = useGameState((s) => s.city.economy.dailyProduction.knowledge ?? 0);
  const active = research.activeTechnologyId
    ? gameData.technologiesById.get(research.activeTechnologyId)
    : undefined;

  const statusOf = (tech: TechnologyDefinition): TechStatus => {
    if (research.completedTechnologyIds.includes(tech.id)) return 'completed';
    if (research.activeTechnologyId === tech.id) return 'active';
    return validateResearch(controller.state, gameData, tech.id).success ? 'available' : 'locked';
  };

  return (
    <PanelFrame title={t('research.title')} testId="research-panel">
      <div className="research-summary">
        <div>
          <span className="muted">{t('research.knowledge')}:</span> {formatAmount(knowledge)}
        </div>
        <div>
          <span className="muted">{t('research.knowledgeRate')}:</span> +
          {formatAmount(knowledgeRate)} / {t('topbar.perDay')}
          {knowledgeRate === 0 && <span className="muted"> · {t('research.noSchool')}</span>}
        </div>
        {active ? (
          <ActiveResearch
            tech={active}
            invested={research.investedKnowledge}
            rate={knowledgeRate}
          />
        ) : (
          <p className="muted">{t('research.noneActive')}</p>
        )}
      </div>
      <ul className="tech-list">
        {gameData.technologies.map((tech) => (
          <TechCard
            key={tech.id}
            tech={tech}
            status={statusOf(tech)}
            hasActive={active !== undefined}
          />
        ))}
      </ul>
    </PanelFrame>
  );
}

function ActiveResearch({
  tech,
  invested,
  rate,
}: {
  tech: TechnologyDefinition;
  invested: number;
  rate: number;
}) {
  const remaining = tech.cost - invested;
  return (
    <div className="active-research">
      <div>
        {t('research.active')}: <strong>{tech.name}</strong> — {formatAmount(invested)} /{' '}
        {tech.cost}
        {rate > 0 && (
          <span className="muted">
            {' '}
            · {t('research.daysLeft', { days: Math.ceil(remaining / rate) })}
          </span>
        )}
      </div>
      <Progress value={invested / tech.cost} />
    </div>
  );
}

function TechCard({
  tech,
  status,
  hasActive,
}: {
  tech: TechnologyDefinition;
  status: TechStatus;
  hasActive: boolean;
}) {
  const showNotice = useUiStore((s) => s.showNotice);
  const start = () => {
    const result = controller.execute({ type: 'START_RESEARCH', technologyId: tech.id });
    if (!result.success) showNotice(commandReasonLabel(result.reason));
  };
  const prerequisites = tech.prerequisites.map(
    (id) => gameData.technologiesById.get(id)?.name ?? id,
  );

  return (
    <li className={`tech-card ${status}`} data-tech-id={tech.id} data-status={status}>
      <div className="tech-header">
        <strong>{tech.name}</strong>
        <span className="tech-cost">
          {t('research.cost')}: {tech.cost}
        </span>
      </div>
      <div className="tech-effects">{tech.effects.map(effectLabel).join(', ')}</div>
      {prerequisites.length > 0 && (
        <div className="muted tech-prereq">
          {t('research.requires')}: {prerequisites.join(', ')}
        </div>
      )}
      <div className="tech-footer">
        {status === 'completed' && <span className="tag ok">{t('research.completed')}</span>}
        {status === 'active' && <span className="tag active">{t('research.active')}</span>}
        {status === 'locked' && <span className="tag">{t('research.locked')}</span>}
        {status === 'available' && (
          <button onClick={start} title={hasActive ? t('research.switchHint') : undefined}>
            {hasActive ? t('research.switch') : t('research.start')}
          </button>
        )}
      </div>
    </li>
  );
}
