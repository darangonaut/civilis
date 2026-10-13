import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { controller } from './game';

const SPEED_KEYS = { '1': 1, '2': 2, '3': 4 } as const;

/** Globálne klávesové skratky (špecifikácia 7.1). Ukladanie pribudne v etape 6. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        useUiStore.getState().cancel();
      } else if (e.key === ' ') {
        e.preventDefault();
        controller.togglePause();
      } else if (e.key in SPEED_KEYS) {
        controller.setSpeed(SPEED_KEYS[e.key as keyof typeof SPEED_KEYS]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
