// The seeds: in the repository synthetic only, never the mock client; real venues' seeds only from private/; the
// in-repo Café Demo loads through the bots and the guest gets exactly the menu the seed describes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { menuAvailability, validateSnapshotV2 } from '@mana/contracts';
import { GuestBot } from '../src/guest.mjs';
import { loadSeed, PRIVATE, readSeed, seedProblems, SEEDS } from '../src/seed.mjs';
import { snapshotVsSeed, useStack } from './helpers.mjs';

const S = useStack();
const files = fs.readdirSync(SEEDS).filter((f) => f.endsWith('.json'));

test('every seed in the repository is synthetic, well formed, and never the mock client', () => {
  assert.ok(files.length >= 2);
  for (const f of files) {
    const text = fs.readFileSync(path.join(SEEDS, f), 'utf8');
    const { seed } = readSeed(path.join(SEEDS, f));
    assert.equal(seed.synthetic, true, f);
    assert.deepEqual(seedProblems(seed), [], f);
    assert.doesNotMatch(text, /noir/i, `${f} must not name the mock client`);
    assert.doesNotMatch(text, /@(?!example\.invalid)[a-z0-9-]+\.[a-z]/i, `${f}: no real e-mail address`);
  }
});

test('a seed that is not synthetic loads only from private/ (git-ignored)', () => {
  const real = { venue: { slug: 'some-real-place', name: { en: 'A real place' } }, sections: [] };
  const outside = path.join(SEEDS, '..', `.not-synthetic-${process.pid}.json`);
  fs.writeFileSync(outside, JSON.stringify(real));
  try {
    assert.throws(() => readSeed(outside), /must be synthetic/);
  } finally { fs.rmSync(outside, { force: true }); }
  const made = !fs.existsSync(PRIVATE);
  fs.mkdirSync(PRIVATE, { recursive: true });
  const inside = path.join(PRIVATE, `.sim-test-${process.pid}.json`);
  fs.writeFileSync(inside, JSON.stringify(real));
  try {
    assert.equal(readSeed(inside).private, true);
  } finally {
    fs.rmSync(inside, { force: true });
    if (made) fs.rmSync(PRIVATE, { recursive: true, force: true });
  }
  assert.match(fs.readFileSync(path.join(SEEDS, '../../.gitignore'), 'utf8'), /^private\/$/m, 'private/ stays out of git');
});

test('seedProblems names duplicate keys and unknown references', () => {
  const p = seedProblems({
    venue: { slug: 'x-y' },
    groups: [{ key: 'g', options: [{ key: 'o', opens: 'nope' }, { key: 'o' }] }],
    sections: [{ key: 's', dishes: [{ key: 'd', groups: ['missing'], related: ['ghost'] }] }],
    rules: [{ key: 'r', trigger: 'add', scope: { dishes: ['d'] }, suggest: { dish: 'phantom' } }],
  });
  assert.deepEqual(p, [
    'groups[0].options[1]: key "o" used twice',
    'groups[0].options[0].opens: unknown group "nope"',
    'sections[0].dishes[0].groups: unknown group "missing"',
    'sections[0].dishes[0].related: unknown dish "ghost"',
    'rules[0].suggest: unknown dish "phantom"',
  ]);
});

test('Café Demo loads through the bots; the guest gets exactly the menu the seed describes', async () => {
  const { seed } = readSeed(path.join(SEEDS, 'cafe-demo.json'));
  const r = await loadSeed(S.stack, seed);
  assert.deepEqual([r.published.ok, r.published.revision, r.published.review, r.approved.ok], [true, 1, 'pending', true]);
  assert.deepEqual(r.published.warnings, []);
  const preview = await r.owner.preview();
  assert.deepEqual([preview.issues, preview.warnings], [[], []]);
  const g = new GuestBot(S.stack, { ip: '10.50.0.1' });
  const menu = await g.open('cafe-demo');
  assert.equal(menu.state, 'ok');
  assert.ok(validateSnapshotV2(menu.snapshot).ok);
  assert.deepEqual(menu.snapshot, (await r.owner.revision(1)).snapshot);
  assert.deepEqual(snapshotVsSeed(menu.snapshot, seed, r.ids), []);
  assert.equal(menu.snapshot.venue.name.en, 'Café Demo');
  // this menu depends on the clock: breakfast is a day part, the Friday cake a special
  const av = menuAvailability(menu.snapshot, menu.live, Date.now());
  for (const k of ['shakshuka', 'friday-cake']) {
    const a = av.dishes.get(r.ids.dishes[k]);
    assert.ok(a.available || ['schedule', 'closed'].includes(a.reason), `${k}: ${JSON.stringify(a)}`);
  }
  // the same seed again under another slug: a second venue, its own ids
  const again = await loadSeed(S.stack, seed, { slug: 'cafe-demo-2' });
  assert.notEqual(again.venueId, r.venueId);
  assert.notEqual(again.ids.dishes.burger, r.ids.dishes.burger);
});
