import { useEffect, useRef, useState } from 'react';
import { commandReasonLabel, t } from '@/app/i18n';
import { controller } from '@/app/game';
import { currentMarkers } from '@/app/markers';
import { installTestHook } from '@/app/testHook';
import { registerCameraTarget } from '@/app/camera';
import { gameData } from '@/data';
import type { GameRenderer } from '@/renderer/GameRenderer';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUiStore } from '@/stores/uiStore';
import type { Position } from '@/types';

/** Klik mimo režimu stavby vyberie budovu (stavba ide cez `handlePlaceMany`). */
function handleTileClick(position: Position): void {
  const ui = useUiStore.getState();
  const tile = controller.state.world.tiles[position.y * controller.state.world.width + position.x];
  ui.selectInstance(tile?.buildingId ?? null);
}

/** Ťahanie v režime stavby: postaví budovy postupne a zhrnie výsledok. */
function handlePlaceMany(buildingId: string, positions: Position[]): void {
  const ui = useUiStore.getState();
  const level = ui.buildLevel;
  let placed = 0;
  let firstFailure: string | null = null;
  for (const position of positions) {
    const result = controller.execute({ type: 'PLACE_BUILDING', buildingId, position, level });
    if (result.success) placed++;
    else firstFailure ??= result.reason;
  }
  if (positions.length === 1) {
    if (firstFailure) ui.showNotice(commandReasonLabel(firstFailure));
    return;
  }
  if (firstFailure) {
    ui.showNotice(
      t('build.partial', {
        placed,
        failed: positions.length - placed,
        reason: commandReasonLabel(firstFailure),
      }),
      placed > 0 ? 'info' : 'warning',
    );
  }
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
            onPlaceMany: handlePlaceMany,
            canPlace: (buildingId, position) =>
              controller.canPlace(buildingId, position, useUiStore.getState().buildLevel).success,
            onCameraChange: (view) => useUiStore.getState().setCameraView(view),
            onDayPhase: (phase) => useUiStore.getState().setDayPhase(phase),
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
        renderer.sync(controller.state, currentMarkers(), controller.activity);
        const display = useSettingsStore.getState();
        renderer.setEffectsOptions({ animations: display.animations, dayNight: display.dayNight });
        const ui = useUiStore.getState();
        renderer.setBuildMode(ui.buildModeId, ui.buildLevel);
        registerCameraTarget((wx, wy) => created.centerOnWorld(wx, wy));
        renderer.setSelectedInstance(ui.selectedInstanceId);

        unsubscribers.push(
          controller.subscribe(() =>
            created.sync(controller.state, currentMarkers(), controller.activity),
          ),
          useUiStore.subscribe((s, prev) => {
            if (s.buildModeId !== prev.buildModeId || s.buildLevel !== prev.buildLevel)
              created.setBuildMode(s.buildModeId, s.buildLevel);
            if (s.selectedInstanceId !== prev.selectedInstanceId)
              created.setSelectedInstance(s.selectedInstanceId);
          }),
          installTestHook(created),
          useSettingsStore.subscribe((display) =>
            created.setEffectsOptions({
              animations: display.animations,
              dayNight: display.dayNight,
            }),
          ),
        );
        setReady(true);
      });

    return () => {
      cancelled = true;
      unsubscribers.forEach((fn) => fn());
      registerCameraTarget(null);
      renderer?.destroy();
    };
  }, []);

  return (
    <main className="map-view" data-testid="map-view" data-ready={ready}>
      <div ref={hostRef} className="map-host" />
      {!ready && <p className="map-loading muted">{t('map.loading')}</p>}
    </main>
  );
}
