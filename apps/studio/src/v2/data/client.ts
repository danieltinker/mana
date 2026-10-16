// The v2 app's one door to Supabase: the same supabase-js client and sign-in as the v1 app (lib/api.ts: PKCE, the
// session kept under the same key), and the config's flags (env, schema, realtime), read only through the contracts'
// configFlags (ADR-007), so "absent" and "broken" mean the same in every app.
import { configFlags, type ConfigFlags } from '@mana/contracts';
import { cfg, sb } from '../../lib/api.ts';
import { refusal, toV2Error } from './errors.ts';

export { cfg, sb };

const flags = configFlags((window as any).HALOM_MENUS_CONFIG);
if (flags.issues.length) console.warn('config.js:', flags.issues.map((x) => x.code).join(', '));
/** `realtime` is false on the local stack (no Realtime server): live screens poll instead. */
export const runtime: ConfigFlags = { env: flags.env, schema: flags.schema, realtime: flags.realtime };

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
