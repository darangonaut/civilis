import { useState } from 'react';
import { LANGUAGE_NAMES, t, type TranslationKey } from '@/app/i18n';
import { LANGUAGES, useLanguageStore } from '@/stores/languageStore';
import { startNewGame } from '@/app/saving';
import { controller } from '@/app/game';
import { useGameState } from '@/app/useGameState';
import { MARKER_LEGEND } from '@/app/markers';
import { MarkerIcon } from '../MarkerIcon';
import { useSettingsStore } from '@/stores/settingsStore';
import { DIFFICULTY_IDS, type DifficultyId } from '@/types';
import { PanelFrame } from './PanelFrame';

const SHORTCUTS: [TranslationKey, string | TranslationKey][] = [
  ['shortcut.pan', 'shortcut.panKey'],
  ['shortcut.zoom', 'shortcut.zoomKey'],
  ['shortcut.select', 'shortcut.selectKey'],
  ['shortcut.cancel', 'Escape'],
  ['shortcut.pause', 'key.space'],
  ['shortcut.speed', '1 / 2 / 3'],
  ['shortcut.save', 'Ctrl/Cmd + S'],
];

export function SettingsPanel() {
  const seed = useGameState((s) => s.simulation.seed);
  const [seedInput, setSeedInput] = useState('');
  const currentDifficulty = useGameState((s) => s.difficulty);
  const [difficulty, setDifficulty] = useState<DifficultyId>(currentDifficulty);
  const display = useSettingsStore();
  const eventsEnabled = useGameState((s) => s.events.enabled);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const parsedSeed = seedInput.trim() === '' ? undefined : Number(seedInput);
  const seedValid = parsedSeed === undefined || Number.isInteger(parsedSeed);

  const newGame = (event: React.FormEvent) => {
    event.preventDefault();
    if (seedValid && window.confirm(t('settings.confirmNewGame'))) {
      startNewGame(parsedSeed, difficulty);
      setSeedInput('');
    }
  };

  return (
    <PanelFrame title={t('settings.title')} testId="settings-panel">
      <h3>{t('settings.language')}</h3>
      <div className="segmented language-switch" role="group" aria-label={t('settings.language')}>
        {LANGUAGES.map((code) => (
          <button
            key={code}
            lang={code}
            className={language === code ? 'active' : ''}
            aria-pressed={language === code}
            onClick={() => setLanguage(code)}
            data-testid={`language-${code}`}
          >
            {LANGUAGE_NAMES[code]}
          </button>
        ))}
      </div>

      <h3>{t('settings.newGame')}</h3>
      <div className="segmented" role="group" aria-label={t('settings.difficulty')}>
        <span className="segmented-label">{t('settings.difficulty')}</span>
        {DIFFICULTY_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={difficulty === id ? 'active' : ''}
            aria-pressed={difficulty === id}
            onClick={() => setDifficulty(id)}
            data-testid={`difficulty-${id}`}
          >
            {t(`difficulty.${id}`)}
          </button>
        ))}
      </div>
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
        <br />
        {t('settings.currentDifficulty')}: {t(`difficulty.${currentDifficulty}`)}
      </p>

      <h3>{t('settings.display')}</h3>
      <label className="toggle">
        <input
          type="checkbox"
          checked={display.animations}
          onChange={(e) => display.set({ animations: e.target.checked })}
          data-testid="toggle-animations"
        />
        {t('settings.animations')}
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={display.dayNight}
          onChange={(e) => display.set({ dayNight: e.target.checked })}
          data-testid="toggle-daynight"
        />
        {t('settings.dayNight')}
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={eventsEnabled}
          onChange={(e) =>
            controller.execute({ type: 'SET_EVENTS_ENABLED', enabled: e.target.checked })
          }
          data-testid="toggle-events"
        />
        {t('settings.events')}
      </label>

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
            <dd>
              {key.startsWith('shortcut.') || key.startsWith('key.')
                ? t(key as TranslationKey)
                : key}
            </dd>
          </div>
        ))}
      </dl>
    </PanelFrame>
  );
}
