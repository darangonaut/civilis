import { useUiStore } from '@/stores/uiStore';
import { MilestonesPanel } from './MilestonesPanel';
import { ResearchPanel } from './ResearchPanel';
import { SavesPanel } from './SavesPanel';
import { SettingsPanel } from './SettingsPanel';
import { StatisticsPanel } from './StatisticsPanel';

export function PanelHost() {
  const panel = useUiStore((s) => s.openPanel);
  if (panel === 'research') return <ResearchPanel />;
  if (panel === 'milestones') return <MilestonesPanel />;
  if (panel === 'statistics') return <StatisticsPanel />;
  if (panel === 'saves') return <SavesPanel />;
  if (panel === 'settings') return <SettingsPanel />;
  return null;
}
