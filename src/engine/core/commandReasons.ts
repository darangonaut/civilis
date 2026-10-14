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
  'max_level',
  'service_required',
  'unknown_technology',
  'technology_completed',
  'research_active',
  'prerequisites_missing',
  'era_locked',
  'invalid_queue',
  'invalid_amount',
  'not_tradable',
  'trade_unavailable',
  'insufficient_funds',
  'storage_full',
  'wonder_built',
] as const;

export type CommandFailureReason = (typeof COMMAND_FAILURE_REASONS)[number];
