import { useEffect, useRef, useState } from 'react';
import { commandReasonLabel, t } from '@/app/i18n';
import { controller } from '@/app/game';
import { currentMarkers } from '@/app/markers';
import { installTestHook } from '@/app/testHook';
import { gameData } from '@/data';
import type { GameRenderer } from '@/renderer/GameRenderer';
import { useUiStore } from '@/stores/uiStore';
import type { Position } from '@/types';
import { MapInfo } from './MapInfo';
import { Notice } from './Notice';
import { PanelHost } from './panels/PanelHost';

function handleTileClick(position: Position): void {
  const ui = useUiStore.getState();
  if (ui.buildModeId) {
    const result = controller.execute({
      type: 'PLACE_BUILDING',
      buildingId: ui.buildModeId,
      position,
    });
    if (!result.success) ui.showNotice(commandReasonLabel(result.reason));
    return;
  }
  const tile = controller.state.world.tiles[position.y * controller.state.world.width + position.x];
  ui.selectInstance(tile?.buildingId ?? null);
}

export function MapView() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current!;
    let renderer: GameRenderer | null = null;
    let cancelled = false;
    const unsubscribers: (() => void)[] = [];

    // PixiJS sa načíta samostatne, aby neblokoval prvé vykreslenie rozhrania.
    void import('@/renderer/GameRenderer')
      .then(({ GameRenderer }) =>
        GameRenderer.create(
          host,
          gameData.buildings.map((b) => b.id),
          {
            onTileHover: (position) => useUiStore.getState().setHoveredTile(position),
            onTileClick: handleTileClick,
            canPlace: (buildingId, position) => controller.canPlace(buildingId, position).success,
          },
        ),
      )
      .then((created) => {
        // StrictMode montuje efekt dvakrát; neskoro dokončený renderer hneď zrušíme.
        if (cancelled) {
          created.destroy();
          return;
        }
        renderer = created;
        renderer.sync(controller.state, currentMarkers());
        const ui = useUiStore.getState();
        renderer.setBuildMode(ui.buildModeId);
        renderer.setSelectedInstance(ui.selectedInstanceId);

        unsubscribers.push(
          controller.subscribe(() => created.sync(controller.state, currentMarkers())),
          useUiStore.subscribe((s, prev) => {
            if (s.buildModeId !== prev.buildModeId) created.setBuildMode(s.buildModeId);
            if (s.selectedInstanceId !== prev.selectedInstanceId)
              created.setSelectedInstance(s.selectedInstanceId);
          }),
          installTestHook(created),
        );
        setReady(true);
      });

    return () => {
      cancelled = true;
      unsubscribers.forEach((fn) => fn());
      renderer?.destroy();
    };
  }, []);

  return (
    <main className="map-view" data-testid="map-view" data-ready={ready}>
      <div ref={hostRef} className="map-host" />
      {!ready && <p className="map-loading muted">{t('map.loading')}</p>}
      <MapInfo />
      <PanelHost />
      <Notice />
    </main>
  );
}
