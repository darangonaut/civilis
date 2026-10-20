import { loadGameData, type GameData } from '@/engine/core/definitions';
import type { PlanetId } from '@/types';
import achievements from './achievements.json';
import balance from './balance.json';
import events from './events.json';
import buildings from './buildings.json';
import eras from './eras.json';
import milestones from './milestones.json';
import planets from './planets.json';
import technologies from './technologies.json';

const raw = { eras, buildings, technologies, milestones, achievements, events, balance, planets };
const cache = new Map<PlanetId, GameData>();

/** Validované herné dáta upravené pre planétu (výsledok sa pamätá). */
export function dataForPlanet(planet: PlanetId): GameData {
  let data = cache.get(planet);
  if (!data) {
    data = loadGameData(raw, planet);
    cache.set(planet, data);
  }
  return data;
}

/**
 * Herné dáta planéty aktuálnej hry. Pri neplatných JSON súboroch aplikácia zlyhá hneď
 * pri štarte. Väzba je živá — po `setActivePlanet` ju všetky importy vidia novú.
 */
export let gameData: GameData = dataForPlanet('earth');

/** Prepne herné dáta na planétu načítanej hry a vráti ich. */
export function setActivePlanet(planet: PlanetId): GameData {
  gameData = dataForPlanet(planet);
  return gameData;
}

// Všetky planéty sa validujú hneď, aby chyba v úpravách nevyskočila až pri kolonizácii.
for (const { id } of gameData.planets) dataForPlanet(id);
