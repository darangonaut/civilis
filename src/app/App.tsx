import { BuildDock } from '@/components/hud/BuildDock';
import { GoalTracker } from '@/components/hud/GoalTracker';
import { Inspector } from '@/components/hud/Inspector';
import { QuickBar } from '@/components/hud/QuickBar';
import { TopHud } from '@/components/hud/TopHud';
import { MapInfo } from '@/components/MapInfo';
import { MapView } from '@/components/MapView';
import { NewEraDialog } from '@/components/NewEraDialog';
import { EventDialog } from '@/components/EventDialog';
import { DemolishDialog } from '@/components/DemolishDialog';
import { Notice } from '@/components/Notice';
import { PanelHost } from '@/components/panels/PanelHost';
import { VictoryDialog } from '@/components/VictoryDialog';
import { Fragment, useEffect } from 'react';
import { useLanguageStore } from '@/stores/languageStore';
import { useUiStore } from '@/stores/uiStore';
import { controller } from './game';
import { installGameEventNotifications } from './gameEvents';
import { installAutosave } from './saving';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

export function App() {
  useKeyboardShortcuts();
  useEffect(() => {
    const uninstallNotifications = installGameEventNotifications();
    const uninstallAutosave = installAutosave();
    controller.startLoop();
    return () => {
      controller.stopLoop();
      uninstallAutosave();
      uninstallNotifications();
    };
  }, []);

  const selected = useUiStore((s) => s.selectedInstanceId !== null);
  const language = useLanguageStore((s) => s.language);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  // Mapa je na celú obrazovku, ovládanie pláva nad ňou.
  return (
    <div className={`game-layout${selected ? ' has-selection' : ''}`}>
      <MapView />
      {/* Zmena jazyka prekreslí celé rozhranie (mapa zostane, texty v nej nie sú). */}
      <Fragment key={language}>
        <TopHud />
        <GoalTracker />
        <Inspector />
        <BuildDock />
        <QuickBar />
        <MapInfo />
        <Notice />
        <PanelHost />
        <NewEraDialog />
        <EventDialog />
        <DemolishDialog />
        <VictoryDialog />
      </Fragment>
    </div>
  );
}
