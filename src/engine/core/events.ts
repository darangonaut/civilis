/** Udalosti z jedného simulačného dňa, ktoré UI zobrazí ako upozornenia. */
export type GameEvent =
  | { type: 'research_completed'; technologyId: string }
  | { type: 'milestone_completed'; milestoneId: string }
  | { type: 'era_reached'; eraId: string }
  | { type: 'achievement_unlocked'; achievementId: string }
  /** Náhodná udalosť začala; `pending` = čaká na rozhodnutie hráča. */
  | { type: 'event_started'; eventId: string; pending: boolean }
  | { type: 'event_ended'; eventId: string }
  | { type: 'food_shortage' }
  | { type: 'population_changed'; delta: number };
