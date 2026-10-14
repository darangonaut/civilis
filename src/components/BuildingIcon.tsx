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

/** Ikona v presnom celočíselnom zväčšení (rovnomerné pixely), zarovnaná na spodok rámčeka. */
export function BuildingIcon({
  definitionId,
  spriteKey,
}: {
  definitionId?: string;
  spriteKey?: string;
}) {
  const { url, width, height } = icon(spriteKey ?? definitionId ?? 'house');
  // Divy (2 × 2) majú dvakrát širšie plátno — ikona v 1× mierke, aby sa zmestila.
  const scale = width > 40 ? 1 : 2;
  return (
    <span className="building-icon" aria-hidden>
      <img src={url} alt="" width={width * scale} height={height * scale} draggable={false} />
    </span>
  );
}
