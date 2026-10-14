import { create } from 'zustand';

export const LANGUAGES = ['sk', 'cs', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const KEY = 'civilis.language';

/** Uložený jazyk, inak podľa prehliadača (čeština, slovenčina), inak angličtina. */
function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (LANGUAGES as readonly string[]).includes(saved)) return saved as Language;
  } catch {
    // Úložisko nedostupné.
  }
  for (const tag of typeof navigator !== 'undefined' ? navigator.languages : []) {
    const code = tag.slice(0, 2).toLowerCase();
    if ((LANGUAGES as readonly string[]).includes(code)) return code as Language;
  }
  return 'en';
}

export const useLanguageStore = create<{
  language: Language;
  setLanguage: (language: Language) => void;
}>()((set) => ({
  language: initialLanguage(),
  setLanguage: (language) => {
    set({ language });
    try {
      localStorage.setItem(KEY, language);
    } catch {
      // Jazyk platí aspoň do obnovenia stránky.
    }
  },
}));
