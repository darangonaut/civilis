import { t } from '@/app/i18n';
import { eventName } from '@/app/names';
import { useGameState } from '@/app/useGameState';

/** Prebiehajúce udalosti (sucho, slávnosť…) so zostávajúcimi dňami. */
export function ActiveEvents() {
  const active = useGameState((s) => s.events.active);
  if (active.length === 0) return null;
  const byEvent = new Map<string, number>();
  const bad = new Set<string>();
  for (const event of active) {
    byEvent.set(event.eventId, Math.max(byEvent.get(event.eventId) ?? 0, event.daysLeft));
    const effect = event.effect;
    // Zlé sú výpadky výroby, pokles spokojnosti a poškodené budovy.
    if (
      effect.type === 'disable_building' ||
      (effect.type === 'production' && effect.multiplier < 1) ||
      (effect.type === 'happiness' && effect.amount < 0)
    )
      bad.add(event.eventId);
  }
  return (
    <section className="hud-panel active-events" data-testid="active-events">
      <span className="hud-caption">{t('event.active')}</span>
      <ul>
        {[...byEvent].map(([id, days]) => {
          return (
            <li key={id} className={bad.has(id) ? 'bad' : 'good'}>
              <span>{eventName(id)}</span>
              <span className="muted">{t('event.daysLeft', { days })}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
