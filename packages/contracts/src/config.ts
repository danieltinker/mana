/**
 * The three environment flags every app reads from `window.HALOM_MENUS_CONFIG` (ADR-007). The platform lane writes
 * the config files; apps read the flags only through `configFlags`, so "absent" means the same everywhere:
 * - `env`: 'production' | 'demo' | 'local' (absent = 'production');
 * - `schema`: 1 | 2 (absent = 1): production runs v1 on `halom-studio` until the cutover; demo (`mana`) and local (the
 *   simulator's stack) run v2;
 * - `realtime`: boolean (absent = true): the local stack has no Realtime server, so local says false and the
 *   dashboards poll (`LIVE_REFRESH`).
 * Until the cutover production runs schema 1 only: production with `schema: 2` is reported (`schema_env_mismatch`)
 * and read as 1, so a wrong config file cannot point production's pages at v2 code.
 */
// No runtime import: the v1 owner app's entry loads this file, and it must pull in no other contract module.
import type { Issue } from './common.ts';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const APP_ENVS = ['production', 'demo', 'local'] as const;
export type AppEnv = (typeof APP_ENVS)[number];
export type SchemaVersion = 1 | 2;
export type ConfigFlags = { readonly env: AppEnv; readonly schema: SchemaVersion; readonly realtime: boolean };

export const DEFAULT_FLAGS: ConfigFlags = { env: 'production', schema: 1, realtime: true };

/**
 * The flags of a config object, with the defaults for what is absent. A value that is present but not one of the
 * allowed ones is a broken config file: it is reported in `issues` (codes `env_invalid`, `schema_invalid`,
 * `realtime_invalid`, `schema_env_mismatch`) and replaced by the default, so a page never runs v2 code against v1 data
 * by accident.
 */
export function configFlags(raw: unknown): ConfigFlags & { readonly issues: readonly Issue[] } {
  const issues: Issue[] = [];
  const o = isObject(raw) ? raw : {};
  let env = DEFAULT_FLAGS.env;
  let schema = DEFAULT_FLAGS.schema;
  let realtime = DEFAULT_FLAGS.realtime;
  if (o.env !== undefined) {
    if ((APP_ENVS as readonly unknown[]).includes(o.env)) env = o.env as AppEnv;
    else issues.push({ code: 'env_invalid', path: 'env' });
  }
  if (o.schema !== undefined) {
    if (o.schema === 1 || o.schema === 2) schema = o.schema;
    else issues.push({ code: 'schema_invalid', path: 'schema' });
  }
  if (o.realtime !== undefined) {
    if (typeof o.realtime === 'boolean') realtime = o.realtime;
    else issues.push({ code: 'realtime_invalid', path: 'realtime' });
  }
  if (env === 'production' && schema === 2) {
    issues.push({ code: 'schema_env_mismatch', path: 'schema' });
    schema = 1;
  }
  return { env, schema, realtime, issues };
}
