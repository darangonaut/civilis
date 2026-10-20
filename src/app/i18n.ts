import { COMMAND_FAILURE_REASONS, type BuildingProblem, type CommandFailureReason } from '@/engine';
import {
  RESOURCE_IDS,
  type BuildingCategory,
  type ResourceId,
  type TechnologyEffect,
} from '@/types';

import { gameData } from '@/data';
import { useLanguageStore, type Language } from '@/stores/languageStore';
import { cs } from './locales/cs';
import { en } from './locales/en';
import { sk } from './locales/sk';

export type TranslationKey = keyof typeof sk;

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { sk, cs, en };

/** Kód jazyka pre `Intl` (formát čísel). */
export const LOCALES: Record<Language, string> = { sk: 'sk-SK', cs: 'cs-CZ', en: 'en-US' };

/** Názvy jazykov v prepínači (vždy v danom jazyku). */
export const LANGUAGE_NAMES: Record<Language, string> = {
  sk: 'Slovenčina',
  cs: 'Čeština',
  en: 'English',
};

export const currentLanguage = (): Language => useLanguageStore.getState().language;

/** Preloží kľúč do aktuálneho jazyka; `{názov}` v texte nahradí hodnotou z `params`. */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const dictionary = DICTIONARIES[currentLanguage()];
  const planet = gameData.planet.id;
  // Kolónia môže mať vlastný text (`mars:resource.wood` = „Šrot“).
  const text: string =
    (planet !== 'earth' && (dictionary as Record<string, string>)[`${planet}:${key}`]) ||
    dictionary[key];
  return params
    ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
    : text;
}

/** Preloží kód dôvodu zlyhania príkazu z enginu. */
export function commandReasonLabel(reason: string): string {
  return (COMMAND_FAILURE_REASONS as readonly string[]).includes(reason)
    ? t(`command.${reason as CommandFailureReason}`)
    : reason;
}

/** Text problému budovy, napr. „Nedostatok dreva“. */
export function problemLabel(problem: BuildingProblem): string {
  if (problem.code === 'missing_input') {
    return `${t('problem.missing_input')} ${t(`resourceGenitive.${problem.resource}`)}`;
  }
  if (problem.code === 'storage_full')
    return `${t('problem.storage_full')} (${resourceLabel(problem.resource).toLowerCase()})`;
  return t(`problem.${problem.code}`);
}

/** Popis efektu technológie, napr. „+20 % produkcia dreva“. */
export function effectLabel(effect: TechnologyEffect): string {
  const percent = Math.round(Math.abs(effect.multiplier - 1) * 100);
  if (effect.type === 'maintenance_multiplier') return t('effect.maintenance', { percent });
  if (effect.type === 'money_multiplier') return t('effect.money', { percent });
  if (effect.target === 'all') return t('effect.productionAll', { percent });
  const resource = (RESOURCE_IDS as readonly string[]).includes(effect.target)
    ? t(`resourceGenitive.${effect.target as ResourceId}`)
    : effect.target;
  return t('effect.production', { percent, resource });
}

export const resourceLabel = (id: ResourceId): string => t(`resource.${id}`);
export const categoryLabel = (category: BuildingCategory): string => t(`category.${category}`);
