/* Looks (templates/): the contract holds for the shipped file and refuses what it should; a look reaches the theme and the
   table's lamp; an owner's own table photo still wins; an unknown look leaves today's theme. Pure, no browser. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { validateLooks, validateLook, SURFACES, DETAILS, contrast, hexRgb } from '../../templates/validate.mjs';
import { lookOf, looks, applyLook, resetPresets, applyLookDom, inkAccent, trackOf, ID } from '../src/looks.js';
import { normalise } from '../src/snapshot.js';
import { PRESETS } from '../src/scenes/walk.js';
import { TABLES } from '../src/scenes/common.js';

const file = new URL('../../templates/templates.v1.json', import.meta.url);
const doc = () => JSON.parse(readFileSync(file, 'utf8'));
const good = () => ({ id: 'x-look', category: 'cafe', subcategory: 'cafe-boho', name: { he: 'מבט', en: 'Look' }, surface: 'oak', accent: '#e3b23c', card: 'dark', light: { pool: 2, open: .8 }, motion: 'settle', detail: 'tracks', fonts: 'house' });

test('the shipped looks file is sound, and every surface is one of the engine\'s tables', () => {
  const d = doc(), r = validateLooks(d);
  assert.deepEqual(r, { ok: true, errors: [] });
  assert.equal(d.v, 1); assert.ok(d.looks.length >= 4);
  assert.deepEqual(SURFACES.slice().sort(), Object.keys(TABLES).sort(), 'the validator\'s list is the engine\'s TABLES');
  for (const l of d.looks) { assert.ok(TABLES[l.surface], l.id + ' lies on a real table'); assert.ok(DETAILS.includes(l.detail)); assert.match(l.id, ID); assert.ok(/[֐-׿]/.test(l.name.he), l.id + ' is named in Hebrew'); }
  assert.deepEqual(d.looks.map((l) => l.id), ['album-side', 'casablanca-white', 'counter-shout', 'back-door'].concat(d.looks.slice(4).map((l) => l.id)));
  const cw = d.looks.find((l) => l.id === 'casablanca-white'); assert.equal(cw.card, 'light'); assert.equal(cw.ink, '#0f0f0f'); assert.equal(cw.surface, 'marble'); assert.ok(cw.finish.spec < TABLES.marble.spec && cw.finish.refl < TABLES.marble.refl, 'whitewashed, not polished');
  assert.equal(d.looks.find((l) => l.id === 'album-side').name.he, 'צד א׳');
});

test('the validator refuses what the engine could not wear', () => {
  const bad = (patch, re) => { const l = Object.assign(good(), patch); const errs = validateLook(l); assert.ok(errs.some((e) => re.test(e)), JSON.stringify(patch) + ' → ' + errs.join(' | ')); };
  assert.deepEqual(validateLook(good()), []);
  bad({ surface: 'velvet' }, /surface/); bad({ surface: 'custom' }, /surface/); bad({ surface: 'holo' }, /surface/);
  bad({ accent: 'red' }, /accent/); bad({ accent: '#FF0000' }, /accent/); bad({ accent: '#300000' }, /reads at/);          // too dark to read on the dark card
  bad({ card: 'glass' }, /card/); bad({ card: 'light' }, /ink/); bad({ card: 'light', ink: '#cccccc' }, /reads at/); bad({ ink: '#000000' }, /ink belongs/);
  bad({ light: { pool: 0, open: .5 } }, /light/); bad({ light: { pool: 2, open: 9 } }, /light/); bad({ light: { pool: 2, open: .5, dim: .2 } }, /not part/); bad({ light: null }, /light/);
  bad({ finish: { gloss: 1 } }, /finish/); bad({ finish: { spec: 4 } }, /finish\.spec/); bad({ finish: 'matte' }, /finish/);
  bad({ motion: 'spin' }, /motion/); bad({ detail: 'particles' }, /detail/); bad({ fonts: 'Fraunces' }, /fonts/);
  bad({ id: 'Album Side' }, /id/); bad({ id: 'a'.repeat(41) }, /id/); bad({ category: 'souk' }, /category/); bad({ subcategory: 'bar-hidden' }, /subcategory/);
  bad({ name: { he: 'Album Side', en: 'Album Side' } }, /Hebrew/); bad({ name: { en: 'x' } }, /name/); bad({ texture: 'x.jpg' }, /unknown field/);
  assert.equal(validateLooks({ v: 1, looks: [good(), good()] }).errors.filter((e) => /duplicate/.test(e)).length, 1);
  assert.equal(validateLooks({ v: 2, looks: [good()] }).ok, false); assert.equal(validateLooks({ v: 1, looks: [] }).ok, false); assert.equal(validateLooks(null).ok, false);
  assert.ok(contrast(hexRgb('#ffffff'), hexRgb('#000000')) > 20);
});

test('a look gives the surface, the accent and the lamp; an unknown id leaves today\'s theme', () => {
  const base = { pool: PRESETS.table.pool, open: PRESETS.table.open };
  const theme = { accent: '#c9c56a', surface: 'oak', tableImg: null, template: 'album-side' };
  const look = applyLook(theme, PRESETS);
  assert.equal(look.id, 'album-side'); assert.equal(theme.surface, 'concrete'); assert.equal(theme.accent, look.accent);
  assert.equal(PRESETS.table.pool, look.light.pool); assert.equal(PRESETS.table.open, look.light.open); assert.notEqual(PRESETS.table.pool, base.pool);
  assert.equal(PRESETS.table.surface(theme).id, 'concrete'); assert.equal(PRESETS.table.surface(theme).spec, TABLES.concrete.spec, 'no finish: the table\'s own gloss');
  /* a matte finish on marble */
  const t2 = { accent: '#c9c56a', surface: 'oak', tableImg: null, template: 'casablanca-white' }, cw = applyLook(t2, PRESETS);
  const d = PRESETS.table.surface(t2); assert.equal(d.id, 'marble'); assert.equal(d.spec, cw.finish.spec); assert.equal(d.shin, cw.finish.shin); assert.equal(d.refl, cw.finish.refl); assert.equal(d.size, TABLES.marble.size);
  assert.equal(TABLES.marble.spec, .42, 'the engine\'s own marble is untouched');
  /* unknown, malformed, missing: today's numbers, nothing changed */
  for (const id of ['souk', 'Album-Side', '../x', '', null, undefined, 'a'.repeat(41)]) {
    const t3 = { accent: '#c9c56a', surface: 'oak', tableImg: null, template: id };
    assert.equal(applyLook(t3, PRESETS), null, String(id)); assert.equal(t3.surface, 'oak'); assert.equal(t3.accent, '#c9c56a');
    assert.equal(PRESETS.table.pool, base.pool); assert.equal(PRESETS.table.open, base.open); assert.equal(PRESETS.table.surface(t3).id, 'oak');
  }
  resetPresets(PRESETS); assert.equal(PRESETS.table.pool, base.pool);
  assert.equal(lookOf('back-door').surface, 'walnut'); assert.equal(lookOf('nope'), null); assert.equal(looks().length, doc().looks.length);
});

test('precedence: an owner\'s own table photo still wins over the look\'s surface; a holo theme takes the look\'s table', () => {
  const own = { accent: '#112233', surface: 'custom', tableImg: 'https://x.test/table.jpg', template: 'counter-shout' };
  const look = applyLook(own, PRESETS);
  assert.equal(look.id, 'counter-shout'); assert.equal(own.surface, 'custom'); assert.equal(own.tableImg, 'https://x.test/table.jpg'); assert.equal(own.accent, look.accent, 'the accent and the lamp are the look\'s');
  assert.equal(PRESETS.table.pool, look.light.pool); assert.equal(PRESETS.table.surface(own).id, 'custom'); assert.equal(PRESETS.table.surface(own).img, own.tableImg);
  const noImg = { accent: '#112233', surface: 'custom', tableImg: null, template: 'counter-shout' }; applyLook(noImg, PRESETS); assert.equal(noImg.surface, 'steel', 'custom without a photo is no photo');
  const holo = { accent: '#112233', surface: 'holo', tableImg: null, template: 'back-door' }; applyLook(holo, PRESETS); assert.equal(holo.surface, 'walnut');
  resetPresets(PRESETS);
});

test('theme.template rides in the v1 snapshot: validated, never required, older fields untouched', () => {
  const snap = (template) => normalise({ v: 1, business: { name: 'X' }, theme: { accent: '#123456', surface: 'oak', template }, categories: [{ id: 'a', name: 'A', items: [{ id: 'i', name: 'I' }] }] }, 'https://h.test/');
  assert.equal(snap('album-side').theme.template, 'album-side'); assert.equal(snap('album-side').v, 1); assert.equal(snap('album-side').theme.surface, 'oak', 'normalise stores the id; the look is applied by the viewer');
  for (const bad of ['Album Side', '../x', 'a'.repeat(41), 42, {}, '']) assert.equal(snap(bad).theme.template, null, String(bad));
  assert.equal(snap(undefined).theme.template, null);
  assert.equal(snap('x').theme.accent, '#123456');
});

test('the light card\'s price is the accent pulled dark enough to read; track numbers read A1, A2', () => {
  const cw = lookOf('casablanca-white'), bg = [252 * .86 + 11 * .14, 248 * .86 + 9 * .14, 246 * .86 + 7 * .14];
  const p = inkAccent(cw.accent, cw.ink); assert.match(p, /^#[0-9a-f]{6}$/); assert.ok(contrast(hexRgb(p), bg) >= 4.5, p);
  assert.ok(contrast(hexRgb(cw.accent), bg) < 4.5, 'the saffron itself would not read on whitewash');
  assert.equal(inkAccent('#0f0f0f', '#0f0f0f'), '#0f0f0f');
  assert.equal(trackOf(0, 0), 'A1'); assert.equal(trackOf(0, 8), 'A9'); assert.equal(trackOf(2, 3), 'C4'); assert.equal(trackOf(30, 0), 'Z1'); assert.equal(trackOf(-1, -1), 'A1');
});

test('applyLookDom: the attributes and the custom properties the CSS reads, and nothing left behind', () => {
  const style = { vars: {}, setProperty(k, v) { this.vars[k] = v; }, removeProperty(k) { delete this.vars[k]; } };
  const root = { style }, cls = new Set(), app = { className: 'app live', dataset: {}, classList: { add: (c) => { cls.add(c); app.className += ' ' + c; } } };
  applyLookDom(root, app, lookOf('casablanca-white'));
  assert.equal(app.dataset.look, 'casablanca-white'); assert.equal(app.dataset.card, 'light'); assert.ok(app.className.includes('look-tile-stripe')); assert.equal(style.vars['--look-ink'], '#0f0f0f'); assert.ok(style.vars['--look-price']);
  applyLookDom(root, app, lookOf('back-door'));
  assert.ok(app.className.includes('look-door-crack') && !app.className.includes('look-tile-stripe')); assert.equal(app.dataset.card, 'dark'); assert.equal(style.vars['--look-ink'], undefined);
  applyLookDom(root, app, null);
  assert.equal(app.dataset.look, undefined); assert.equal(app.className, 'app live'); assert.deepEqual(style.vars, {});
});

test('the matrix keeps all 99 concepts as data, without their sources; the live looks point into it', () => {
  const m = JSON.parse(readFileSync(new URL('../../templates/matrix.json', import.meta.url), 'utf8')), txt = JSON.stringify(m);
  const subs = m.categories.flatMap((c) => c.subcategories), vars = subs.flatMap((s) => s.variants);
  assert.equal(m.categories.length, 9); assert.equal(subs.length, 33); assert.equal(vars.length, 99);
  assert.ok(!/inspiredBy/.test(txt), 'inspiredBy stays in sources.md'); assert.equal(new Set(vars.map((v) => v.id)).size, 99);
  for (const l of doc().looks) { assert.ok(m.categories.some((c) => c.id === l.category), l.category); assert.ok(subs.some((s) => s.id === l.subcategory && s.id.startsWith(l.category + '-')), l.subcategory); }
  assert.ok(existsSync(new URL('../../templates/sources.md', import.meta.url)));
  assert.ok(!vars.some((v) => /^the salon$|flore|thonet|sessions/i.test(v.name)), 'no venue, maker or menu-page name as a concept name');
});
