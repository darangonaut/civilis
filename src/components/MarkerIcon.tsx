import { drawMarker, type MarkerKind } from '@/renderer/pixel/sprites';

const cache = new Map<MarkerKind, { url: string; width: number; height: number }>();

function icon(kind: MarkerKind) {
  let entry = cache.get(kind);
  if (!entry) {
    const { canvas } = drawMarker(kind);
    entry = { url: canvas.toCanvas().toDataURL(), width: canvas.width, height: canvas.height };
    cache.set(kind, entry);
  }
  return entry;
}

/** Rovnaká bublina ako na mape, 2× zväčšená. */
export function MarkerIcon({ kind }: { kind: MarkerKind }) {
  const { url, width, height } = icon(kind);
  return (
    <img
      className="marker-icon"
      src={url}
      alt=""
      width={width * 2}
      height={height * 2}
      aria-hidden
    />
  );
}
