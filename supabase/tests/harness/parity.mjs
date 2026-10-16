// Inputs for the parity tests: a valid input, then every key replaced by each value of its pool (or left out), then
// seeded random mixes of those, then inputs that are not objects at all. The SQL twin and the contract's validator
// must report the same issues for every one of them (supabase/tests/twins.test.mjs).
import assert from 'node:assert/strict';

/** A key's value left out of the input. */
export const ABSENT = Symbol('absent');

/** Values worth trying anywhere: absent, null, the wrong types, the edges of numbers. */
export const ANY = [ABSENT, null, '', ' ', 'x', 0, 1, -1, 1.5, 2 ** 53, true, false, [], {}];

/** A seeded generator (the same inputs on every run). */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function setPath(obj, path, v) {
  const out = structuredClone(obj);
  const keys = path.split('.');
  let at = out;
  for (const k of keys.slice(0, -1)) {
    if (at[k] === null || typeof at[k] !== 'object' || Array.isArray(at[k])) at[k] = {};
    at = at[k];
  }
  const last = keys.at(-1);
  if (v === ABSENT) delete at[last];
  else at[last] = structuredClone(v);
  return out;
}

/** The inputs: base, one change at a time, `random` mixes, an unknown key, and non-objects. */
export function inputs(base, pools, { random = 150, seed = 7 } = {}) {
  const out = [base];
  for (const [path, values] of Object.entries(pools)) for (const v of values) out.push(setPath(base, path, v));
  const r = rng(seed);
  const paths = Object.keys(pools);
  for (let i = 0; i < random; i++) {
    let o = base;
    for (const p of paths) if (r() < 0.35) o = setPath(o, p, pools[p][Math.floor(r() * pools[p].length)]);
    out.push(o);
  }
  out.push({ ...base, extra: 1 }, null, [], 'input', 5, {});
  return out;
}

const key = (e) => `${e.code}@${e.path}`;

/**
 * Runs the SQL twin on every input in one query and compares it with the contract's validator: the same issues (as a
 * set), and the same first issue when no key is unknown (the code an RPC answers).
 */
export async function compareValidator(admin, sqlFn, tsFn, list) {
  const { rows } = await admin.query(`select coalesce(jsonb_agg(${sqlFn}(x) order by i), '[]') as r
    from jsonb_array_elements($1::jsonb) with ordinality t(x, i)`, [JSON.stringify(list)]);
  const sql = rows[0].r;
  assert.equal(sql.length, list.length);
  list.forEach((input, i) => {
    const ts = tsFn(input);
    const want = ts.ok ? [] : ts.errors.map(key);
    const got = sql[i].map(key);
    const label = `${sqlFn} on ${JSON.stringify(input)?.slice(0, 160)}`;
    assert.deepEqual([...got].sort(), [...want].sort(), label);
    if (!want.some((k) => k.startsWith('field_not_allowed@'))) assert.equal(got[0], want[0], label + ' (first issue)');
  });
  return list.length;
}
