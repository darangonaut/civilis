import { SCHEMA_VERSION } from '@/engine/core/constants';
import type { GameState } from '@/types';
import { gameStateSchema } from './gameStateSchema';

/** Migrácia z verzie N na N + 1 nad surovými (ešte nevalidovanými) dátami. */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Registrované migrácie: kľúč = zdrojová verzia. Pri zmene `GameState` zvýš SCHEMA_VERSION
 * a pridaj sem funkciu, ktorá prevedie staré dáta na nové.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

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
