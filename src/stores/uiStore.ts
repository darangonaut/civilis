import { create } from 'zustand';
import type { CameraView } from '@/renderer/GameRenderer';
import type { DayPhase } from '@/renderer/dayNight';
import type { BuildingCategory, Position, ServiceType } from '@/types';

/** Mapová vrstva: pokrytie službou alebo znečistenie. */
export type MapLayer = ServiceType | 'pollution';

export type PanelId =
  'research' | 'milestones' | 'trade' | 'problems' | 'statistics' | 'saves' | 'settings';

export type NoticeKind = 'info' | 'success' | 'warning';

export interface Notice {
  id: number;
  text: string;
  kind: NoticeKind;
}

/** Najviac toľko hlásení naraz; staršie odpadnú. */
const MAX_NOTICES = 4;
/** Záznam udalostí (vľavo pod cieľom) si pamätá posledných N. */
const MAX_LOG = 30;

export interface LogEntry {
  id: number;
  day: number;
  label: string;
  text: string;
  kind: NoticeKind;
}

interface UiState {
  catalogCategory: BuildingCategory;
  /** Typ budovy vybraný v doku = režim výstavby. */
  buildModeId: string | null;
  /** Úroveň, na ktorej sa budova postaví (vyššie úrovne domov rovno). */
  buildLevel: number;
  /** Režim búrania: ťahanie vyberie budovy na zbúranie (vylučuje sa s režimom výstavby). */
  demolishMode: boolean;
  /** Budovy z ťahania v režime búrania, ktoré čakajú na potvrdenie v dialógu. */
  pendingDemolish: string[] | null;
  /** Dlaždica doku pod kurzorom (karta s detailom). */
  hoveredDockTile: { id: string; level: number } | null;
  log: LogEntry[];
  dayPhase: DayPhase | null;
  cameraView: CameraView | null;
  /** Zapnutá mapová vrstva pokrytia službou. */
  mapLayer: MapLayer | null;
  /** Budova vybraná na mape. */
  selectedInstanceId: string | null;
  hoveredTile: Position | null;
  notices: Notice[];
  /** Panel otvorený zo spodnej lišty. */
  openPanel: PanelId | null;
  /** Zvýši sa po každej zmene uložených pozícií (panel si ich znova načíta). */
  savesRevision: number;
  /** Obrazovka úspechu po poslednom míľniku prvej éry. */
  victoryOpen: boolean;
  /** Okno kolonizačnej lode. */
  colonyOpen: boolean;
  /** Dotyková stavba: počet políčok čakajúcich na potvrdenie. */
  pendingBuild: number | null;
  /** Mobil: otvorený stavebný dok / menu panelov. */
  dockOpen: boolean;
  menuOpen: boolean;
  /** Úvodná obrazovka (pri štarte aplikácie, okrem E2E testov). */
  startScreen: boolean;
  /** Pri štarte sa obnovila rozohraná hra (tlačidlo Pokračovať). */
  hasSavedGame: boolean;
  /** Éra, ktorej uvítaciu obrazovku treba zobraziť. */
  newEraId: string | null;

  setCatalogCategory: (category: BuildingCategory) => void;
  setBuildMode: (id: string | null, level?: number) => void;
  setDemolishMode: (on: boolean) => void;
  setPendingDemolish: (ids: string[] | null) => void;
  setHoveredDockTile: (tile: { id: string; level: number } | null) => void;
  addLog: (entry: Omit<LogEntry, 'id'>) => void;
  clearLog: () => void;
  setDayPhase: (phase: DayPhase | null) => void;
  setCameraView: (view: CameraView) => void;
  setMapLayer: (layer: MapLayer | null) => void;
  selectInstance: (id: string | null) => void;
  setHoveredTile: (position: Position | null) => void;
  showNotice: (text: string, kind?: NoticeKind) => void;
  setVictoryOpen: (open: boolean) => void;
  setColonyOpen: (open: boolean) => void;
  setPendingBuild: (count: number | null) => void;
  setDockOpen: (open: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  openStartScreen: (hasSavedGame: boolean) => void;
  closeStartScreen: () => void;
  setNewEra: (eraId: string | null) => void;
  togglePanel: (panel: PanelId | null) => void;
  bumpSavesRevision: () => void;
  dismissNotice: (id: number) => void;
  /** Escape: postupne zruší potvrdenie búrania, režim výstavby/búrania, panel a výber. */
  cancel: () => void;
}

let noticeSeq = 0;

export const useUiStore = create<UiState>()((set, get) => ({
  catalogCategory: 'housing',
  buildModeId: null,
  buildLevel: 1,
  demolishMode: false,
  pendingDemolish: null,
  hoveredDockTile: null,
  log: [],
  dayPhase: null,
  cameraView: null,
  mapLayer: null,
  selectedInstanceId: null,
  hoveredTile: null,
  notices: [],
  openPanel: null,
  savesRevision: 0,
  victoryOpen: false,
  colonyOpen: false,
  pendingBuild: null,
  dockOpen: false,
  menuOpen: false,
  startScreen: false,
  hasSavedGame: false,
  newEraId: null,

  setCatalogCategory: (catalogCategory) => set({ catalogCategory }),
  setBuildMode: (buildModeId, buildLevel = 1) =>
    set({ buildModeId, buildLevel, selectedInstanceId: null, demolishMode: false }),
  setDemolishMode: (demolishMode) =>
    set({ demolishMode, buildModeId: null, selectedInstanceId: null, pendingDemolish: null }),
  setPendingDemolish: (pendingDemolish) => set({ pendingDemolish }),
  setHoveredDockTile: (hoveredDockTile) => set({ hoveredDockTile }),
  addLog: (entry) =>
    set((s) => ({ log: [{ ...entry, id: ++noticeSeq }, ...s.log].slice(0, MAX_LOG) })),
  clearLog: () => set({ log: [] }),
  setDayPhase: (dayPhase) => set({ dayPhase }),
  setCameraView: (cameraView) => set({ cameraView }),
  setMapLayer: (mapLayer) => set({ mapLayer }),
  selectInstance: (selectedInstanceId) =>
    set({ selectedInstanceId, buildModeId: null, demolishMode: false }),
  setHoveredTile: (hoveredTile) => set({ hoveredTile }),
  showNotice: (text, kind = 'info') =>
    set((s) => ({ notices: [...s.notices, { id: ++noticeSeq, text, kind }].slice(-MAX_NOTICES) })),
  dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
  setVictoryOpen: (victoryOpen) => set({ victoryOpen }),
  setColonyOpen: (colonyOpen) => set({ colonyOpen }),
  setPendingBuild: (pendingBuild) => set({ pendingBuild }),
  setDockOpen: (dockOpen) => set({ dockOpen }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  openStartScreen: (hasSavedGame) => set({ startScreen: true, hasSavedGame }),
  closeStartScreen: () => set({ startScreen: false }),
  setNewEra: (newEraId) => set({ newEraId }),
  bumpSavesRevision: () => set((s) => ({ savesRevision: s.savesRevision + 1 })),
  togglePanel: (panel) => set((s) => ({ openPanel: s.openPanel === panel ? null : panel })),
  cancel: () => {
    const { pendingDemolish, buildModeId, demolishMode, openPanel, selectedInstanceId } = get();
    if (pendingDemolish) set({ pendingDemolish: null });
    else if (buildModeId || demolishMode) set({ buildModeId: null, demolishMode: false });
    else if (openPanel) set({ openPanel: null });
    else if (selectedInstanceId) set({ selectedInstanceId: null });
  },
}));
