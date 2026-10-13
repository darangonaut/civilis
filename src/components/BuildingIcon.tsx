import { drawBuilding } from '@/renderer/pixel/sprites';

interface Icon {
  url: string;
  width: number;
  height: number;
}

const cache = new Map<string, Icon>();

/** Pixelová ikona budovy (rovnaký sprite ako na mape), vytvorí sa raz. */
function icon(definitionId: string): Icon {
  let entry = cache.get(definitionId);
  if (!entry) {
    const { canvas } = drawBuilding(definitionId);
    entry = { url: canvas.toCanvas().toDataURL(), width: canvas.width, height: canvas.height };
    cache.set(definitionId, entry);
  }
  return entry;
}

/** Ikona v presnom 2× zväčšení (rovnomerné pixely), zarovnaná na spodok rámčeka. */
export function BuildingIcon({ definitionId }: { definitionId: string }) {
  const { url, width, height } = icon(definitionId);
  return (
    <span className="building-icon" aria-hidden>
      <img src={url} alt="" width={width * 2} height={height * 2} draggable={false} />
    </span>
  );
}
