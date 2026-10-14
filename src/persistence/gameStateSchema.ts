import { z } from 'zod';
import { partialResourcesSchema, resourcesSchema } from '@/engine/core/definitions';
import { RESOURCE_IDS, TERRAIN_TYPES, type GameState } from '@/types';

const finite = z.number().finite();
const nonNegative = finite.nonnegative();
const nonNegativeInt = z.number().int().nonnegative();

const tileSchema = z.strictObject({
  terrain: z.enum(TERRAIN_TYPES),
  fertility: z.number().min(0).max(100),
  resourceDeposit: z.enum(RESOURCE_IDS).optional(),
  buildingId: z.string().optional(),
});

const buildingInstanceSchema = z.strictObject({
  id: z.string().min(1),
  definitionId: z.string().min(1),
  position: z.strictObject({ x: nonNegativeInt, y: nonNegativeInt }),
  enabled: z.boolean(),
  priority: z.number().int(),
  level: z.number().int().min(1),
});

/** Validácia uloženého herného stavu (aktuálna verzia schémy). */
export const gameStateSchema = z
  .strictObject({
    schemaVersion: z.number().int().positive(),
    gameId: z.string().min(1),
    createdAt: z.string(),
    lastSavedAt: z.string(),
    simulation: z.strictObject({
      day: nonNegativeInt,
      speed: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(4)]),
      seed: z.number().int(),
    }),
    world: z.strictObject({
      seed: z.number().int(),
      width: z.number().int().min(1).max(256),
      height: z.number().int().min(1).max(256),
      tiles: z.array(tileSchema),
    }),
    city: z.strictObject({
      name: z.string(),
      population: z.strictObject({
        total: nonNegativeInt,
        housingCapacity: nonNegativeInt,
        availableWorkers: nonNegativeInt,
        employedWorkers: nonNegativeInt,
        happiness: z.number().min(0).max(100),
        happinessFactors: z.strictObject({
          food: nonNegative,
          housing: nonNegative,
          water: nonNegative,
          education: nonNegative,
          leisure: nonNegative,
        }),
        growthProgress: z.number().min(0).max(1),
      }),
      economy: z.strictObject({
        resources: resourcesSchema,
        money: nonNegative,
        storageCapacity: nonNegative,
        dailyIncome: nonNegative,
        dailyExpenses: nonNegative,
        dailyProduction: partialResourcesSchema,
        dailyConsumption: partialResourcesSchema,
      }),
      buildings: z.array(buildingInstanceSchema),
    }),
    research: z.strictObject({
      completedTechnologyIds: z.array(z.string()),
      activeTechnologyId: z.string().nullable(),
      investedKnowledge: nonNegative,
      queue: z.array(z.string()),
    }),
    milestones: z.strictObject({
      completedIds: z.array(z.string()),
      progressDays: z.record(z.string(), nonNegativeInt),
    }),
    trade: z.strictObject({
      autoSell: z.array(z.enum(RESOURCE_IDS)),
      earned: nonNegative,
    }),
    achievements: z.strictObject({
      completedIds: z.array(z.string()),
      finishedDay: nonNegativeInt.nullable(),
    }),
    events: z.strictObject({
      enabled: z.boolean(),
      nextDay: nonNegativeInt,
      active: z.array(
        z.strictObject({
          eventId: z.string(),
          daysLeft: nonNegativeInt,
          effect: z.discriminatedUnion('type', [
            z.strictObject({
              type: z.literal('production'),
              resource: z.union([z.enum(RESOURCE_IDS), z.literal('all')]),
              multiplier: z.number().nonnegative(),
            }),
            z.strictObject({ type: z.literal('happiness'), amount: z.number().finite() }),
            z.strictObject({ type: z.literal('disable_building'), buildingId: z.string() }),
          ]),
        }),
      ),
      pending: z
        .strictObject({
          eventId: z.string(),
          day: nonNegativeInt,
          buildingId: z.string().optional(),
          resource: z.enum(RESOURCE_IDS).optional(),
          amount: nonNegative.optional(),
          cost: nonNegative.optional(),
        })
        .nullable(),
    }),
  })
  .superRefine((state, ctx) => {
    if (state.world.tiles.length !== state.world.width * state.world.height) {
      ctx.addIssue({
        code: 'custom',
        path: ['world', 'tiles'],
        message: 'Počet políčok nezodpovedá rozmerom mapy',
      });
    }
    const ids = new Set<string>();
    for (const building of state.city.buildings) {
      if (ids.has(building.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['city', 'buildings'],
          message: `Duplicitné ID budovy ${building.id}`,
        });
      }
      ids.add(building.id);
      if (building.position.x >= state.world.width || building.position.y >= state.world.height) {
        ctx.addIssue({
          code: 'custom',
          path: ['city', 'buildings'],
          message: `Budova ${building.id} je mimo mapy`,
        });
      }
    }
  }) satisfies z.ZodType<GameState>;
