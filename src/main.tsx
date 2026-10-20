import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { initializeGame } from '@/app/game';
import { t } from '@/app/i18n';
import { useUiStore } from '@/stores/uiStore';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@/app/styles.css';

// Po novom nasadení môže otvorená (alebo z cache načítaná) stará stránka žiadať súbor,
// ktorý už neexistuje (napr. mapu). Stránka sa vtedy raz obnoví na aktuálnu verziu.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('civilis.reloadedForUpdate')) return;
    sessionStorage.setItem('civilis.reloadedForUpdate', '1');
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

const root = document.getElementById('root');
if (!root) throw new Error('Chýba #root element');

// Pred prvým vykreslením obnoví rozohranú hru z automatického uloženia.
const init = await initializeGame();
if (init === 'restored') useUiStore.getState().showNotice(t('save.restored'), 'info');
if (init === 'restore_failed') useUiStore.getState().showNotice(t('save.restoreFailed'), 'warning');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
