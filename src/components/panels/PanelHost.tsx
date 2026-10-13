import { useUiStore } from '@/stores/uiStore';
import { MilestonesPanel } from './MilestonesPanel';
import { ResearchPanel } from './ResearchPanel';
import { StatisticsPanel } from './StatisticsPanel';

export function PanelHost() {
  const panel = useUiStore((s) => s.openPanel);
  if (panel === 'research') return <ResearchPanel />;
  if (panel === 'milestones') return <MilestonesPanel />;
  if (panel === 'statistics') return <StatisticsPanel />;
  return null;
}
