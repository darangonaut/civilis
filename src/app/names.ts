import { gameData } from '@/data';
import csNames from '@/data/locales/cs.json';
import enNames from '@/data/locales/en.json';
import { levelName } from '@/engine';
import type { Language } from '@/stores/languageStore';
import { currentLanguage } from './i18n';

/** Preklady názvov z herných dát; slovenčina je priamo v src/data/*.json. */
interface DataNames {
  buildings: Record<string, string>;
  technologies: Record<string, string>;
  milestones: Record<string, string>;
  eras: Record<string, { name: string; description: string }>;
  achievements: Record<string, { name: string; description: string }>;
  events: Record<string, { name: string; description: string }>;
}

const NAMES: Partial<Record<Language, DataNames>> = { cs: csNames, en: enNames };

const names = (): DataNames | undefined => NAMES[currentLanguage()];

/** Názov budovy na danej úrovni (`house` + 3 → „Meštiansky dom“). */
export function buildingName(id: string, level = 1): string {
  const translated = names()?.buildings[level > 1 ? `${id}@${level}` : id];
  if (translated) return translated;
  const definition = gameData.buildingsById.get(id);
  return definition ? levelName(definition, level) : id;
}

export function techName(id: string): string {
  return names()?.technologies[id] ?? gameData.technologiesById.get(id)?.name ?? id;
}

export function milestoneTitle(id: string): string {
  return names()?.milestones[id] ?? gameData.milestones.find((m) => m.id === id)?.title ?? id;
}

export function eraName(id: string): string {
  return names()?.eras[id]?.name ?? gameData.eras.find((e) => e.id === id)?.name ?? id;
}

export function achievementName(id: string): string {
  return (
    names()?.achievements[id]?.name ?? gameData.achievements.find((a) => a.id === id)?.name ?? id
  );
}

export function achievementDescription(id: string): string {
  return (
    names()?.achievements[id]?.description ??
    gameData.achievements.find((a) => a.id === id)?.description ??
    ''
  );
}

export function eventName(id: string): string {
  return names()?.events[id]?.name ?? gameData.events.find((e) => e.id === id)?.name ?? id;
}

/** Popis udalosti s doplnenými parametrami (`{building}`, `{resource}`, `{amount}`, `{cost}`). */
export function eventDescription(id: string, params: Record<string, string | number> = {}): string {
  const text =
    names()?.events[id]?.description ?? gameData.events.find((e) => e.id === id)?.description ?? '';
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
}

export function eraDescription(id: string): string {
  return (
    names()?.eras[id]?.description ?? gameData.eras.find((e) => e.id === id)?.description ?? ''
  );
}
