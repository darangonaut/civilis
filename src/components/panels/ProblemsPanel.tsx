import { useState } from 'react';
import { centerOnTile } from '@/app/camera';
import { controller } from '@/app/game';
import { t } from '@/app/i18n';
import { buildingName } from '@/app/names';
import { buildingSize, problemGroups } from '@/app/problems';
import { useGameState } from '@/app/useGameState';
import { useUiStore } from '@/stores/uiStore';
import { PanelFrame } from './PanelFrame';

/** Koľko budov skupiny ukázať, kým sa nerozbalí. */
const PREVIEW = 6;

/** Prehľad budov s problémom podľa príčiny; klik presunie kameru na budovu. */
export function ProblemsPanel() {
  const groups = useGameState(() => problemGroups());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const selectInstance = useUiStore((s) => s.selectInstance);
  const togglePanel = useUiStore((s) => s.togglePanel);

  const show = (id: string) => {
    const building = controller.state.city.buildings.find((b) => b.id === id);
    if (!building) return;
    togglePanel(null);
    selectInstance(id);
    centerOnTile(building.position, buildingSize(building.definitionId));
  };

  return (
    <PanelFrame title={t('problems.title')} testId="problems-panel">
      {groups.length === 0 ? (
        <p className="all-done">{t('problems.none')}</p>
      ) : (
        <ul className="problem-groups">
          {groups.map((group) => {
            const open = expanded.has(group.key);
            const ids = open ? group.buildingIds : group.buildingIds.slice(0, PREVIEW);
            return (
              <li
                key={group.key}
                className={`problem-group ${group.code}`}
                data-problem={group.key}
              >
                <div className="problem-group-head">
                  <strong>⚠ {group.label}</strong>
                  <span className="tag">{group.buildingIds.length}</span>
                </div>
                <ul className="problem-buildings">
                  {ids.map((id) => {
                    const building = controller.state.city.buildings.find((b) => b.id === id)!;
                    return (
                      <li key={id}>
                        <button className="link-row" onClick={() => show(id)}>
                          <span>{buildingName(building.definitionId, building.level)}</span>
                          <span className="muted">
                            [{building.position.x}, {building.position.y}] ›
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {group.buildingIds.length > PREVIEW && (
                  <button
                    className="link-button"
                    onClick={() =>
                      setExpanded((s) => {
                        const next = new Set(s);
                        if (open) next.delete(group.key);
                        else next.add(group.key);
                        return next;
                      })
                    }
                  >
                    {open
                      ? t('problems.less')
                      : t('problems.more', { n: group.buildingIds.length - PREVIEW })}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="muted hint">{t('problems.hint')}</p>
    </PanelFrame>
  );
}
