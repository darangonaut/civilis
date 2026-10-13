import { BottomBar } from '@/components/BottomBar';
import { BuildingCatalog } from '@/components/BuildingCatalog';
import { DetailPanel } from '@/components/DetailPanel';
import { MapView } from '@/components/MapView';
import { TopBar } from '@/components/TopBar';
import { VictoryDialog } from '@/components/VictoryDialog';
import { useEffect } from 'react';
import { controller } from './game';
import { installGameEventNotifications } from './gameEvents';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

export function App() {
  useKeyboardShortcuts();
  useEffect(() => {
    const uninstall = installGameEventNotifications();
    controller.startLoop();
    return () => {
      controller.stopLoop();
      uninstall();
    };
  }, []);

  return (
    <div className="game-layout">
      <TopBar />
      <BuildingCatalog />
      <MapView />
      <DetailPanel />
      <BottomBar />
      <VictoryDialog />
    </div>
  );
}
