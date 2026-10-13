import { useSyncExternalStore } from 'react';

/** Úzka alebo nízka obrazovka (mobil) — rovnaká podmienka ako v styles.css. */
export const COMPACT_QUERY = '(max-width: 760px), (max-height: 520px)';

const media = typeof window !== 'undefined' ? window.matchMedia(COMPACT_QUERY) : null;

function subscribe(listener: () => void): () => void {
  media?.addEventListener('change', listener);
  return () => media?.removeEventListener('change', listener);
}

export function useCompact(): boolean {
  return useSyncExternalStore(subscribe, () => media?.matches ?? false);
}
