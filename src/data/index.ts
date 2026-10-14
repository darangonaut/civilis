import { loadGameData, type GameData } from '@/engine/core/definitions';
import achievements from './achievements.json';
import balance from './balance.json';
import events from './events.json';
import buildings from './buildings.json';
import eras from './eras.json';
import milestones from './milestones.json';
import technologies from './technologies.json';

/** Validované herné dáta. Pri neplatných JSON súboroch aplikácia zlyhá hneď pri štarte. */
export const gameData: GameData = loadGameData({
  eras,
  buildings,
  technologies,
  milestones,
  achievements,
  events,
  balance,
});
