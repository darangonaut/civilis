/**
 * Synchronná záloha pri zatváraní stránky. Asynchrónny zápis do IndexedDB spustený
 * v `pagehide` prehliadač nemusí dokončiť; zápis do localStorage je synchrónny, takže
 * obnovenie stránky nestratí ani posledné sekundy hry. Pri štarte sa záloha presunie
 * do automatického uloženia a zmaže.
 */
const KEY = 'civilis.unloadSnapshot';

export function writeUnloadSnapshot(json: string): boolean {
  try {
    localStorage.setItem(KEY, json);
    return true;
  } catch {
    // Plné úložisko alebo súkromný režim — ostáva automatické uloženie v IndexedDB.
    return false;
  }
}

/** Vráti a zmaže zálohu (ak existuje). */
export function takeUnloadSnapshot(): string | null {
  try {
    const json = localStorage.getItem(KEY);
    if (json !== null) localStorage.removeItem(KEY);
    return json;
  } catch {
    return null;
  }
}
