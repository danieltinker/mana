// The owner app on the clean schema (apps/studio/src/v2), on a 390 × 844 phone, against the simulator's stack, with
// invented data only: an owner bot's user signs in, makes a place, builds a schnitzel whose required "side of choice"
// (fries, salad, rice) has fries opening a nested sauce, attaches the side to a second dish with a tighter maximum,
// tries the guest preview's combinations, is refused a second nesting level, publishes and sees the wait for Halom's
// approval; after a Halom bot approves, public_menu returns exactly what was built, and every total the preview showed is
// what priceDish gives guests for the same choices. The edge cases (two tabs, lost answers, a counter, sign-up) are in
// studio-v2-edges.test.mjs. Needs the built site (bash tools/build-site.sh). Screenshots: e2e/.out/studio-v2/.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { asAnon, createUser, HalomBot, OwnerBot } from '@mana/sim';
import { fromPrice, priceDish, pricingContext } from '@mana/contracts';
import { OUT, startE2E } from './helpers.mjs';

const SHOTS = path.join(OUT, 'studio-v2');
const PASSWORD = 'sim-owner-pass-1';
let e;

before(async () => {
  e = await startE2E({ seed: null });
  if (!e.hasSite) throw new Error('the site is not built: run bash tools/build-site.sh first');
  fs.mkdirSync(SHOTS, { recursive: true });
}, { timeout: 180000 });
after(async () => { await e?.stop(); });

const studio = () => e.page(e.webUrl + 'studio/');
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
/** What went wrong in the page, less the refusals these tests cause on purpose (the browser logs each HTTP 400). */
const problems = (page) => page.problems.filter((p) => !/Failed to load resource: the server responded with a status of 400/.test(p));
const nis = (agorot) => '₪' + (agorot % 100 ? (agorot / 100).toFixed(2) : String(agorot / 100));

async function signIn(page, email) {
  await page.getByLabel('אימייל').fill(email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'המשך' }).click();
}

test('an e-mail that is not confirmed yet is told so plainly, before any place can be made', async () => {
  await createUser(e.stack, { email: 'waiting@sim.local', password: PASSWORD, confirmed: false });
  const page = await studio();
  await signIn(page, 'waiting@sim.local');
  await page.getByRole('heading', { name: 'אשרו את כתובת האימייל' }).waitFor();
  assert.match(await page.locator('main').innerText(), /waiting@sim\.local/);
  await shot(page, '00-confirm-email');
  assert.deepEqual(problems(page), []);
});

test('an owner builds a schnitzel with a nested sauce, publishes, and after Halom approves guests get exactly that', { timeout: 600000 }, async () => {
  const owner = await OwnerBot.signUp(e.stack, { email: 'owner-v2@sim.local', password: PASSWORD });
  const page = await studio();

  // ---- sign in, make the place
  await signIn(page, 'owner-v2@sim.local');
  const name = page.locator('#place-name');
  await name.waitFor();
  await name.fill('Schnitzel Sim');
  await page.locator('[data-avail="free"]').waitFor();
  assert.equal(await page.locator('[data-slug]').innerText(), 'schnitzel-sim');
  await page.getByRole('radio', { name: 'מסעדה' }).click();
  await shot(page, '01-new-place');
  await page.getByRole('button', { name: 'יצירת המקום' }).click();
  await page.getByRole('heading', { name: 'התפריט עוד ריק' }).waitFor();
  await shot(page, '02-empty-menu');

  // ---- sections (Hebrew and English names) and dishes
  async function addSection(he, en, kind) {
    const empty = page.getByRole('button', { name: 'קטגוריה ראשונה' });
    if (await empty.count()) await empty.click(); else await page.locator('[data-tool="section"]').click();
    const sheet = page.locator('dialog[data-sheet="section"]');
    await sheet.locator('[data-field="section-name-he"]').fill(he);
    await sheet.getByRole('button', { name: 'English' }).click();
    await sheet.locator('[data-field="section-name-en"]').fill(en);
    await sheet.locator(`[data-kind="${kind}"]`).click();
    await sheet.locator('[data-action="save-section"]').click();
    await page.getByRole('heading', { name: he, level: 2 }).waitFor();
  }
  async function quickAdd(section, dish, price) {
    const form = page.locator(`form[aria-label="מנה חדשה ב${section}"]`);
    if (!(await form.count())) await page.getByRole('button', { name: `מנה חדשה ב${section}` }).click();
    await form.getByLabel('שם המנה').fill(dish);
    await form.getByLabel('מחיר').fill(price);
    await form.getByRole('button', { name: 'הוספה' }).click();
    await page.locator('[data-dish]', { hasText: dish }).first().waitFor();
  }
  await addSection('עיקריות', 'Mains', 'food');
  await quickAdd('עיקריות', 'שניצל', '62');
  await quickAdd('עיקריות', 'שניצל ילדים', '44');
  await addSection('שתייה', 'Drinks', 'drinks');
  await quickAdd('שתייה', 'לימונדה', '14');
  await shot(page, '03-menu');

  // English names and a description on the schnitzel (saved as typed)
  async function openDish(dish, tab = 'details') {
    await page.goto(e.webUrl + 'studio/#/menu');
    await page.getByRole('link', { name: `עריכת ${dish}`, exact: true }).click();
    const sheet = page.locator('dialog[data-sheet="dish"]');
    await sheet.waitFor();
    if (tab !== 'details') await sheet.getByRole('tab', { name: tab }).click();
    return sheet;
  }
  let sheet = await openDish('שניצל');
  await sheet.locator('[data-field="dish-desc-he"]').fill('שניצל עוף בפירורי לחם');
  await sheet.getByRole('button', { name: 'English' }).click();
  await sheet.locator('[data-field="dish-name-en"]').fill('Schnitzel');
  await sheet.locator('[data-field="dish-desc-en"]').fill('Chicken schnitzel in breadcrumbs');
  await sheet.locator('[data-field="dish-allergens-en"]').fill('Gluten, egg');
  await page.locator('[data-save="saved"]').waitFor();
  await shot(page, '04-dish-details');

  // a day part (the schedules are F05's screen; one is made through the API, as that lane's screen would): the
  // kids' schnitzel is served at lunch only
  owner.forVenue((await owner.api.select('venues', { select: 'id', slug: 'eq.schnitzel-sim' }))[0].id);
  const [lunch] = await owner.insert('schedules', [{ kind: 'day_part', name_he: 'צהריים', name_en: 'Lunch', windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: '11:00', to: '16:00' }] }]);
  await page.reload();
  sheet = await openDish('שניצל ילדים');
  await sheet.locator('[data-field="dish-daypart"]').selectOption({ label: 'צהריים' });
  await page.locator('[data-save="saved"]').waitFor();

  // ---- the add-on library: the sauce first, then the side whose fries opens it
  async function newGroup({ he, en, label, single, required = true, min, max, options }) {
    await page.goto(e.webUrl + 'studio/#/addons/new');
    const ed = page.locator('[data-screen="group-editor"]');
    await ed.waitFor();
    await ed.locator('[data-field="group-name-he"]').fill(he);
    if (label) await ed.locator('[data-field="group-label"]').fill(label);
    await ed.getByRole('button', { name: single ? 'בחירה אחת' : 'כמה בחירות' }).click();
    const req = ed.getByRole('switch', { name: 'חובה לבחור' });
    if ((await req.getAttribute('aria-checked') === 'true') !== required) await req.click();
    for (let i = 0; i < options.length; i++) {
      if (i > 0) await ed.locator('[data-action="add-option"]').click();
      const o = options[i], card = ed.locator('ol.opts > li').nth(i);
      await card.locator(`[data-field="option-name-${i}-he"]`).fill(o.he);
      if (o.price) await card.locator('input[inputmode="decimal"]').fill(o.price);
      if (o.default) await card.getByRole('switch', { name: `${o.he} מסומן מראש` }).click();
      if (o.opens) await card.locator(`[data-field="option-opens-${i}"]`).selectOption({ label: o.opens });
      if (o.maxQty) for (let q = 1; q < o.maxQty; q++) await card.getByRole('button', { name: `יותר: כמה פעמים לכל היותר: ${o.he}` }).click();
    }
    if (max) for (let n = 1; n < max; n++) await ed.getByRole('button', { name: 'יותר: לכל היותר' }).click();
    if (min) for (let n = 1; n < min; n++) await ed.getByRole('button', { name: 'יותר: לפחות' }).click();
    // English names
    await ed.getByRole('button', { name: 'English' }).click();
    await ed.locator('[data-field="group-name-en"]').fill(en);
    for (let i = 0; i < options.length; i++) await ed.locator(`[data-field="option-name-${i}-en"]`).fill(options[i].en);
    await ed.getByRole('button', { name: 'עברית' }).click();
    return ed;
  }
  let ed = await newGroup({ he: 'רוטב', en: 'Sauce', single: true, options: [{ he: 'קטשופ', en: 'Ketchup', default: true }, { he: 'איולי', en: 'Aioli', price: '3' }] });
  await shot(page, '05-group-sauce');
  await ed.locator('[data-action="save-group"]').click();
  await page.locator('[data-screen="group-editor"]:not([data-group="new"])').waitFor();
  ed = await newGroup({
    he: 'תוספת לבחירה', en: 'Side of choice', label: 'תוספות לעיקריות', single: false, max: 2,
    options: [{ he: 'צ׳יפס', en: 'Fries', opens: 'רוטב' }, { he: 'סלט', en: 'Salad', price: '4' }, { he: 'אורז', en: 'Rice' }],
  });
  assert.match(await ed.locator('[data-rule]').innerText(), /בוחרים 1 עד 2 · חובה/);
  await shot(page, '06-group-side');
  await ed.locator('[data-action="save-group"]').click();
  await page.locator('[data-screen="group-editor"]:not([data-group="new"])').waitFor();
  await page.goto(e.webUrl + 'studio/#/addons');
  await page.locator('[data-screen="addons"] [data-group]').nth(1).waitFor();
  const library = await page.locator('[data-screen="addons"]').innerText();
  assert.match(library, /פותחת את: רוטב/);
  assert.match(library, /נפתחת מתוך: צ׳יפס \(תוספת לבחירה\)/);
  await shot(page, '07-library');

  // ---- attach the side to the schnitzel, and to the kids' schnitzel with at most one
  async function attach(dish, group) {
    const s = await openDish(dish, 'תוספות');
    await s.locator('[data-action="attach"]').click();
    await s.getByRole('button', { name: `לחבר את ${group}` }).click();
    await s.locator('[data-dish-addons] .attached').first().waitFor();
    return s;
  }
  sheet = await attach('שניצל', 'תוספת לבחירה');
  const preview = sheet.locator('[data-guest-preview]');
  await preview.waitFor();
  const fromShown = await preview.locator('[data-from]').innerText();
  assert.equal(fromShown, 'החל מ־₪62');
  await shot(page, '08-schnitzel-addons');

  // every combination: up to two sides; fries opens the sauce (ketchup pre-selected, aioli +₪3). The totals the preview
  // shows are kept, and checked below against priceDish on the snapshot guests get (public_menu), not against numbers
  // written here.
  const shown = [];
  async function priceOf(s, dish, picks) {
    const p = s.locator('[data-guest-preview]');
    await p.locator('[data-action="preview-reset"]').click();
    for (const x of picks) {
      const name = { fries: 'צ׳יפס', salad: 'סלט +₪4', rice: 'אורז', aioli: 'איולי +₪3' }[x];
      const box = p.getByRole('checkbox', { name, exact: true });
      await ((await box.count()) ? box : p.getByRole('radio', { name, exact: true })).check();
    }
    const total = await p.locator('.gp-total').getAttribute('data-total');
    shown.push({ dish, picks, total, words: await p.locator('[data-total]').innerText() });
    return total;
  }
  const combos = ['fries', 'fries+aioli', 'salad', 'rice', 'fries+salad', 'fries+aioli+salad', 'fries+rice', 'fries+aioli+rice', 'salad+rice'];
  for (const combo of combos) assert.match(await priceOf(sheet, 'schnitzel', combo.split('+')), /^\d+$/, 'schnitzel: ' + combo);
  // nothing chosen: the guest is told what is missing; two sides chosen: the third is not offered
  await sheet.locator('[data-action="preview-reset"]').click();
  assert.match(await preview.locator('.gp-total').innerText(), /צריך לבחור לפחות 1 בתוספת לבחירה/);
  await priceOf(sheet, 'schnitzel', ['fries', 'aioli', 'salad']);
  assert.equal(await preview.getByRole('checkbox', { name: 'אורז', exact: true }).isDisabled(), true);
  await shot(page, '09-schnitzel-preview');

  sheet = await attach('שניצל ילדים', 'תוספת לבחירה');
  await sheet.getByRole('button', { name: 'הגבולות של תוספת לבחירה במנה הזאת' }).click();
  const limits = sheet.locator('[data-limits]');
  assert.deepEqual(await limits.locator('[data-field="dish-max"] option').allInnerTexts(), ['1', '2'], 'only the group\'s own maximum or tighter is offered');
  assert.deepEqual(await limits.locator('[data-field="dish-min"] option').allInnerTexts(), ['1', '2']);
  await limits.locator('[data-field="dish-max"]').selectOption('1');
  await limits.locator('[data-action="save-limits"]').click();
  await sheet.locator('[data-tighter]').waitFor();
  assert.match(await sheet.locator('[data-rule]').innerText(), /בוחרים 1 · חובה/);
  for (const combo of ['fries', 'fries+aioli', 'salad', 'rice']) assert.match(await priceOf(sheet, 'kids', combo.split('+')), /^\d+$/, 'kids: ' + combo);
  assert.equal(await sheet.locator('[data-guest-preview]').getByRole('radio', { name: 'אורז', exact: true }).count(), 1, 'a group of one is a choice of one');
  await shot(page, '10-kids-tighter');

  // ---- "goes well with": the schnitzel suggests the lemonade
  sheet = await openDish('שניצל', 'הולך טוב עם');
  await sheet.locator('[data-field="related-pick"]').selectOption({ label: 'לימונדה' });
  await sheet.locator('[data-action="add-related"]').click();
  await sheet.locator('[data-dish-related] [data-row]').first().waitFor();
  await shot(page, '11-goes-well-with');

  // ---- order, by keyboard and by dragging: the kids' schnitzel moves up and back down
  const dishOrder = async () => (await owner.api.select('dishes', { select: 'name_he,position', venue_id: `eq.${owner.venueId}`, order: 'position' })).map((d) => d.name_he).filter((n) => n.startsWith('שניצל'));
  await page.goto(e.webUrl + 'studio/#/menu');
  await page.locator('[data-tool="arrange"]').click();
  const up = page.getByRole('button', { name: 'להעלות את שניצל ילדים' });
  await up.focus();
  await page.keyboard.press('Enter');
  await page.getByText('שניצל ילדים עבר למקום 1').waitFor({ state: 'attached' });
  await page.locator('[data-save="saved"]').waitFor();
  assert.deepEqual(await dishOrder(), ['שניצל ילדים', 'שניצל']);
  await shot(page, '12-arrange');
  const grip = page.locator('li[data-row]', { hasText: 'שניצל ילדים' }).locator('.grip');
  const box = await grip.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 45, { steps: 4 });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 90, { steps: 4 });
  await page.mouse.up();
  await page.getByText('שניצל ילדים עבר למקום 2').waitFor({ state: 'attached' });
  await page.locator('[data-save="saved"]').waitFor();
  assert.deepEqual(await dishOrder(), ['שניצל', 'שניצל ילדים']);
  await page.locator('[data-tool="arrange"]').click();

  // ---- a second nesting level: never offered, and refused in plain words when the library changed elsewhere
  const groupId = async (en) => (await owner.api.select('addon_groups', { select: 'id', venue_id: `eq.${owner.venueId}`, name_en: `eq.${en}` }))[0].id;
  await page.goto(e.webUrl + 'studio/#/addons/' + (await groupId('Sauce')));
  ed = page.locator('[data-screen="group-editor"]');
  await ed.getByText('הקבוצה הזאת נפתחת מתוך בחירה').waitFor();
  assert.equal(await ed.locator('[data-field^="option-opens-"]').count(), 0, 'the sauce, opened by fries, offers no "opens a group"');
  await shot(page, '13-sauce-nested');
  await page.goto(e.webUrl + 'studio/#/addons/' + (await groupId('Side of choice')));
  const sideOpens = await page.locator('[data-field="option-opens-1"] option').allInnerTexts();
  assert.deepEqual(sideOpens, ['לא פותחת', 'רוטב'], 'the side may open the sauce, never itself');
  ed = await newGroup({ he: 'תוספות לבורגר', en: 'Extras', single: false, required: false, max: 2, options: [{ he: 'גבינה', en: 'Cheese', price: '4', maxQty: 2 }] });
  await ed.locator('[data-action="save-group"]').click();
  await page.locator('[data-screen="group-editor"]:not([data-group="new"])').waitFor();
  const extrasId = await page.locator('[data-screen="group-editor"]').getAttribute('data-group');
  assert.deepEqual(await page.locator('[data-field="option-opens-0"] option').allInnerTexts(), ['לא פותחת', 'רוטב'], 'not the side: its own fries opens a group');
  // meanwhile, on another device, the same owner makes a choice that opens Extras
  const [combo] = await owner.insert('addon_groups', [{ name_he: 'קומבו', name_en: 'Combo', selection: 'single', min_units: 0, max_units: 1 }]);
  await owner.insert('addon_options', [{ group_id: combo.id, name_he: 'עם תוספות', name_en: 'Loaded', opens_group_id: extrasId }]);
  // this screen still offers the sauce; the database refuses the second level and the app says why
  await page.locator('[data-field="option-opens-0"]').selectOption({ label: 'רוטב' });
  await page.locator('[data-action="save-group"]').click();
  await page.getByText('רק רמה אחת: קבוצה שנפתחת מתוך בחירה לא יכולה לפתוח קבוצה נוספת.', { exact: false }).waitFor();
  await page.getByText('הקבוצה הזאת נפתחת מתוך בחירה').waitFor();
  assert.equal(await page.locator('[data-field^="option-opens-"]').count(), 0, 'shown as stored now: Extras opens from Combo');
  await shot(page, '14-second-level-refused');
  // the two test groups go away again (Extras through the app, Combo through the API)
  await page.goto(e.webUrl + 'studio/#/addons/' + extrasId);
  // the refused form still holds its changes: a typed address asks before they are dropped
  await page.getByRole('dialog', { name: 'לצאת בלי לשמור?' }).getByRole('button', { name: 'לצאת בלי לשמור' }).click();
  await page.locator('[data-action="delete-group"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'מחיקה' }).click();
  await page.locator('[data-screen="addons"]').waitFor();
  await owner.api.remove('addon_groups', { id: `eq.${combo.id}` });

  // ---- publish: the first publish waits for Halom
  await page.goto(e.webUrl + 'studio/#/publish');
  const pub = page.locator('[data-screen="publish"]');
  await pub.locator('[data-action="publish"]:not([disabled])').waitFor();
  assert.equal(await pub.locator('[data-issues]').count(), 0);
  await shot(page, '15-before-publish');
  await pub.locator('[data-action="publish"]').click();
  await page.locator('[data-standing-card="pending"]').waitFor();
  assert.match(await page.locator('[data-standing-card]').innerText(), /מחכה לאישור של חלום/);
  await shot(page, '16-waiting-for-approval');
  const slug = 'schnitzel-sim';
  assert.equal((await asAnon(e.stack).rpc('public_menu', { p_slug: slug })).state, 'unavailable');

  // ---- Halom approves; the owner sees it live, and public_menu is exactly what was built
  const halom = await HalomBot.firstAdmin(e.stack, e.stack, { email: 'halom-v2@sim.local' });
  const venueId = owner.venueId;
  const ok = await halom.approve(venueId, 'e2e: the v2 editor scenario');
  assert.equal(ok.ok, true, JSON.stringify(ok));
  await pub.locator('[data-action="check-approval"]').click();
  await page.locator('[data-standing-card="live"]').waitFor();
  await shot(page, '17-live');

  const got = await asAnon(e.stack).rpc('public_menu', { p_slug: slug });
  assert.equal(got.state, 'ok');
  const s = got.snapshot;
  const t = (x) => [x.name.he, x.name.en];
  assert.deepEqual(s.sections.map((x) => [...t(x), x.kind, x.dishes.map((d) => d.name.he)]), [['עיקריות', 'Mains', 'food', ['שניצל', 'שניצל ילדים']], ['שתייה', 'Drinks', 'drinks', ['לימונדה']]]);
  const [mains, drinks] = s.sections;
  const [sch, kid] = mains.dishes, lemonade = drinks.dishes[0];
  assert.deepEqual([t(sch), sch.price.amount, sch.desc, sch.allergens], [['שניצל', 'Schnitzel'], 6200, { he: 'שניצל עוף בפירורי לחם', en: 'Chicken schnitzel in breadcrumbs' }, { he: '', en: 'Gluten, egg' }]);
  assert.deepEqual([kid.name.he, kid.price.amount, lemonade.name.he, lemonade.price.amount], ['שניצל ילדים', 4400, 'לימונדה', 1400]);
  const byName = new Map(s.addonGroups.map((g) => [g.name.en, g]));
  assert.deepEqual([...byName.keys()].sort(), ['Sauce', 'Side of choice'], 'only the groups the menu reaches: not the deleted test groups');
  const side = byName.get('Side of choice'), sauce = byName.get('Sauce');
  assert.deepEqual([side.selection, side.min, side.max], ['multiple', 1, 2]);
  assert.deepEqual(side.options.map((o) => [...t(o), o.price, o.maxQty, o.default, o.opensGroupId]),
    [['צ׳יפס', 'Fries', 0, 1, false, sauce.id], ['סלט', 'Salad', 400, 1, false, null], ['אורז', 'Rice', 0, 1, false, null]]);
  assert.deepEqual([sauce.selection, sauce.min, sauce.max], ['single', 1, 1]);
  assert.deepEqual(sauce.options.map((o) => [...t(o), o.price, o.default, o.opensGroupId]), [['קטשופ', 'Ketchup', 0, true, null], ['איולי', 'Aioli', 300, false, null]]);
  assert.deepEqual(sch.addons, [{ groupId: side.id, min: 1, max: 2 }]);
  assert.deepEqual(kid.addons, [{ groupId: side.id, min: 1, max: 1 }]);
  assert.deepEqual(sch.related, [lemonade.id]);
  assert.deepEqual([kid.related, lemonade.addons], [[], []]);
  assert.deepEqual([sch.scheduleId, kid.scheduleId, s.schedules.map((x) => [x.id, x.name.en, x.windows[0].from])], [null, lunch.id, [[lunch.id, 'Lunch', '11:00']]]);
  // every total the owner's preview showed is what priceDish gives for the same choices on what guests get
  const ctx = pricingContext(s);
  const opt = (g, en) => g.options.find((o) => o.name.en === en).id;
  const selectionOf = (picks) => ({
    quantity: 1,
    groups: [{
      groupId: side.id,
      options: picks.filter((p) => p !== 'aioli').map((p) => {
        const optionId = opt(side, { fries: 'Fries', salad: 'Salad', rice: 'Rice' }[p]);
        return p !== 'fries' ? { optionId } : { optionId, nested: [{ groupId: sauce.id, options: [{ optionId: opt(sauce, picks.includes('aioli') ? 'Aioli' : 'Ketchup') }] }] };
      }),
    }],
  });
  assert.equal(shown.length, 14);
  for (const x of shown) {
    const r = priceDish(x.dish === 'kids' ? kid : sch, selectionOf(x.picks), ctx);
    assert.equal(r.ok, true, x.dish + ' ' + x.picks.join('+'));
    assert.equal(x.total, String(r.total), x.dish + ' ' + x.picks.join('+') + ': the preview showed ' + x.total);
    assert.ok(x.words.includes(nis(r.total)), x.dish + ' ' + x.picks.join('+') + ': the preview said ' + x.words);
  }
  assert.equal(fromShown, 'החל מ־' + nis(fromPrice(sch, ctx).amount));
  // the owner's draft preview and what guests get are the same menu
  const draft = await owner.preview();
  const strip = (x) => ({ ...x, revision: 0, publishedAt: '' });
  assert.deepEqual(strip(s), strip(draft.snapshot));
  assert.deepEqual(problems(page), []);

  // ---- versions: a change published as version 2, then version 1 put back
  sheet = await openDish('לימונדה');
  await sheet.getByLabel('מחיר', { exact: true }).fill('15');
  await page.locator('[data-save="saved"]').waitFor();
  await page.goto(e.webUrl + 'studio/#/publish');
  await pub.locator('[data-changes]', { hasText: 'מנה אחת עודכנה' }).waitFor();
  await pub.locator('[data-action="publish"]').click();
  await page.locator('[data-revision="2"] .badge-ok').waitFor();
  let menuNow = await asAnon(e.stack).rpc('public_menu', { p_slug: slug });
  assert.deepEqual([menuNow.snapshot.revision, menuNow.snapshot.sections[1].dishes[0].price.amount], [2, 1500]);
  await pub.locator('[data-restore="1"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'להחזיר את הגרסה הזאת' }).click();
  await page.locator('[data-revision="1"] .badge-ok').waitFor();
  menuNow = await asAnon(e.stack).rpc('public_menu', { p_slug: slug });
  assert.deepEqual([menuNow.snapshot.revision, menuNow.snapshot.sections[1].dishes[0].price.amount], [1, 1400]);
  await pub.locator('[data-changes]', { hasText: 'מנה אחת עודכנה' }).waitFor();    // the draft keeps the edit, unpublished
  await shot(page, '18-versions');

  // ---- a second place, and the switch between the two
  await page.locator('[data-action="account"]').click();
  await page.locator('[data-menu="add-venue"]').click();
  await page.locator('#place-name').fill('Bistro Two Sim');
  await page.locator('[data-avail="free"]').waitFor();
  await page.getByRole('button', { name: 'יצירת המקום' }).click();
  await page.getByRole('heading', { name: 'התפריט עוד ריק' }).waitFor();
  await page.locator('[data-action="switch-venue"]').click();
  await shot(page, '19-switch-place');
  await page.locator('dialog[data-sheet="account"] [data-venue="schnitzel-sim"]').click();
  await page.locator('[data-screen="home"]').waitFor();                        // a place that has published opens on Home
  assert.match(await page.locator('.top-biz').innerText(), /Schnitzel Sim/);

  // the same app in English, left to right
  await page.locator('[data-action="account"]').click();
  await page.locator('[data-menu="language"]').click();
  await page.keyboard.press('Escape');
  await page.goto(e.webUrl + 'studio/#/menu');
  assert.equal(await page.evaluate(() => document.documentElement.dir), 'ltr');
  await page.getByRole('link', { name: 'Edit Schnitzel', exact: true }).click();
  await page.getByRole('tab', { name: /Add-ons/ }).click();
  const en = page.locator('[data-guest-preview]');
  assert.equal(await en.locator('[data-from]').innerText(), 'from ₪62');
  await en.getByRole('checkbox', { name: 'Fries', exact: true }).check();
  await en.getByRole('radio', { name: 'Aioli +₪3' }).check();
  assert.equal(await en.locator('.gp-total').getAttribute('data-total'), '6500');
  await shot(page, '20-english-addons');
  assert.deepEqual(problems(page), []);
});
