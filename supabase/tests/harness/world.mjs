// The people and venues every database test starts from (all synthetic):
//   venue A = "Café Demo" from supabase/seed/synthetic.sql (a demo venue, published), with an owner, a manager, a counter;
//   venue B = "Bistro Test", made by its owner through create_venue, one section, one dish, published (a real venue);
//   Halom staff: one support, one admin; and a signed-in stranger with no venue.
import assert from 'node:assert/strict';
import { as, rpc, startCluster } from './cluster.mjs';
import { ID } from '../../../packages/contracts/test/fixtures.ts';

export const U = {
  ownerA: '11111111-1111-4111-8111-1111111111a1',
  managerA: '11111111-1111-4111-8111-1111111111a2',
  counterA: '11111111-1111-4111-8111-1111111111a3',
  ownerB: '11111111-1111-4111-8111-1111111111b1',
  support: '11111111-1111-4111-8111-1111111111f1',
  admin: '11111111-1111-4111-8111-1111111111f2',
  stranger: '11111111-1111-4111-8111-1111111111e1',
};
export const A = ID.venue;
export { ID };

export async function world() {
  const c = await startCluster({ seed: true });
  try {
    await c.admin.query(
      `insert into auth.users (id, email, last_sign_in_at) select u.id, u.email, now() from (values ${Object.entries(U)
        .map(([k, v]) => `('${v}'::uuid, '${k.toLowerCase()}@example.invalid')`).join(', ')}) u(id, email)`,
    );
    await c.admin.query(`insert into public.venue_members (venue_id, user_id, role) values
      ($1, '${U.ownerA}', 'owner'), ($1, '${U.managerA}', 'manager'), ($1, '${U.counterA}', 'counter')`, [A]);
    await c.admin.query(`insert into public.staff (user_id, role, note) values ('${U.support}', 'support', 'test'), ('${U.admin}', 'admin', 'test')`);

    const made = await rpc(c.url, U.ownerB, 'create_venue', { p_slug: 'bistro-test', p_name_he: 'ביסטרו טסט', p_name_en: 'Bistro Test', p_kind: 'restaurant' });
    assert.equal(made.ok, true, JSON.stringify(made));
    const B = made.id;
    const ids = await as(c.url, U.ownerB, async (q) => {
      const s = (await q.query(`insert into public.sections (venue_id, name_he, name_en) values ($1, 'ראשונות', 'Starters') returning id`, [B])).rows[0].id;
      const d = (await q.query(`insert into public.dishes (venue_id, section_id, name_he, name_en, price) values ($1, $2, 'מרק', 'Soup', 3800) returning id`, [B, s])).rows[0].id;
      const g = (await q.query(`insert into public.addon_groups (venue_id, name_he, name_en, selection, min_units, max_units) values ($1, 'לחם', 'Bread', 'single', 0, 1) returning id`, [B])).rows[0].id;
      const o = (await q.query(`insert into public.addon_options (venue_id, group_id, name_he, name_en, price) values ($1, $2, 'פוקצ׳ה', 'Focaccia', 900) returning id`, [B, g])).rows[0].id;
      return { section: s, dish: d, group: g, option: o };
    });
    const pub = await rpc(c.url, U.ownerB, 'publish_menu', { p_venue: B, p_note: 'first' });
    assert.equal(pub.ok, true, JSON.stringify(pub));
    return { ...c, B, b: ids };
  } catch (e) {
    await c.stop();
    throw e;
  }
}

/** The rows a role sees (or the error code), for terse assertions. */
export async function count(url, who, sql, params = []) {
  try {
    return await as(url, who, async (q) => (await q.query(sql, params)).rowCount);
  } catch (e) {
    return e.code;
  }
}
