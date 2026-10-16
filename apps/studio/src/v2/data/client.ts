// The v2 app's one door to Supabase: the same supabase-js client and sign-in as the v1 app (lib/api.ts: PKCE, the
// session kept under the same key), and the runtime fields of the config (RULES: env, schema, realtime).
import { cfg, sb } from '../../lib/api.ts';
import { refusal, toV2Error } from './errors.ts';

export { cfg, sb };

const raw = ((window as any).HALOM_MENUS_CONFIG || {}) as { env?: unknown; schema?: unknown; realtime?: unknown };
export const runtime = {
  env: (raw.env === 'demo' || raw.env === 'local' ? raw.env : 'production') as 'production' | 'demo' | 'local',
  schema: raw.schema === 2 ? 2 : 1,
  /** false on the local stack (no Realtime server): screens that would subscribe refresh by hand instead. */
  realtime: raw.realtime !== false,
} as const;

/** Await a supabase-js call; its data, or a V2Error. */
export async function q<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  let r: { data: unknown; error: unknown };
  try { r = await p; } catch (e) { throw toV2Error(e); }
  if (r.error) throw toV2Error(r.error);
  return r.data as T;
}

/** An RPC whose answer may be `{ ok: false, code }`: that refusal is thrown as a V2Error with the code. */
export async function rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
  return refusal(await q<T>(sb.rpc(fn, args)));
}
