import { create } from 'zustand';
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

interface UiState {
  catalogCategory: BuildingCategory | 'all';
  /** Typ budovy vybraný v katalógu = režim výstavby. */
  buildModeId: string | null;
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

  setCatalogCategory: (category: BuildingCategory | 'all') => void;
  setBuildMode: (id: string | null) => void;
  selectInstance: (id: string | null) => void;
  setHoveredTile: (position: Position | null) => void;
  showNotice: (text: string, kind?: NoticeKind) => void;
  setVictoryOpen: (open: boolean) => void;
  togglePanel: (panel: PanelId | null) => void;
  bumpSavesRevision: () => void;
  dismissNotice: (id: number) => void;
  /** Escape: postupne zruší režim výstavby, panel a výber. */
  cancel: () => void;
}

let noticeSeq = 0;

export const useUiStore = create<UiState>()((set, get) => ({
  catalogCategory: 'all',
  buildModeId: null,
  selectedInstanceId: null,
  hoveredTile: null,
  notices: [],
  openPanel: null,
  savesRevision: 0,
  victoryOpen: false,

  setCatalogCategory: (catalogCategory) => set({ catalogCategory }),
  setBuildMode: (buildModeId) => set({ buildModeId, selectedInstanceId: null }),
  selectInstance: (selectedInstanceId) => set({ selectedInstanceId, buildModeId: null }),
  setHoveredTile: (hoveredTile) => set({ hoveredTile }),
  showNotice: (text, kind = 'info') =>
    set((s) => ({ notices: [...s.notices, { id: ++noticeSeq, text, kind }].slice(-MAX_NOTICES) })),
  dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
  setVictoryOpen: (victoryOpen) => set({ victoryOpen }),
  bumpSavesRevision: () => set((s) => ({ savesRevision: s.savesRevision + 1 })),
  togglePanel: (panel) => set((s) => ({ openPanel: s.openPanel === panel ? null : panel })),
  cancel: () => {
    const { buildModeId, openPanel, selectedInstanceId } = get();
    if (buildModeId) set({ buildModeId: null });
    else if (openPanel) set({ openPanel: null });
    else if (selectedInstanceId) set({ selectedInstanceId: null });
  },
}));
