export const RESOURCE_IDS = [
  'food',
  'wood',
  'stone',
  'tools',
  'knowledge',
  'bricks',
  'iron',
  'cloth',
  'coal',
  'electricity',
  'electronics',
] as const;

export type ResourceId = (typeof RESOURCE_IDS)[number];

export type Resources = Record<ResourceId, number>;
