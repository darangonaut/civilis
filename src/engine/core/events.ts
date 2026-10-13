/** Udalosti z jedného simulačného dňa, ktoré UI zobrazí ako upozornenia. */
export type GameEvent =
  | { type: 'research_completed'; technologyId: string }
  | { type: 'milestone_completed'; milestoneId: string }
  | { type: 'food_shortage' }
  | { type: 'population_changed'; delta: number };
