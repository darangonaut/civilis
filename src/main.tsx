import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { initializeGame } from '@/app/game';
import { t } from '@/app/i18n';
import { useUiStore } from '@/stores/uiStore';
import '@/app/styles.css';

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
