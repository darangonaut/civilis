import { useState } from 'react';
import { t, type TranslationKey } from '@/app/i18n';
import { startNewGame } from '@/app/saving';
import { useGameState } from '@/app/useGameState';
import { MARKER_LEGEND } from '@/app/markers';
import { MarkerIcon } from '../MarkerIcon';
import { PanelFrame } from './PanelFrame';

const SHORTCUTS: [TranslationKey, string | TranslationKey][] = [
  ['shortcut.pan', 'shortcut.panKey'],
  ['shortcut.zoom', 'shortcut.zoomKey'],
  ['shortcut.select', 'shortcut.selectKey'],
  ['shortcut.cancel', 'Escape'],
  ['shortcut.pause', 'Medzerník'],
  ['shortcut.speed', '1 / 2 / 3'],
  ['shortcut.save', 'Ctrl/Cmd + S'],
];

export function SettingsPanel() {
  const seed = useGameState((s) => s.simulation.seed);
  const [seedInput, setSeedInput] = useState('');

  const parsedSeed = seedInput.trim() === '' ? undefined : Number(seedInput);
  const seedValid = parsedSeed === undefined || Number.isInteger(parsedSeed);

  const newGame = (event: React.FormEvent) => {
    event.preventDefault();
    if (seedValid && window.confirm(t('settings.confirmNewGame'))) {
      startNewGame(parsedSeed);
      setSeedInput('');
    }
  };

  return (
    <PanelFrame title={t('settings.title')} testId="settings-panel">
      <h3>{t('settings.newGame')}</h3>
      <form className="new-game-form" onSubmit={newGame}>
        <label>
          <span className="muted">{t('settings.seed')}</span>
          <input
            type="text"
            inputMode="numeric"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            aria-invalid={!seedValid}
            data-testid="seed-input"
          />
        </label>
        <button type="submit" className="primary" disabled={!seedValid} data-testid="new-game">
          {t('settings.start')}
        </button>
      </form>
      <p className="muted hint">
        {t('settings.currentSeed')}: {seed}
      </p>

      <h3>{t('settings.markers')}</h3>
      <ul className="marker-legend" data-testid="marker-legend">
        {MARKER_LEGEND.map(([kind, label]) => (
          <li key={kind}>
            <MarkerIcon kind={kind} />
            <span>{t(label)}</span>
          </li>
        ))}
      </ul>

      <h3>{t('settings.shortcuts')}</h3>
      <dl className="detail-list">
        {SHORTCUTS.map(([action, key]) => (
          <div key={action} className="detail-row">
            <dt>{t(action)}</dt>
            <dd>{key.startsWith('shortcut.') ? t(key as TranslationKey) : key}</dd>
          </div>
        ))}
      </dl>
    </PanelFrame>
  );
}
