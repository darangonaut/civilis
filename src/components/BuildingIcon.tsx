import { gameData } from '@/data';
import { buildingSpriteKey, drawBuilding } from '@/renderer/pixel/sprites';

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

/** Kolónia: základný kľúč (`farm`, `house@2`) → vzhľad budovy na planéte hry. */
function planetKey(key: string): string {
  const planet = gameData.planet.id;
  const match = /^([a-z_]+)(?:@(\d+))?$/.exec(key);
  if (planet === 'earth' || !match) return key;
  return buildingSpriteKey(match[1]!, Number(match[2] ?? 1), [], planet);
}

/** Ikona v presnom celočíselnom zväčšení (rovnomerné pixely), zarovnaná na spodok rámčeka. */
export function BuildingIcon({
  definitionId,
  spriteKey,
}: {
  definitionId?: string;
  spriteKey?: string;
}) {
  const { url, width, height } = icon(planetKey(spriteKey ?? definitionId ?? 'house'));
  // Divy (2 × 2) majú dvakrát širšie plátno — ikona v 1× mierke, aby sa zmestila.
  const scale = width > 40 ? 1 : 2;
  return (
    <span className="building-icon" aria-hidden>
      <img src={url} alt="" width={width * scale} height={height * scale} draggable={false} />
    </span>
  );
}
