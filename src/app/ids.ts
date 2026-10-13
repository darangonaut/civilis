/**
 * Náhodné ID hry (UUID v4). `crypto.randomUUID()` je dostupné len v bezpečnom kontexte
 * (https alebo localhost) — pri otvorení hry cez sieťovú adresu `http://192.168…` chýba
 * a hra by sa nespustila. `crypto.getRandomValues` funguje všade.
 */
export function createGameId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
