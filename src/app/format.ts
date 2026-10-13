/** Formátovanie čísel pre UI (slovenská desatinná čiarka). */
const oneDecimal = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 });

export function formatAmount(value: number): string {
  return oneDecimal.format(value);
}

/** Zmena so znamienkom, napr. „+5,5“ / „−2“. */
export function formatDelta(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return '±0';
  return `${rounded > 0 ? '+' : '−'}${oneDecimal.format(Math.abs(rounded))}`;
}
