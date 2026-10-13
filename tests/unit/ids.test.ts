import { describe, expect, it } from 'vitest';
import { createGameId } from '@/app/ids';

describe('ID hry', () => {
  it('má tvar UUID v4 a je náhodné', () => {
    const id = createGameId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(createGameId()).not.toBe(id);
  });
});
