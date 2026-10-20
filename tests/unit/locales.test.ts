import { describe, expect, it } from 'vitest';
import { cs } from '@/app/locales/cs';
import { en } from '@/app/locales/en';
import { sk } from '@/app/locales/sk';
import { gameData } from '@/data';
import csNames from '@/data/locales/cs.json';
import enNames from '@/data/locales/en.json';
import planets from '@/data/planets.json';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('preklady', () => {
  it.each([
    ['cs', cs],
    ['en', en],
  ])('texty UI (%s) majú rovnaké parametre ako slovenčina a nie sú prázdne', (_, dict) => {
    for (const [key, text] of Object.entries(sk)) {
      const translated = dict[key as keyof typeof sk];
      expect(translated, key).toBeTruthy();
      expect(placeholders(translated), key).toEqual(placeholders(text));
    }
  });

  it.each([
    ['cs', csNames],
    ['en', enNames],
  ])('herné názvy (%s) pokrývajú všetky budovy, úrovne, technológie, míľniky a éry', (_, names) => {
    for (const building of gameData.buildings) {
      expect(names.buildings, building.id).toHaveProperty([building.id]);
      building.levels?.forEach((_, i) =>
        expect(names.buildings).toHaveProperty([`${building.id}@${i + 2}`]),
      );
    }
    for (const tech of gameData.technologies) expect(names.technologies).toHaveProperty([tech.id]);
    for (const m of gameData.milestones) expect(names.milestones).toHaveProperty([m.id]);
    for (const a of gameData.achievements) {
      expect(names.achievements).toHaveProperty([a.id, 'name']);
      expect(names.achievements).toHaveProperty([a.id, 'description']);
    }
    for (const event of gameData.events) {
      expect(names.events).toHaveProperty([event.id, 'name']);
      expect(names.events).toHaveProperty([event.id, 'description']);
      // Parametre v preklade musia sedieť so slovenským popisom.
      expect(
        placeholders(names.events[event.id as keyof typeof names.events]!.description),
      ).toEqual(placeholders(event.description));
    }
    for (const era of gameData.eras) {
      expect(names.eras).toHaveProperty([era.id, 'name']);
      expect(names.eras).toHaveProperty([era.id, 'description']);
    }
  });

  it.each([
    ['cs', csNames],
    ['en', enNames],
  ])('názvy kolónií (%s): všetko, čo planéty premenúvajú, a všetky dedičstvá', (_, names) => {
    type Override = { name?: string; levels?: unknown[]; description?: string };
    type Translated = {
      buildings: Record<string, string>;
      eras: Record<string, { name: string; description: string }>;
      events: Record<string, { name: string; description: string }>;
    };
    for (const planet of planets.planets) {
      const overrides = (planet as { overrides?: Record<string, Record<string, Override>> })
        .overrides;
      if (!overrides) continue;
      const translated = (names.planets as unknown as Record<string, Translated>)[planet.id]!;
      expect(translated, planet.id).toBeDefined();
      for (const [id, override] of Object.entries(overrides.buildings ?? {})) {
        if (override.name) expect(translated.buildings, id).toHaveProperty([id]);
        (override.levels ?? []).forEach((_, i) =>
          expect(translated.buildings).toHaveProperty([`${id}@${i + 2}`]),
        );
      }
      for (const id of Object.keys(overrides.eras ?? {})) {
        expect(translated.eras).toHaveProperty([id, 'name']);
        expect(translated.eras).toHaveProperty([id, 'description']);
      }
      for (const [id, event] of Object.entries(overrides.events ?? {})) {
        const text = translated.events[id];
        expect(text, id).toBeDefined();
        expect(placeholders(text!.description), id).toEqual(placeholders(event.description!));
      }
    }
    for (const legacy of gameData.legacies) {
      expect(names.legacies).toHaveProperty([legacy.id, 'name']);
      expect(names.legacies).toHaveProperty([legacy.id, 'description']);
    }
  });

  it('Mars premenúva každú budovu', () => {
    const mars = planets.planets.find((p) => p.id === 'mars')!;
    const overrides = (mars as { overrides: { buildings: Record<string, { name?: string }> } })
      .overrides.buildings;
    for (const building of gameData.buildings) {
      expect(overrides[building.id]?.name, building.id).toBeTruthy();
    }
  });

  it('texty planét (mars:…, proxima:…) existujú len ako úprava existujúceho kľúča', () => {
    for (const key of Object.keys(sk).filter((k) => /^(mars|proxima):/.test(k))) {
      expect(sk, key).toHaveProperty([key.slice(key.indexOf(':') + 1)]);
    }
  });
});
