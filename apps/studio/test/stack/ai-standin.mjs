// A stand-in for the edge function `menus-ai` (reference: ../../../../functions/menus-ai/index.ts, contract: BACKEND.md "v2").
// Same request checks in the same order, the same event shapes, the caller's allowance taken through the real
// `ai_take` RPC with the caller's own token. What differs: the "reading" is a script, sent line by line with pauses.
//
// Switches (POST /__test/config  { ai: { … } }, merged into the defaults below):
//   configured   false → every action but `status` answers not_configured
//   delayMs      pause between two lines of a scan
//   scripts      names from SCRIPTS, one per scan_menu call, in order; when the list is used up: `script`
//   truncated    true → the scan stops after `truncateAfter` items and ends with truncated:true
//   error        a code → a scan answers {"t":"error","code"} at once (as the function does when nothing was read)
//   errorAfter   with `error`: send that many items first, then cut the stream without a "done" line (a dropped connection)
//   describeError  a code → describe_dish answers { ok:false, code }
//   forceLimit   true → limit_ai without touching the database counter
// GET /__test/ai → every call seen so far (sizes, languages, business, how many stock labels came with it).

const NL = '\n';
const MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SCAN_B64 = 3_600_000, MAX_DISH_B64 = 1_200_000;

const I = (he, en, price, extra = {}) => ({ t: 'item', he, en, dhe: '', den: '', price_minor: price, note_he: '', note_en: '', tags: [], stock: null, ...extra });
export const SCRIPTS = {
  // a Hebrew café menu: three sections, twelve dishes; the English side is "translated by the model"
  he: { lang: 'he', lines: [
    { t: 'cat', he: 'ראשונות', en: 'Starters', kind: 'food' },
    I('חומוס גרגרים', 'Hummus with chickpeas', 3200, { dhe: 'טחינה, שמן זית ופיתה חמה', den: 'Tahini, olive oil and warm pita', tags: ['vegan'], stock: 'hummus' }),
    I('סלט קצוץ', 'Chopped salad', 3800, { dhe: 'עגבנייה, מלפפון, בצל סגול ולימון', den: 'Tomato, cucumber, red onion and lemon', tags: ['vegan', 'gf'], stock: 'salad' }),
    I('מרק היום', 'Soup of the day', null, { note_he: 'שאלו את המלצר', note_en: 'Ask your waiter' }),
    { t: 'cat', he: 'עיקריות', en: 'Mains', kind: 'food' },
    I('שקשוקה', 'Shakshuka', 5400, { dhe: 'ביצים ברוטב עגבניות חריף, עם לחם', den: 'Eggs in a spicy tomato sauce, with bread', tags: ['vegetarian', 'spicy'], stock: 'shakshuka' }),
    I('המבורגר הבית', 'House burger', 7200, { dhe: '200 גרם, חסה, עגבנייה וצ׳יפס', den: '200 g, lettuce, tomato and fries', stock: 'burger' }),
    I('פיצה מרגריטה', 'Pizza Margherita', 5800, { dhe: 'רוטב עגבניות, מוצרלה ובזיליקום', den: 'Tomato sauce, mozzarella and basil', tags: ['vegetarian'] }),      // no hint: the app's own matcher finds "pizza"
    I('פפרדלה פטריות', 'Mushroom pappardelle', 6400, { stock: 'pasta' }),
    I('דג היום', 'Fish of the day', 9800, { note_he: 'לפי משקל', note_en: 'By weight', stock: 'not-in-the-library' }),                            // an id the app does not have
    I('שניצל', 'Schnitzel', 6200),
    { t: 'cat', he: 'שתייה', en: 'Drinks', kind: 'drinks' },
    I('מיץ תפוזים סחוט', 'Fresh orange juice', 1800, { stock: 'orange-juice' }),
    I('לימונדה', 'Lemonade', 1600),
    I('קפה הפוך', 'Cappuccino', 1400, { note_he: 'קטן 14 / גדול 17', note_en: 'Small 14 / Large 17' }),
  ] },
  // a second page: one section that already exists on page one (its dishes join it, one of them is a repeat) and a new one
  he2: { lang: 'he', lines: [
    { t: 'cat', he: 'עיקריות', en: 'Mains', kind: 'food' },
    I('שקשוקה', 'Shakshuka', 5400, { stock: 'shakshuka' }),
    I('סלט קיסר', 'Caesar salad', 4800, { stock: 'salad' }),
    { t: 'cat', he: 'קינוחים', en: 'Desserts', kind: 'dessert' },
    I('עוגת גבינה', 'Cheesecake', 3600, { stock: 'cheesecake' }),
    I('מלבי', 'Malabi', 2800, { tags: ['gf'] }),
  ] },
  // a menu printed in English: the Hebrew side is the translated one
  en: { lang: 'en', lines: [
    { t: 'cat', he: 'פיצות', en: 'Pizzas', kind: 'food' },
    I('מרגריטה', 'Margherita', 5200, { den: 'Tomato, mozzarella, basil', dhe: 'עגבניות, מוצרלה, בזיליקום', stock: 'pizza' }),
    I('ביאנקה', 'Bianca', 5600),
    { t: 'cat', he: 'יינות', en: 'Wine', kind: 'wine' },
    I('מרלו', 'Merlot', 3800, { note_he: 'כוס 38 / בקבוק 140', note_en: 'Glass 38 / Bottle 140' }),
  ] },
};

/** Width and height of a JPEG from its first bytes (start-of-frame marker); null when it is not a JPEG we can read. */
export function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

function cleanImage(v, maxB64) {
  const o = v && typeof v === 'object' ? v : {};
  const media_type = String(o.media_type ?? ''), data = typeof o.data === 'string' ? o.data : '';
  if (!MEDIA.has(media_type) || data.length < 200) return 'bad_image';
  if (data.length > maxB64) return 'too_big';
  if (!/^[A-Za-z0-9+/]+=*$/.test(data.slice(0, 400)) || !/^[A-Za-z0-9+/]*=*$/.test(data.slice(-400))) return 'bad_image';
  return { media_type, data };
}
const cleanLangs = (v) => { const a = Array.isArray(v) ? v.filter((x) => x === 'he' || x === 'en') : []; return a.length ? [...new Set(a)] : ['he', 'en']; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createAiStandIn({ restPort, anonKey, cors, readBody, log = () => {} }) {
  const defaults = () => ({ configured: true, delayMs: 70, script: 'he', scripts: [], truncated: false, truncateAfter: 5, error: '', errorAfter: 0, describeError: '', forceLimit: false,
    custom: null, gate: false, released: 0 });       // custom: a script given whole ({ lang, lines }); gate: line n of the stream waits until released >= n (filming frame by frame)
  const state = defaults();
  const calls = [];
  const json = (res, body, status = 200) => { const b = Buffer.from(JSON.stringify(body)); res.writeHead(status, { ...cors, 'content-type': 'application/json', 'content-length': b.length }); res.end(b); };
  const ndHead = { ...cors, 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' };

  async function takeAllowance(req, business, kind) {
    if (state.forceLimit) return { ok: false, code: 'limit_ai' };
    try {
      const r = await fetch(`http://127.0.0.1:${restPort}/rpc/ai_take`, { method: 'POST',
        headers: { apikey: req.headers.apikey || anonKey, authorization: req.headers.authorization || '', 'content-type': 'application/json' },
        body: JSON.stringify({ p_business: business, p_kind: kind }) });
      if (!r.ok) return { ok: false, code: r.status === 401 || r.status === 403 ? 'not_member' : 'failed' };
      const d = await r.json();
      return d && d.ok ? { ok: true } : { ok: false, code: String(d?.code ?? 'failed') };
    } catch (e) { log('ai_take', e); return { ok: false, code: 'failed' }; }
  }

  async function handle(req, res) {
    let raw;
    try { raw = await readBody(req, 6_000_000); } catch { return json(res, { ok: false, code: 'too_big' }); }
    if (raw.length > 5_200_000) return json(res, { ok: false, code: 'too_big' });
    let body; try { body = JSON.parse(raw.toString('utf8')); } catch { return json(res, { ok: false, code: 'bad_request' }); }
    const action = String(body?.action ?? '');
    if (action === 'status') { calls.push({ action }); return json(res, { ok: true, configured: !!state.configured }); }
    if (action !== 'scan_menu' && action !== 'describe_dish') return json(res, { ok: false, code: 'bad_request' });
    const fail = (code) => { calls.push({ action, failed: code }); if (action === 'scan_menu') { res.writeHead(200, ndHead); return res.end(JSON.stringify({ t: 'error', code }) + NL); } return json(res, { ok: false, code }); };
    const business = String(body.business_id ?? '');
    if (!UUID.test(business)) return fail('bad_request');
    const image = cleanImage(body.image, action === 'scan_menu' ? MAX_SCAN_B64 : MAX_DISH_B64);
    if (typeof image === 'string') return fail(image);
    if (!state.configured) return fail('not_configured');
    const allowed = await takeAllowance(req, business, action);
    if (!allowed.ok) return fail(allowed.code || 'failed');
    const langs = cleanLangs(body.langs);
    const stock = Array.isArray(body.stock) ? body.stock.filter((s) => s && /^[a-z0-9][a-z0-9-]{0,39}$/.test(String(s.id))) : [];
    const stockIds = new Set(stock.map((s) => s.id));
    const bytes = Buffer.from(image.data, 'base64');
    const seen = { action, business, media_type: image.media_type, b64: image.data.length, bytes: bytes.length, size: image.media_type === 'image/jpeg' ? jpegSize(bytes) : null, langs, stock: stock.length, name: typeof body.name === 'string' ? body.name : '' };
    calls.push(seen);

    if (action === 'describe_dish') {
      if (state.describeError) return json(res, { ok: false, code: state.describeError });
      await sleep(Math.min(400, state.delayMs * 4));
      const name = String(body.name || '').trim();
      const he = (s) => (langs.includes('he') ? s : ''), en = (s) => (langs.includes('en') ? s : '');
      const isHe = /[֐-׿]/.test(name);
      return json(res, { ok: true, suggestion: {
        name: { he: he(name && isHe ? name : 'שקשוקה ירוקה'), en: en(name && !isHe ? name : 'Green shakshuka') },
        desc: { he: he('ביצים על תרד ועשבי תיבול, עם פרוסת לחם'), en: en('Eggs on spinach and herbs, with a slice of bread') },
        kind: 'food', stock: stockIds.has('shakshuka') ? 'shakshuka' : null } });
    }

    if (state.error && !state.errorAfter) { seen.failed = state.error; res.writeHead(200, ndHead); return res.end(JSON.stringify({ t: 'error', code: state.error }) + NL); }
    const name = state.scripts.length ? state.scripts.shift() : state.script;
    const script = state.custom || SCRIPTS[name] || SCRIPTS.he;
    seen.script = state.custom ? 'custom' : name;
    res.writeHead(200, ndHead);
    let gone = false; res.on('close', () => { gone = true; });
    let sent = 0;
    const send = async (o) => {
      sent++;
      while (state.gate && state.released < sent && !gone) await sleep(8);
      if (gone) return;
      res.write(JSON.stringify(o) + NL);
      if (!state.gate) await sleep(state.delayMs);
    };
    await send({ t: 'start' });
    await send({ t: 'lang', v: script.lang });
    let cats = 0, items = 0, truncated = false;
    for (const line of script.lines) {
      if (gone) break;
      if (line.t === 'cat') { cats++; await send({ t: 'cat', he: langs.includes('he') ? line.he : '', en: langs.includes('en') ? line.en : '', kind: line.kind }); continue; }
      const only = (he, en) => [langs.includes('he') ? he : '', langs.includes('en') ? en : ''];
      const [nhe, nen] = only(line.he, line.en), [dhe, den] = only(line.dhe, line.den), [qhe, qen] = only(line.note_he, line.note_en);
      items++;
      await send({ ...line, he: nhe, en: nen, dhe, den, note_he: qhe, note_en: qen, stock: line.stock && stockIds.has(line.stock) ? line.stock : null });
      if (state.error && state.errorAfter && items >= state.errorAfter) { seen.cut = true; return res.destroy(); }       // the connection drops mid-way
      if (state.truncated && items >= state.truncateAfter) { truncated = true; break; }
    }
    await send({ t: 'done', cats, items, lang: script.lang, truncated, usage: { in: 1500, out: 60 * items } });
    res.end();
  }
  return { handle, state, calls, configure: (patch) => Object.assign(state, patch), reset: () => { Object.assign(state, defaults()); calls.length = 0; } };
}
