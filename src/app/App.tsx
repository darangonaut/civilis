import { BottomBar } from '@/components/BottomBar';
import { BuildingCatalog } from '@/components/BuildingCatalog';
import { DetailPanel } from '@/components/DetailPanel';
import { MapView } from '@/components/MapView';
import { TopBar } from '@/components/TopBar';
import { useEffect } from 'react';
import { controller } from './game';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

export function App() {
  useKeyboardShortcuts();
  useEffect(() => {
    controller.startLoop();
    return () => controller.stopLoop();
  }, []);

  return (
    <div className="game-layout">
      <TopBar />
      <BuildingCatalog />
      <MapView />
      <DetailPanel />
      <BottomBar />
    </div>
  );
}
