/** Formátovanie čísel pre UI (slovenská desatinná čiarka). */
const oneDecimal = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 });

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
