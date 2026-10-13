/** Dĺžka vizuálneho dňa v milisekundách pri rýchlosti 1× (pri pauze čas stojí). */
export const DAY_CYCLE_MS = 48_000;

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Tma (0 = deň, 1 = hlboká noc) pre fázu cyklu 0–1:
 * deň 0–0,55, súmrak 0,55–0,65, noc 0,65–0,9, svitanie 0,9–1.
 */
export function nightFactor(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.55) return 0;
  if (p < 0.65) return smooth((p - 0.55) / 0.1);
  if (p < 0.9) return 1;
  return 1 - smooth((p - 0.9) / 0.1);
}

/** Farba stmavenia scény pre danú tmu (lineárne medzi bielou a nočnou modrou). */
export function nightTint(night: number): number {
  const day = [0xff, 0xff, 0xff];
  const dark = [0x5a, 0x64, 0xa8];
  const [r, g, b] = day.map((c, i) => Math.round(c + (dark[i]! - c) * night));
  return (r! << 16) | (g! << 8) | b!;
}

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

/** Fáza dňa pre zobrazenie (ráno, deň, večer, noc). */
export function dayPhase(phase: number): DayPhase {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.1 || p >= 0.9) return 'dawn';
  if (p < 0.55) return 'day';
  if (p < 0.65) return 'dusk';
  return 'night';
}
