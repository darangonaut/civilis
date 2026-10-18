import { describe, expect, it } from 'vitest';
import { cs } from '@/app/voice/cs';
import { en } from '@/app/voice/en';
import { sk } from '@/app/voice/sk';
import { MEDIA, VOICE_TOPICS } from '@/app/voice/types';

const ALLOWED = new Set(['building', 'resource', 'resourceGen', 'tech', 'milestone', 'era']);
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);

describe('Hlas ulice — texty', () => {
  it.each([
    ['sk', sk],
    ['cs', cs],
    ['en', en],
  ])('%s: každá téma má texty, médiá všetkých ér a len povolené zástupné symboly', (_, texts) => {
    for (const medium of MEDIA) expect(texts.media[medium], medium).toBeTruthy();
    for (const topic of VOICE_TOPICS) {
      if (topic === 'flavor') continue;
      const list = texts.topics[topic];
      expect(list.length, topic).toBeGreaterThan(0);
      for (const text of list)
        for (const name of placeholders(text))
          expect(ALLOWED.has(name), `${topic}: ${name}`).toBe(true);
    }
    expect(texts.flavor).toHaveLength(MEDIA.length);
    for (const era of texts.flavor) expect(era.length).toBeGreaterThan(0);
    expect(texts.occupations.male).toHaveLength(10);
    expect(texts.occupations.female).toHaveLength(10);
    expect(texts.names.male).toHaveLength(10);
    expect(texts.names.female).toHaveLength(10);
  });

  it('témy, ktoré sa týkajú budovy, majú v každom jazyku zástupný symbol {building}', () => {
    for (const texts of [sk, cs, en]) {
      for (const topic of ['pollution', 'newBuilding', 'wonder', 'fire'] as const) {
        for (const text of texts.topics[topic]) expect(text).toContain('{building}');
      }
    }
  });
});
