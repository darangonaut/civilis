import { create } from 'zustand';
import type { BuildingCategory, Position } from '@/types';

export interface Notice {
  id: number;
  text: string;
}

interface UiState {
  catalogCategory: BuildingCategory | 'all';
  /** Typ budovy vybraný v katalógu = režim výstavby. */
  buildModeId: string | null;
  /** Budova vybraná na mape. */
  selectedInstanceId: string | null;
  hoveredTile: Position | null;
  notice: Notice | null;

  setCatalogCategory: (category: BuildingCategory | 'all') => void;
  setBuildMode: (id: string | null) => void;
  selectInstance: (id: string | null) => void;
  setHoveredTile: (position: Position | null) => void;
  showNotice: (text: string) => void;
  dismissNotice: (id: number) => void;
  /** Escape: najprv zruší režim výstavby, potom výber. */
  cancel: () => void;
}

let noticeSeq = 0;

export const useUiStore = create<UiState>()((set, get) => ({
  catalogCategory: 'all',
  buildModeId: null,
  selectedInstanceId: null,
  hoveredTile: null,
  notice: null,

  setCatalogCategory: (catalogCategory) => set({ catalogCategory }),
  setBuildMode: (buildModeId) => set({ buildModeId, selectedInstanceId: null }),
  selectInstance: (selectedInstanceId) => set({ selectedInstanceId, buildModeId: null }),
  setHoveredTile: (hoveredTile) => set({ hoveredTile }),
  showNotice: (text) => set({ notice: { id: ++noticeSeq, text } }),
  dismissNotice: (id) => {
    if (get().notice?.id === id) set({ notice: null });
  },
  cancel: () => {
    const { buildModeId, selectedInstanceId } = get();
    if (buildModeId) set({ buildModeId: null });
    else if (selectedInstanceId) set({ selectedInstanceId: null });
  },
}));
