import { drawIcon, type IconKind } from '@/renderer/pixel/sprites';

const cache = new Map<IconKind, string>();

/** Pixelová ikona suroviny alebo peňazí (8 px, zväčšená `scale`-krát). */
export function ResourceIcon({
  kind,
  scale = 2,
  title,
}: {
  kind: IconKind;
  scale?: number;
  title?: string;
}) {
  let url = cache.get(kind);
  if (!url) {
    url = drawIcon(kind).toCanvas().toDataURL();
    cache.set(kind, url);
  }
  return (
    <img
      className="resource-icon"
      src={url}
      width={8 * scale}
      height={8 * scale}
      alt={title ?? ''}
      title={title}
      aria-hidden={title ? undefined : true}
    />
  );
}
