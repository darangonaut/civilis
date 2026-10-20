import { SCHEMA_VERSION } from '@/engine/core/constants';
import type { GameState } from '@/types';
import { gameStateSchema } from './gameStateSchema';

/** Migrácia z verzie N na N + 1 nad surovými (ešte nevalidovanými) dátami. */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Registrované migrácie: kľúč = zdrojová verzia. Pri zmene `GameState` zvýš SCHEMA_VERSION
 * a pridaj sem funkciu, ktorá prevedie staré dáta na nové.
 */
type RawCity = {
  buildings?: Record<string, unknown>[];
  population?: Record<string, unknown>;
  economy?: { resources?: Record<string, unknown> } & Record<string, unknown>;
} & Record<string, unknown>;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  /** v1 → v2: budovy dostali úroveň (doterajšie sú na úrovni 1), populácia rozpracovaný prírastok. */
  1: (raw) => {
    const city = raw.city as RawCity | undefined;
    if (!city || !Array.isArray(city.buildings)) return raw;
    return {
      ...raw,
      city: {
        ...city,
        buildings: city.buildings.map((b) => ({ level: 1, ...b })),
        population: { growthProgress: 0, ...city.population },
      },
    };
  },
  /** v8 → v9: obtiažnosť; staršie hry sú normálne. */
  8: (raw) => ({ difficulty: 'normal', ...raw }),
  /** v7 → v8: zložky spokojnosti tovar a prostredie (potreby obyvateľov, znečistenie). */
  7: (raw) => {
    const city = raw.city as RawCity | undefined;
    const population = city?.population as Record<string, unknown> | undefined;
    const factors = population?.happinessFactors as Record<string, unknown> | undefined;
    if (!city || !population || !factors) return raw;
    return {
      ...raw,
      city: {
        ...city,
        population: {
          ...population,
          happinessFactors: { goods: 100, environment: 100, ...factors },
        },
      },
    };
  },
  /** v6 → v7: náhodné udalosti (prvá najskôr o 40 dní od načítania). */
  6: (raw) => {
    const simulation = raw.simulation as { day?: number } | undefined;
    return {
      events: { enabled: true, nextDay: (simulation?.day ?? 0) + 40, active: [], pending: null },
      ...raw,
    };
  },
  /** v5 → v6: zložka spokojnosti „oddych“, obchod a úspechy. */
  5: (raw) => {
    const city = raw.city as RawCity | undefined;
    const population = city?.population as Record<string, unknown> | undefined;
    const factors = population?.happinessFactors as Record<string, unknown> | undefined;
    return {
      trade: { autoSell: [], earned: 0 },
      achievements: { completedIds: [], finishedDay: null },
      ...raw,
      ...(city && population && factors
        ? {
            city: {
              ...city,
              population: { ...population, happinessFactors: { leisure: 0, ...factors } },
            },
          }
        : {}),
    };
  },
  /** v4 → v5: poradie výskumu. */
  4: (raw) => {
    const research = raw.research as Record<string, unknown> | undefined;
    if (!research) return raw;
    return { ...raw, research: { queue: [], ...research } };
  },
  /** v3 → v4: nové suroviny látky, uhlie, elektrina a elektronika (éry 4–8). */
  3: (raw) => {
    const city = raw.city as RawCity | undefined;
    if (!city?.economy?.resources) return raw;
    return {
      ...raw,
      city: {
        ...city,
        economy: {
          ...city.economy,
          resources: {
            cloth: 0,
            coal: 0,
            electricity: 0,
            electronics: 0,
            ...city.economy.resources,
          },
        },
      },
    };
  },
  /** v2 → v3: nové suroviny tehly a železo (éry Starovek a Stredovek). */
  2: (raw) => {
    const city = raw.city as RawCity | undefined;
    if (!city?.economy?.resources) return raw;
    return {
      ...raw,
      city: {
        ...city,
        economy: { ...city.economy, resources: { bricks: 0, iron: 0, ...city.economy.resources } },
      },
    };
  },
};

export type SaveErrorCode =
  'invalid_format' | 'newer_version' | 'missing_migration' | 'invalid_state';

export class SaveError extends Error {
  constructor(
    readonly code: SaveErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'SaveError';
  }
}

/**
 * Prevedie uložené dáta ľubovoľnej podporovanej verzie na aktuálny `GameState`
 * a zvaliduje ich. Pri probléme vyhodí `SaveError` so zrozumiteľným kódom.
 */
export function migrateGameState(
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  targetVersion = SCHEMA_VERSION,
): GameState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new SaveError('invalid_format');
  let data = raw as Record<string, unknown>;
  let version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new SaveError('invalid_format', 'chýba schemaVersion');
  }
  if (version > targetVersion) throw new SaveError('newer_version', `verzia ${version}`);

  while (version < targetVersion) {
    const migrate = migrations[version];
    if (!migrate) throw new SaveError('missing_migration', `z verzie ${version}`);
    data = { ...migrate(data), schemaVersion: version + 1 };
    version += 1;
  }

  const result = gameStateSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new SaveError(
      'invalid_state',
      issue ? `${issue.path.join('.')}: ${issue.message}` : undefined,
    );
  }
  return result.data;
}
