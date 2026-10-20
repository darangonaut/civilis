import { gameData } from '@/data';
import { colonyLaunchBlock } from '@/engine';
import { MANUAL_SLOT_IDS, type SlotId } from '@/persistence/db';
import type { PlanetId } from '@/types';
import { controller, createFreshGame, randomSeed, saveService } from './game';
import { t } from './i18n';
import { startColonyGame, saveToSlot } from './saving';

/** Prvá voľná manuálna pozícia, kam sa uloží mesto pred odletom (null = všetky obsadené). */
export async function freeSlotForColony(): Promise<SlotId | null> {
  const used = new Set((await saveService.list()).map((slot) => slot.id));
  return MANUAL_SLOT_IDS.find((id) => !used.has(id)) ?? null;
}

/**
 * Vyšle kolonizačnú loď: uloží terajšie mesto (ak je voľná pozícia) a založí nové mesto
 * na planéte so zdedenými výhodami. Vráti false, ak loď ešte nemôže odletieť.
 */
export async function launchColony(legacyId: string, planet: PlanetId = 'mars'): Promise<boolean> {
  const state = controller.state;
  if (colonyLaunchBlock(state, gameData) !== null) return false;
  if (!gameData.legacies.some((l) => l.id === legacyId)) return false;
  if (state.colony.legacyIds.includes(legacyId)) return false;

  const slot = await freeSlotForColony();
  if (slot) await saveToSlot(slot);

  const colonyState = createFreshGame(randomSeed(), state.difficulty, planet, {
    generation: state.colony.generation + 1,
    legacyIds: [...state.colony.legacyIds, legacyId],
    originCity: state.city.name,
  });
  startColonyGame(colonyState, t('colony.landed'));
  return true;
}
