import { useEffect, useMemo, useState } from 'react';
import { controller } from '@/app/game';
import { LANGUAGE_NAMES, t } from '@/app/i18n';
import { eraName } from '@/app/names';
import { startNewGame } from '@/app/saving';
import { gameData } from '@/data';
import { currentEraIndex } from '@/engine';
import { drawFlag, drawLogo, drawTitleScene } from '@/renderer/pixel/titleScene';
import { LANGUAGES, useLanguageStore } from '@/stores/languageStore';
import { useUiStore } from '@/stores/uiStore';
import { DIFFICULTY_IDS, type DifficultyId } from '@/types';
import type { PixelCanvas } from '@/renderer/pixel/PixelCanvas';

const images = new Map<string, string>();
/** Pixel art ako obrázok (vytvorí sa raz). */
function image(key: string, draw: () => PixelCanvas): string {
  let url = images.get(key);
  if (!url) {
    url = draw().toCanvas().toDataURL();
    images.set(key, url);
  }
  return url;
}

/** Úvodná obrazovka: pixel art scéna, logo, výber jazyka a štart / pokračovanie. */
export function StartScreen() {
  const open = useUiStore((s) => s.startScreen);
  const close = useUiStore((s) => s.closeStartScreen);
  const hasSave = useUiStore((s) => s.hasSavedGame);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const [choosing, setChoosing] = useState(false);
  const scene = useMemo(() => image('scene', drawTitleScene), []);
  const logo = useMemo(() => image('logo', () => drawLogo()), []);

  const play = () => {
    close();
    controller.setSpeed(1);
  };
  const newGame = (difficulty: DifficultyId) => {
    startNewGame(undefined, difficulty);
    close();
    controller.setSpeed(1);
  };

  useEffect(() => {
    if (!open || choosing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') play();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!open) return null;
  const state = controller.state;
  const saved = t('start.saved', {
    city: state.city.name,
    day: state.simulation.day,
    era: eraName(gameData.eras[currentEraIndex(state, gameData)]!.id),
  });

  return (
    <div className="start-screen" data-testid="start-screen">
      <img className="start-scene" src={scene} alt="" draggable={false} />
      <div className="start-panel">
        <img className="start-logo" src={logo} alt="Civilis" draggable={false} />
        <p className="start-tagline">{t('start.tagline')}</p>
        <div className="start-languages" role="radiogroup" aria-label={t('start.language')}>
          {LANGUAGES.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={language === id}
              className={language === id ? 'start-language selected' : 'start-language'}
              data-testid={`start-language-${id}`}
              onClick={() => setLanguage(id)}
            >
              <img src={image(`flag-${id}`, () => drawFlag(id))} alt="" draggable={false} />
              {LANGUAGE_NAMES[id]}
            </button>
          ))}
        </div>
        {!choosing ? (
          <div className="start-actions">
            <button className="start-button" data-testid="start-play" onClick={play} autoFocus>
              {hasSave ? t('start.continue') : t('start.start')}
            </button>
            {hasSave && <p className="start-saved">{saved}</p>}
            <button
              className="start-secondary"
              data-testid="start-new"
              onClick={() => setChoosing(true)}
            >
              {t('start.newGame')}
            </button>
          </div>
        ) : (
          <div className="start-actions">
            <p className="start-saved">{t('start.chooseDifficulty')}</p>
            <div className="start-difficulties">
              {DIFFICULTY_IDS.map((id) => (
                <button
                  key={id}
                  className="start-secondary"
                  data-testid={`start-difficulty-${id}`}
                  onClick={() => newGame(id)}
                >
                  {t(`difficulty.${id}`)}
                </button>
              ))}
            </div>
            {hasSave && <p className="start-warning">{t('start.overwrite')}</p>}
            <button className="start-link" onClick={() => setChoosing(false)}>
              {t('start.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
