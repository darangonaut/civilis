import { loadGameData } from '@/engine/core/definitions';
import balance from '@/data/balance.json';
import buildings from '@/data/buildings.json';
import eras from '@/data/eras.json';
import milestones from '@/data/milestones.json';
import technologies from '@/data/technologies.json';

/** Skutočné herné dáta zo `src/data`. */
export const testData = loadGameData({ eras, buildings, technologies, milestones, balance });

/**
 * Herné dáta bez základného zberu — ekonomické testy tak merajú iba výrobu budov.
 * Ostatné hodnoty sú skutočné, testy ich čítajú z dát.
 */
export const economyTestData = loadGameData({
  eras,
  buildings,
  technologies,
  milestones,
  balance: { ...balance, baseProduction: {} },
});

export const def = (id: string) => economyTestData.buildingsById.get(id)!;
