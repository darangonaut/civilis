import type { SimulationSpeed } from '@/types';

/** Trvanie herného dňa pri rýchlosti 1× (špecifikácia 1.3). */
export const DAY_DURATION_MS = 2000;
/** Ochrana proti „špirále smrti“: viac krokov za snímku sa nedobieha. */
export const MAX_TICKS_PER_FRAME = 4;

/**
 * Fixný simulačný krok: pripočíta uplynulý reálny čas (× rýchlosť) a vráti, koľko
 * celých herných dní treba odsimulovať. Zvyšok čaká na ďalšiu snímku.
 */
export function advanceClock(
  accumulatorMs: number,
  elapsedMs: number,
  speed: SimulationSpeed,
): { ticks: number; accumulatorMs: number } {
  if (speed === 0) return { ticks: 0, accumulatorMs };
  let accumulator = accumulatorMs + Math.max(0, elapsedMs) * speed;
  let ticks = Math.floor(accumulator / DAY_DURATION_MS);
  accumulator -= ticks * DAY_DURATION_MS;
  if (ticks > MAX_TICKS_PER_FRAME) {
    ticks = MAX_TICKS_PER_FRAME;
    accumulator = 0;
  }
  return { ticks, accumulatorMs: accumulator };
}

/**
 * Herná slučka nad requestAnimationFrame. Pri skrytej karte stojí a po návrate
 * zameškaný čas nedobieha (špecifikácia 9).
 */
export class GameLoop {
  private frameId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;

  constructor(
    private readonly getSpeed: () => SimulationSpeed,
    private readonly onTick: () => void,
  ) {}

  start(): void {
    if (this.frameId !== null) return;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resume();
  }

  stop(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.pause();
  }

  private resume(): void {
    if (this.frameId !== null || document.hidden) return;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.frameId = requestAnimationFrame(this.frame);
  }

  private pause(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  private onVisibilityChange = () => {
    if (document.hidden) this.pause();
    else this.resume();
  };

  private frame = (now: number) => {
    const result = advanceClock(this.accumulator, now - this.lastTime, this.getSpeed());
    this.lastTime = now;
    this.accumulator = result.accumulatorMs;
    for (let i = 0; i < result.ticks; i++) this.onTick();
    this.frameId = requestAnimationFrame(this.frame);
  };
}
