import { create } from 'zustand';
import type { CameraView } from '@/renderer/GameRenderer';
import type { DayPhase } from '@/renderer/dayNight';
import type { BuildingCategory, Position } from '@/types';

export type PanelId = 'research' | 'milestones' | 'statistics' | 'saves' | 'settings';

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
  /** Dlaždica doku pod kurzorom (karta s detailom). */
  hoveredDockTile: { id: string; level: number } | null;
  log: LogEntry[];
  dayPhase: DayPhase | null;
  cameraView: CameraView | null;
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
  /** Éra, ktorej uvítaciu obrazovku treba zobraziť. */
  newEraId: string | null;

  setCatalogCategory: (category: BuildingCategory) => void;
  setBuildMode: (id: string | null, level?: number) => void;
  setHoveredDockTile: (tile: { id: string; level: number } | null) => void;
  addLog: (entry: Omit<LogEntry, 'id'>) => void;
  clearLog: () => void;
  setDayPhase: (phase: DayPhase | null) => void;
  setCameraView: (view: CameraView) => void;
  selectInstance: (id: string | null) => void;
  setHoveredTile: (position: Position | null) => void;
  showNotice: (text: string, kind?: NoticeKind) => void;
  setVictoryOpen: (open: boolean) => void;
  setNewEra: (eraId: string | null) => void;
  togglePanel: (panel: PanelId | null) => void;
  bumpSavesRevision: () => void;
  dismissNotice: (id: number) => void;
  /** Escape: postupne zruší režim výstavby, panel a výber. */
  cancel: () => void;
}

let noticeSeq = 0;

export const useUiStore = create<UiState>()((set, get) => ({
  catalogCategory: 'housing',
  buildModeId: null,
  buildLevel: 1,
  hoveredDockTile: null,
  log: [],
  dayPhase: null,
  cameraView: null,
  selectedInstanceId: null,
  hoveredTile: null,
  notices: [],
  openPanel: null,
  savesRevision: 0,
  victoryOpen: false,
  newEraId: null,

  setCatalogCategory: (catalogCategory) => set({ catalogCategory }),
  setBuildMode: (buildModeId, buildLevel = 1) =>
    set({ buildModeId, buildLevel, selectedInstanceId: null }),
  setHoveredDockTile: (hoveredDockTile) => set({ hoveredDockTile }),
  addLog: (entry) =>
    set((s) => ({ log: [{ ...entry, id: ++noticeSeq }, ...s.log].slice(0, MAX_LOG) })),
  clearLog: () => set({ log: [] }),
  setDayPhase: (dayPhase) => set({ dayPhase }),
  setCameraView: (cameraView) => set({ cameraView }),
  selectInstance: (selectedInstanceId) => set({ selectedInstanceId, buildModeId: null }),
  setHoveredTile: (hoveredTile) => set({ hoveredTile }),
  showNotice: (text, kind = 'info') =>
    set((s) => ({ notices: [...s.notices, { id: ++noticeSeq, text, kind }].slice(-MAX_NOTICES) })),
  dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
  setVictoryOpen: (victoryOpen) => set({ victoryOpen }),
  setNewEra: (newEraId) => set({ newEraId }),
  bumpSavesRevision: () => set((s) => ({ savesRevision: s.savesRevision + 1 })),
  togglePanel: (panel) => set((s) => ({ openPanel: s.openPanel === panel ? null : panel })),
  cancel: () => {
    const { buildModeId, openPanel, selectedInstanceId } = get();
    if (buildModeId) set({ buildModeId: null });
    else if (openPanel) set({ openPanel: null });
    else if (selectedInstanceId) set({ selectedInstanceId: null });
  },
}));
