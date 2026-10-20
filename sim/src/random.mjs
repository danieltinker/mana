// Seeded-random mode: N guests over M minutes, each with its own address, language, way in and taste, browsing,
// choosing add-ons, adding to "my table", accepting or dismissing what is suggested. For load and for live-looking
// dashboards. The same seed against the same menu at the same moment does the same things (replayable); event ids
// stay random, so a second run adds new traffic instead of being swallowed by the dedupe.
//
// Compressed (default): every guest's events are spread over the last M minutes (backdated, at most 48 h, never in
// the future) and sent as fast as the stack takes them. Realtime: guests arrive over the next M minutes and act at
// wall-clock pace, for watching a dashboard fill.
import { GuestBot } from './guest.mjs';
import { randomSelection } from './choices.mjs';
import { guestClock } from './clock.mjs';
import { Ledger } from './ledger.mjs';
import { rng } from './rng.mjs';

export const DEFAULTS = { pAdd: 0.6, pAccept: 0.35, pDismiss: 0.4, pCheckout: 0.5, pFilter: 0.15, pEnglish: 0.3, pLink: 0.35, maxViews: 4, thinkMs: [4000, 40000] };

function respond(bot, s, r, o) {
  if (!s) return null;
  const x = r();
  if (x < o.pAccept) return bot.accept();
  if (x < o.pAccept + o.pDismiss) return bot.dismiss();
  return null; // the guest ignores it: no event, it goes away with the next screen
}

/** One guest's visit, driven by `r`. Returns the bot (its ledger, actions, violations). */
export async function randomVisit(bot, slug, r, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const think = () => bot.clock.advance(r.between(o.thinkMs[0], o.thinkMs[1]));
  await bot.clock.advance(0); // realtime: wait for this guest's arrival
  const res = await bot.open(slug);
  if (res.state !== 'ok') return bot;
  const views = r.between(1, o.maxViews);
  for (let i = 0; i < views; i++) {
    await think();
    const list = bot.browsable();
    if (!list.length) break;
    const dish = r.pick(list);
    // the guest's own choices first (when the dish can be ordered now), then the sheet shows at most one suggestion
    const sel = bot.canChoose(dish.id) ? randomSelection(dish, bot.ctx, r) : null;
    respond(bot, bot.view(dish.id, sel ? { selection: sel } : {}), r, o);
    if (sel && r.chance(o.pAdd)) {
      await think();
      const added = bot.add({ quantity: r.chance(0.15) ? 2 : 1 });
      if (added.ok) respond(bot, added.suggestion, r, o);
    }
  }
  if (bot.basket.length && r.chance(o.pCheckout)) {
    await think();
    respond(bot, bot.checkout(), r, o);
  }
  await bot.flush();
  return bot;
}

/**
 * @param target the stack
 * @param o.slug, o.guests (N), o.minutes (M), o.seed, o.realtime
 * @returns { ledger, bots, violations, results }
 */
export async function runRandom(target, { slug, guests = 20, minutes = 30, seed = 1, realtime = false, endAt = Date.now(), ...opts } = {}) {
  if (minutes <= 0 || minutes > 47 * 60) throw new Error('minutes: 1 to 2820 (events older than 48 hours are refused)');
  const o = { ...DEFAULTS, ...opts };
  const r = rng(seed);
  const start = realtime ? Date.now() : endAt - minutes * 60000;
  const span = minutes * 60000 * (realtime ? 1 : 0.85);
  const plans = Array.from({ length: guests }, (_, i) => ({
    i,
    arrive: start + Math.floor(r() * span),
    lang: r.chance(o.pEnglish) ? 'en' : 'he',
    src: r.chance(o.pLink) ? 'link' : 'qr',
    filter: r.chance(o.pFilter) ? r.pick(['vegan', 'vegetarian']) : null,
    r: r.fork('guest-' + i),
  }));
  const one = (p) => randomVisit(new GuestBot(target, {
    ip: `10.${77 + Math.floor(p.i / 65025) % 100}.${Math.floor(p.i / 255) % 255}.${(p.i % 255) + 1}`,
    lang: p.lang, src: p.src, filter: p.filter, clock: guestClock(p.arrive, { realtime }),
  }), slug, p.r, o);
  const bots = [];
  if (realtime) bots.push(...(await Promise.all(plans.map(one))));
  else for (const p of plans) bots.push(await one(p));
  const ledger = new Ledger();
  const results = { accepted: 0, duplicates: 0, capped: 0, rejected: 0, uncertain: 0 };
  for (const b of bots) {
    ledger.merge(b.ledger);
    results.accepted += b.results.accepted; results.duplicates += b.results.duplicates; results.capped += b.results.capped;
    results.rejected += b.results.rejected.length; results.uncertain += b.uncertain ? 1 : 0;
  }
  return { ledger, bots, violations: bots.flatMap((b) => b.violations), results };
}
