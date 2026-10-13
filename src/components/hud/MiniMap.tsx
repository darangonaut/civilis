import { useEffect, useRef, type PointerEvent } from 'react';
import { centerCamera } from '@/app/camera';
import { controller } from '@/app/game';
import { t } from '@/app/i18n';
import { gameData } from '@/data';
import { drawMinimap, minimapLayout, minimapToWorld, viewToMinimap } from '@/renderer/minimap';
import { useUiStore } from '@/stores/uiStore';

const WIDTH = 272;
/** Prekreslenie mapy najviac raz za takýto čas (budovy pribúdajú postupne). */
const REDRAW_MS = 400;

/** Minimapa celej mapy s rámikom výhľadu; klik alebo ťahanie presúva kameru. */
export function MiniMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useUiStore((s) => s.cameraView);
  const state = controller.state;
  const layout = minimapLayout(state, WIDTH);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let timer: number | null = null;
    const draw = () => {
      timer = null;
      const current = controller.state;
      drawMinimap(ctx, current, gameData, minimapLayout(current, WIDTH));
    };
    draw();
    const unsubscribe = controller.subscribe(() => {
      timer ??= window.setTimeout(draw, REDRAW_MS);
    });
    return () => {
      unsubscribe();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const world = minimapToWorld(
      event.clientX - rect.left,
      event.clientY - rect.top,
      controller.state,
      layout,
    );
    centerCamera(world.x, world.y);
  };

  const rect = view ? viewToMinimap(view, state, layout) : null;
  return (
    <div
      className="hud-panel minimap"
      style={{ width: layout.width, height: layout.height }}
      aria-label={t('hud.minimap')}
      role="img"
      data-testid="minimap"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        moveTo(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons & 1) moveTo(event);
      }}
    >
      <canvas ref={canvasRef} width={layout.width} height={layout.height} />
      {rect && (
        <div
          className="minimap-view"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
        />
      )}
      <span className="minimap-size">
        {state.world.width} × {state.world.height}
      </span>
    </div>
  );
}
