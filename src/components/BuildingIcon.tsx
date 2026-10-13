import { drawBuilding } from '@/renderer/pixel/sprites';

interface Icon {
  url: string;
  width: number;
  height: number;
}

const cache = new Map<string, Icon>();

/** Pixelová ikona budovy podľa kľúča sprite-u (napr. `house@3`), vytvorí sa raz. */
function icon(spriteKey: string): Icon {
  let entry = cache.get(spriteKey);
  if (!entry) {
    const { canvas } = drawBuilding(spriteKey);
    entry = { url: canvas.toCanvas().toDataURL(), width: canvas.width, height: canvas.height };
    cache.set(spriteKey, entry);
  }
  return entry;
}

/** Ikona v presnom 2× zväčšení (rovnomerné pixely), zarovnaná na spodok rámčeka. */
export function BuildingIcon({
  definitionId,
  spriteKey,
}: {
  definitionId?: string;
  spriteKey?: string;
}) {
  const { url, width, height } = icon(spriteKey ?? definitionId ?? 'house');
  return (
    <span className="building-icon" aria-hidden>
      <img src={url} alt="" width={width * 2} height={height * 2} draggable={false} />
    </span>
  );
}
