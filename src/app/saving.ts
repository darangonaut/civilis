import { AUTOSAVE_SLOT_ID, MANUAL_SLOT_IDS, type SlotId } from '@/persistence/db';
import { SaveError } from '@/persistence/migrations';
import { writeUnloadSnapshot } from '@/persistence/unloadSnapshot';
import { gameData } from '@/data';
import { useUiStore } from '@/stores/uiStore';
import type { DifficultyId, GameState } from '@/types';
import { controller, createFreshGame, saveService } from './game';
import { t, type TranslationKey } from './i18n';

/** Automatické uloženie každých 30 herných dní (špecifikácia 8). */
export const AUTOSAVE_INTERVAL_DAYS = 30;

let lastManualSlot: SlotId = MANUAL_SLOT_IDS[0];
// Zápisy idú za sebou, aby sa neprekrývali.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export function saveErrorMessage(error: unknown): string {
  if (error instanceof SaveError) return t(`saveError.${error.code}` as TranslationKey);
  return t('saveError.unknown');
}

/** Uloží aktuálnu hru do pozície. Funguje aj počas pauzy. */
export async function saveToSlot(slotId: SlotId): Promise<boolean> {
  const ui = useUiStore.getState();
  try {
    await enqueue(() => saveService.save(slotId, controller.serialize(), new Date().toISOString()));
    if (slotId !== AUTOSAVE_SLOT_ID) {
      lastManualSlot = slotId;
      ui.showNotice(t('save.saved', { slot: slotLabel(slotId) }), 'success');
    }
    ui.bumpSavesRevision();
    return true;
  } catch (error) {
    ui.showNotice(`${t('save.failed')}: ${saveErrorMessage(error)}`, 'warning');
    return false;
  }
}

/** Ctrl/Cmd+S — uloží do naposledy použitej manuálnej pozície. */
export function quickSave(): Promise<boolean> {
  return saveToSlot(lastManualSlot);
}

export function autosave(): Promise<boolean> {
  return saveToSlot(AUTOSAVE_SLOT_ID);
}

function applyLoadedState(state: GameState, message: string): void {
  controller.load(state);
  const ui = useUiStore.getState();
  ui.selectInstance(null);
  ui.setBuildMode(null);
  ui.setVictoryOpen(false);
  ui.setNewEra(null);
  ui.showNotice(message, 'success');
}

export async function loadFromSlot(slotId: SlotId): Promise<void> {
  try {
    const state = await saveService.load(slotId);
    if (!state) return;
    if (slotId !== AUTOSAVE_SLOT_ID) lastManualSlot = slotId;
    applyLoadedState(state, t('save.loaded', { slot: slotLabel(slotId) }));
  } catch (error) {
    useUiStore
      .getState()
      .showNotice(`${t('save.loadFailed')}: ${saveErrorMessage(error)}`, 'warning');
  }
}

export async function deleteSlot(slotId: SlotId): Promise<void> {
  await enqueue(() => saveService.remove(slotId));
  useUiStore.getState().bumpSavesRevision();
}

/** Stiahne aktuálnu hru ako JSON súbor. */
export function exportCurrentGame(): void {
  const state = controller.serialize();
  const json = saveService.exportJson(state, new Date().toISOString());
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `civilis-den-${state.simulation.day}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importGameFile(file: File): Promise<void> {
  try {
    const state = saveService.importJson(await file.text());
    applyLoadedState(state, t('save.imported'));
  } catch (error) {
    useUiStore
      .getState()
      .showNotice(`${t('save.importFailed')}: ${saveErrorMessage(error)}`, 'warning');
  }
}

/** Nové mesto kolónie: po načítaní ukáže úvod prvej éry planéty (havarijný tábor). */
export function startColonyGame(state: GameState, message: string): void {
  applyLoadedState(state, message);
  useUiStore.setState({ openPanel: null });
  useUiStore.getState().setNewEra(gameData.eras[0]?.id ?? null);
}

export function startNewGame(seed?: number, difficulty?: DifficultyId): void {
  applyLoadedState(createFreshGame(seed, difficulty), t('settings.newGameStarted'));
}

export function slotLabel(slotId: SlotId): string {
  if (slotId === AUTOSAVE_SLOT_ID) return t('save.autosave');
  return t('save.slot', { n: MANUAL_SLOT_IDS.indexOf(slotId) + 1 });
}

/**
 * Automatické ukladanie: každých 30 herných dní a pri opustení obrazovky
 * (skrytie karty, zatvorenie alebo obnovenie stránky).
 */
export function installAutosave(): () => void {
  const unsubscribe = controller.onDayAdvanced((day) => {
    if (day > 0 && day % AUTOSAVE_INTERVAL_DAYS === 0) void autosave();
  });
  const onHide = () => {
    if (document.visibilityState === 'hidden') void autosave();
  };
  const onPageHide = () => {
    // Synchronná záloha — async zápis do IndexedDB by sa pri zatváraní nemusel dokončiť.
    writeUnloadSnapshot(saveService.exportJson(controller.serialize(), new Date().toISOString()));
    void autosave();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);
  return () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onPageHide);
  };
}
