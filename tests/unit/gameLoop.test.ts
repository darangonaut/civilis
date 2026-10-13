import { describe, expect, it } from 'vitest';
import { DAY_DURATION_MS, MAX_TICKS_PER_FRAME, advanceClock } from '@/app/gameLoop';

describe('fixný simulačný krok', () => {
  it('pri 1× trvá deň 2 s, pri 2× 1 s, pri 4× 0,5 s', () => {
    expect(advanceClock(0, 2000, 1).ticks).toBe(1);
    expect(advanceClock(0, 1000, 2).ticks).toBe(1);
    expect(advanceClock(0, 500, 4).ticks).toBe(1);
    expect(advanceClock(0, 1999, 1).ticks).toBe(0);
  });

  it('pauza nesimuluje a nestráca nazbieraný čas', () => {
    expect(advanceClock(1500, 10_000, 0)).toEqual({ ticks: 0, accumulatorMs: 1500 });
  });

  it('zvyšok času sa prenáša do ďalšej snímky', () => {
    let state = { ticks: 0, accumulatorMs: 0 };
    let total = 0;
    for (let frame = 0; frame < 120; frame++) {
      state = advanceClock(state.accumulatorMs, 1000 / 60, 1);
      total += state.ticks;
    }
    expect(total).toBe(1);
    expect(state.accumulatorMs).toBeCloseTo(0, 6);
  });

  it('veľký skok času nedobieha viac ako limit krokov', () => {
    const result = advanceClock(0, 60_000, 4);
    expect(result.ticks).toBe(MAX_TICKS_PER_FRAME);
    expect(result.accumulatorMs).toBe(0);
  });

  it('záporný čas ignoruje', () => {
    expect(advanceClock(100, -5000, 1)).toEqual({ ticks: 0, accumulatorMs: 100 });
    expect(DAY_DURATION_MS).toBe(2000);
  });
});
