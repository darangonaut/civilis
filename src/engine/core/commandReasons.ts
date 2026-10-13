/**
 * Kódy dôvodov zlyhania príkazu. Engine vracia kód, UI ho prekladá cez i18n (`command.<kód>`).
 */
export const COMMAND_FAILURE_REASONS = [
  'unknown_building',
  'out_of_bounds',
  'tile_occupied',
  'invalid_terrain',
  'technology_required',
  'insufficient_resources',
  'unknown_instance',
  'last_warehouse',
  'invalid_priority',
  'invalid_speed',
  'not_implemented',
] as const;

export type CommandFailureReason = (typeof COMMAND_FAILURE_REASONS)[number];
