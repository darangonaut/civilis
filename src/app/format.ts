import { currentLanguage, LOCALES } from './i18n';

/** Formátovanie čísel pre UI podľa jazyka (desatinná čiarka / bodka). */
const formatters = new Map<string, Intl.NumberFormat>();
const oneDecimal = {
  format(value: number): string {
    const locale = LOCALES[currentLanguage()];
    let formatter = formatters.get(locale);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
      formatters.set(locale, formatter);
    }
    return formatter.format(value);
  },
};

/** Cena s dvoma desatinnými miestami (napr. 0,25). */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat(LOCALES[currentLanguage()], {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAmount(value: number): string {
  return oneDecimal.format(value);
}

/** Celé číslo; od 10 000 skrátene („74,6k“, „1,3M“), aby sa lišta zmestila. */
export function formatCompact(value: number): string {
  const v = Math.floor(value);
  if (Math.abs(v) >= 1_000_000) return `${oneDecimal.format(v / 1_000_000)}M`;
  if (Math.abs(v) >= 10_000) return `${oneDecimal.format(v / 1000)}k`;
  return String(v);
}

/** Zmena so znamienkom, napr. „+5,5“ / „−2“ / „+2,1k“. */
export function formatDelta(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return '±0';
  const sign = rounded > 0 ? '+' : '−';
  const abs = Math.abs(rounded);
  return abs >= 1000
    ? `${sign}${oneDecimal.format(abs / 1000)}k`
    : `${sign}${oneDecimal.format(abs)}`;
}
