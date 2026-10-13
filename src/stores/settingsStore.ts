import { create } from 'zustand';

/** Nastavenia zobrazenia — ukladajú sa v prehliadači (iba pohodlie, nie herný stav). */
export interface DisplaySettings {
  animations: boolean;
  dayNight: boolean;
}

const KEY = 'civilis.display';
const DEFAULTS: DisplaySettings = { animations: true, dayNight: true };

function load(): DisplaySettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DisplaySettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export const useSettingsStore = create<
  DisplaySettings & { set: (patch: Partial<DisplaySettings>) => void }
>()((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch);
    try {
      const { animations, dayNight } = get();
      localStorage.setItem(KEY, JSON.stringify({ animations, dayNight }));
    } catch {
      // Úložisko nedostupné — nastavenie platí aspoň do obnovenia stránky.
    }
  },
}));
