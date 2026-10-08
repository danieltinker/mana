// Pure logic for the Mana back office: no DOM, no network. Everything here is unit-tested (test/unit.test.mjs).
// Input is the JSON that ops_overview() returns (db/0001_core.sql); nothing in it is trusted to be well-formed.

export const PRODUCT = { name: 'Mana', nameHe: 'מנה', by: 'Halom' };
export const TZ = 'Asia/Jerusalem';
export const DAY = 86400000;
export const STALL_DAYS = 3;
export const TRIAL_SOON_DAYS = 7;

export const LEAD_STATUSES = ['new', 'qualified', 'scoped', 'agreed', 'production', 'review', 'deployed', 'support', 'lost', 'spam'];
export const BUSINESS_KINDS = ['restaurant', 'cafe', 'bar', 'bakery', 'food_truck', 'hotel', 'other'];

// Stage ladder, in order of progress. "stalled" is a flag on top of a pre-publish stage, shown as its own stage.
export const STAGES = [
  { id: 'created', label: 'Created', hint: 'Business exists, menu is empty' },
  { id: 'menu', label: 'Menu started', hint: 'Categories or items entered' },
  { id: 'review', label: 'Pictures in review', hint: 'Pictures uploaded, not all approved yet' },
  { id: 'approved', label: 'Pictures approved', hint: 'Approved pictures, not published yet' },
  { id: 'published', label: 'Published, offline', hint: 'Published at least once but diners cannot open it now' },
  { id: 'live', label: 'Live', hint: 'Diners can open the menu now' },
];
export const STAGE_RANK = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));
export const stageLabel = (id) => (id === 'stalled' ? 'Stalled' : (STAGES.find((s) => s.id === id) || {}).label || id);

// ---------------------------------------------------------------- small safe helpers
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; };
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
export const time = (v) => { if (!v) return null; const t = Date.parse(v); return Number.isFinite(t) ? t : null; };

// Characters that change how surrounding text is laid out or that are invisible controls. We remove them from
// anything a stranger typed (lead forms are public) and tell the reader that we did.
const HIDDEN_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‪-‮⁦-⁩؜﻿]/g;
export function clean(v) { return str(v).replace(HIDDEN_RE, ''); }
export function hadHidden(v) { return str(v).search(HIDDEN_RE) !== -1; }

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export const validSlug = (s) => typeof s === 'string' && SLUG_RE.test(s);

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
export function emailLink(v) {
  const s = clean(v).trim();
  if (s.length > 200 || !EMAIL_RE.test(s)) return null;
  return 'mailto:' + encodeURIComponent(s).replace(/%40/g, '@');
}

// Phone → { tel, wa } built from digits only. Israeli local numbers (0…) get the 972 prefix for WhatsApp.
export function phoneLinks(v) {
  const s = clean(v).trim();
  if (!s || /[A-Za-z@]/.test(s)) return null;                 // "call me at…" or an e-mail is not a phone number
  let d = s.replace(/\D/g, '');
  const plus = s.startsWith('+');
  if (d.startsWith('00')) d = d.slice(2);
  else if (!plus && d.startsWith('0') && (d.length === 9 || d.length === 10)) d = '972' + d.slice(1);
  else if (!plus && !d.startsWith('972')) {
    if (d.length < 7 || d.length > 15) return null;
    return { tel: 'tel:' + d, wa: null, digits: d };            // unknown country: dialable, but no WhatsApp guess
  }
  if (d.length < 8 || d.length > 15) return null;
  return { tel: 'tel:+' + d, wa: 'https://wa.me/' + d, digits: d };
}

// A lead's contact is either an e-mail or a phone number (the database accepts both).
export function contactLinks(v) {
  const mail = emailLink(v);
  if (mail) return { kind: 'email', mail };
  const p = phoneLinks(v);
  if (p) return { kind: 'phone', ...p };
  return { kind: 'text' };
}

export function menuLinks(slug, cfg) {
  if (!validSlug(slug)) return null;
  let base = 'https://halom.io/m/';
  try { const u = new URL(str(cfg && cfg.shortBase)); if (u.protocol === 'https:' || u.protocol === 'http:') base = u.href; } catch { /* keep default */ }
  if (!base.endsWith('/')) base += '/';
  const vp = str(cfg && cfg.viewPath) || '../view/';
  const view = /^(\.\.?\/)[A-Za-z0-9._\-/]*$/.test(vp) ? vp : '../view/';
  return { short: base + slug, viewer: view + '?m=' + slug, shortLabel: base.replace(/^https?:\/\//, '') + slug };
}

// ---------------------------------------------------------------- dates (the business day is Israel's)
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export const dayKey = (ms) => dayFmt.format(new Date(ms));                       // 'YYYY-MM-DD' in Israel
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const validDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'))
  && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

// The last second of a calendar day in Israel, as a UTC ISO string (what "until 5 Nov" means for a plan).
export function endOfDayIsrael(key) {
  if (!validDay(key)) return null;
  const [y, m, d] = key.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 23, 59, 59);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(guess));
  const p = Object.fromEntries(parts.map((x) => [x.type, Number(x.value)]));
  const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return new Date(guess - (shown - guess)).toISOString();
}

const dFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const dShort = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' });
const dtFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const tFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export const fmtDate = (ms) => (ms == null ? '—' : dFmt.format(new Date(ms)));
export const fmtDateShort = (ms) => (ms == null ? '—' : dShort.format(new Date(ms)));
export const fmtDateTime = (ms) => (ms == null ? '—' : dtFmt.format(new Date(ms)));
export const fmtClock = (ms) => (ms == null ? '—' : tFmt.format(new Date(ms)));
export const fmtDay = (key, short) => (validDay(key) ? (short ? dShort : dFmt).format(new Date(key + 'T12:00:00Z')) : '—');
export const fmtInt = (n) => new Intl.NumberFormat('en-US').format(num(n));

export function ago(ms, now) {
  if (ms == null) return 'never';
  const s = Math.max(0, now - ms) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 36 * 3600) return Math.round(s / 3600) + ' h ago';
  const d = Math.round(s / 86400);
  return d + ' days ago';
}
// calendar days from today until a moment: 0 = today, negative = passed
export const daysUntil = (ms, now) => (ms == null ? null
  : Math.round((Date.parse(dayKey(ms) + 'T00:00:00Z') - Date.parse(dayKey(now) + 'T00:00:00Z')) / DAY));   // calendar days in Israel

// ---------------------------------------------------------------- one business row → everything the UI shows
export function deriveBusiness(raw, now) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const a = b.assets && typeof b.assets === 'object' ? b.assets : {};
  const pics = {
    approved: num(a.approved),
    review: num(a.ready_for_review),
    working: num(a.uploaded) + num(a.processing),
    failed: num(a.failed),
    rejected: num(a.rejected),
  };
  pics.waiting = pics.review + pics.working;
  const created = time(b.created_at);
  const firstPub = time(b.first_published_at);
  const lastPub = time(b.last_published_at);
  const planState = ['pending', 'trialing', 'active', 'expired', 'suspended'].includes(b.plan_state) ? b.plan_state : 'pending';
  const plan = ['trial', 'pilot', 'paid'].includes(b.plan) ? b.plan : 'trial';
  const items = num(b.items);
  const categories = num(b.categories);
  const published = firstPub != null;
  const liveNow = b.live === true && (planState === 'trialing' || planState === 'active');
  const activity = Math.max(...[time(b.last_activity_at), time(b.last_asset_at), lastPub, created].filter((x) => x != null), 0) || null;

  let base;
  if (liveNow) base = 'live';
  else if (published) base = 'published';
  else if (pics.waiting > 0) base = 'review';
  else if (pics.approved > 0) base = 'approved';
  else if (items > 0 || categories > 0) base = 'menu';
  else base = 'created';
  const idleDays = activity == null ? null : Math.floor((now - activity) / DAY);
  const stalled = !published && idleDays != null && idleDays >= STALL_DAYS;

  const trialEnds = time(b.trial_ends_at);
  const periodEnd = time(b.current_period_end);
  const endsAt = planState === 'trialing' ? trialEnds : planState === 'active' ? periodEnd
    : planState === 'expired' ? (b.plan_status === 'trialing' ? trialEnds : periodEnd) : null;
  const daysLeft = (planState === 'trialing' || planState === 'active') ? daysUntil(endsAt, now) : null;
  const trialSoon = planState === 'trialing' && daysLeft != null && daysLeft <= TRIAL_SOON_DAYS;

  let offlineWhy = null;
  if (published && !liveNow) {
    offlineWhy = planState === 'expired' ? 'plan expired' : planState === 'suspended' ? 'plan suspended' : b.live !== true ? 'unpublished by owner' : 'plan not active';
  }

  const views7 = num(b.views_7d), viewsTotal = num(b.views_total);
  const attention = [];
  if (pics.failed > 0) attention.push({ id: 'failed', level: 'warn', text: `${pics.failed} picture${pics.failed === 1 ? '' : 's'} failed to generate` });
  if (trialSoon) attention.push({ id: 'trial', level: 'warn', text: daysLeft <= 0 ? 'Trial ends today' : `Trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` });
  if (published && planState === 'expired') attention.push({ id: 'expired', level: 'bad', text: 'Plan expired: diners see "menu not available"' });
  if (published && planState === 'suspended') attention.push({ id: 'suspended', level: 'bad', text: 'Plan suspended: diners see "menu not available"' });
  if (stalled) attention.push({ id: 'stalled', level: 'warn', text: `No activity for ${idleDays} days and not published yet` });
  if (published && num(b.items_with_picture) === 0) attention.push({ id: 'nopics', level: 'info', text: 'Published without any picture' });
  if (liveNow && views7 === 0 && firstPub != null && now - firstPub > 2 * DAY) attention.push({ id: 'noviews', level: 'info', text: 'Live, but no diner opened it in the last 7 days' });
  if (pics.review > 0 && !published) attention.push({ id: 'review', level: 'info', text: `${pics.review} picture${pics.review === 1 ? '' : 's'} waiting for the owner's review` });

  const nameHe = clean(b.name_he).trim(), nameEn = clean(b.name_en).trim();
  return {
    id: str(b.id), slug: str(b.slug), nameHe, nameEn, name: nameHe || nameEn || str(b.slug) || '(no name)',
    kind: BUSINESS_KINDS.includes(b.kind) ? b.kind : 'other',
    areaHe: clean(b.area_he).trim(), areaEn: clean(b.area_en).trim(),
    created, ownerEmail: clean(b.owner_email).trim(), contactName: clean(b.contact_name).trim(),
    contactPhone: clean(b.contact_phone).trim(), phone: clean(b.phone).trim(),
    lastSignIn: time(b.last_sign_in_at),
    categories, items, itemsWithPicture: num(b.items_with_picture), pics,
    revisions: num(b.revisions), firstPub, lastPub, published, liveFlag: b.live === true, liveNow, offlineWhy,
    plan, planStatus: str(b.plan_status), planState, trialStarted: time(b.trial_started_at), trialEnds, periodEnd, endsAt, daysLeft, trialSoon,
    planNote: clean(b.plan_note), views7, viewsTotal, activity, idleDays,
    base, stalled, stage: stalled ? 'stalled' : base, attention,
  };
}

export function planText(b) {
  const p = { trial: 'Trial', pilot: 'Pilot', paid: 'Paid' }[b.plan];
  const s = { pending: 'not started', trialing: 'running', active: 'active', expired: 'expired', suspended: 'suspended' }[b.planState];
  return { plan: p, state: s };
}
export function planEndText(b, now, short) {
  const f = short ? fmtDateShort : fmtDate;
  if (b.planState === 'pending') return 'starts at first publish';
  if (b.planState === 'suspended') return '';
  if (b.endsAt == null) return b.planState === 'active' ? 'no end date' : '';
  if (b.planState === 'expired') return 'ended ' + f(b.endsAt);
  const d = daysUntil(b.endsAt, now);
  return `until ${f(b.endsAt)} · ${d <= 0 ? 'ends today' : d + (d === 1 ? ' day left' : ' days left')}`;
}

// ---------------------------------------------------------------- the whole overview
export function derive(data) {
  const d = data && typeof data === 'object' ? data : {};
  const now = time(d.generatedAt) ?? Date.now();
  const businesses = (Array.isArray(d.businesses) ? d.businesses : []).map((b) => deriveBusiness(b, now));
  const leads = (Array.isArray(d.leads) ? d.leads : []).map((l) => deriveLead(l));
  const today = dayKey(now);
  const days = []; for (let i = 29; i >= 0; i--) days.push(addDays(today, -i));
  const fill = (rows, field) => {
    const m = new Map();
    for (const r of Array.isArray(rows) ? rows : []) if (r && validDay(r.day)) m.set(r.day, (m.get(r.day) || 0) + num(r[field]));
    return days.map((day) => ({ day, value: m.get(day) || 0 }));
  };
  const signups = fill(d.signupsByDay, 'businesses');
  const views = fill(d.viewsByDay, 'views');
  const accountsWithoutBusiness = num(d.accountsWithoutBusiness);
  const count = (f) => businesses.filter(f).length;
  const kpi = {
    accountsWithoutBusiness,
    businesses: businesses.length,
    withItems: count((b) => b.items > 0),
    withApproved: count((b) => b.pics.approved > 0),
    published: count((b) => b.published),
    live: count((b) => b.liveNow),
    trialSoon: count((b) => b.trialSoon),
    planOff: count((b) => b.planState === 'expired' || b.planState === 'suspended'),
    views7: views.slice(-7).reduce((s, x) => s + x.value, 0),
    newLeads: leads.filter((l) => l.status === 'new').length,
    stalled: count((b) => b.stalled),
    attention: count((b) => b.attention.some((a) => a.level !== 'info')),
  };
  // Every step is counted on its own, so each number equals the tile above it. Pictures are optional before
  // publishing, which is why "published" may be higher than "pictures approved".
  const steps = [
    { id: 'signup', label: 'Signed up', value: accountsWithoutBusiness + businesses.length, note: 'accounts without a business + businesses' },
    { id: 'business', label: 'Business created', value: kpi.businesses },
    { id: 'items', label: 'Items added', value: kpi.withItems },
    { id: 'pictures', label: 'Pictures approved', value: kpi.withApproved },
    { id: 'published', label: 'Published', value: kpi.published },
    { id: 'views', label: 'Got diner views', value: count((b) => b.viewsTotal > 0) },
  ];
  const top = steps[0].value;
  const funnel = steps.map((s, i) => {
    const prev = i ? steps[i - 1].value : null;
    return { ...s, share: top ? s.value / top : 0, prev,
      drop: prev == null ? null : prev - s.value, dropPct: prev ? (prev - s.value) / prev : null };
  });
  return { now, today, generatedAt: time(d.generatedAt), businesses, leads, signups, views, kpi, funnel };
}

export function deriveLead(raw) {
  const l = raw && typeof raw === 'object' ? raw : {};
  const hidden = [l.dream, l.contact, l.name, l.source, l.page].some(hadHidden);
  return {
    id: str(l.id), ref: clean(l.ref) || '—', created: time(l.created_at), source: clean(l.source), pkg: clean(l.package),
    dream: clean(l.dream), contact: clean(l.contact).trim(), name: clean(l.name).trim(), locale: clean(l.locale), page: clean(l.page),
    status: LEAD_STATUSES.includes(l.status) ? l.status : 'new', owner: clean(l.owner), nextAction: clean(l.next_action),
    nextOn: validDay(l.next_action_on) ? l.next_action_on : '', notes: clean(l.notes), hidden,
  };
}

// "new" first, then the working ladder, closed ones last; newest first inside a status.
export function sortLeads(leads) {
  const rank = (s) => LEAD_STATUSES.indexOf(s);
  return [...leads].sort((a, b) => rank(a.status) - rank(b.status) || (b.created || 0) - (a.created || 0));
}

// ---------------------------------------------------------------- table sorting and filtering
export const BUSINESS_SORTS = {
  name: (b) => (b.nameEn || b.nameHe || b.slug).toLocaleLowerCase(),
  kind: (b) => b.kind,
  created: (b) => b.created || 0,
  stage: (b) => STAGE_RANK[b.base] * 2 + (b.stalled ? 0 : 1),
  items: (b) => b.items,
  pictures: (b) => b.pics.approved,
  revisions: (b) => b.revisions,
  published: (b) => b.lastPub || 0,
  plan: (b) => (b.daysLeft == null ? Infinity : b.daysLeft),
  views: (b) => b.views7 * 1e9 + b.viewsTotal,
  activity: (b) => b.activity || 0,
  signin: (b) => b.lastSignIn || 0,
  owner: (b) => b.ownerEmail.toLocaleLowerCase(),
};
export function sortBusinesses(list, key, dir) {
  const f = BUSINESS_SORTS[key] || BUSINESS_SORTS.created;
  const m = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const x = f(a), y = f(b);
    if (x === y) return (b.created || 0) - (a.created || 0);
    if (typeof x === 'string') return m * x.localeCompare(y, ['en', 'he']);
    return m * (x < y ? -1 : 1);
  });
}
export const BUSINESS_FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'attention', label: 'Needs attention', test: (b) => b.attention.some((a) => a.level !== 'info') },
  { id: 'stalled', label: 'Stalled', test: (b) => b.stalled },
  { id: 'created', label: 'Created', test: (b) => b.base === 'created' },
  { id: 'menu', label: 'Menu started', test: (b) => b.base === 'menu' },
  { id: 'review', label: 'Pictures in review', test: (b) => b.base === 'review' },
  { id: 'approved', label: 'Pictures approved', test: (b) => b.base === 'approved' },
  { id: 'published', label: 'Published, offline', test: (b) => b.base === 'published' },
  { id: 'live', label: 'Live', test: (b) => b.liveNow },
  { id: 'trial-soon', label: 'Trial ending in 7 days', test: (b) => b.trialSoon },
  { id: 'plan-off', label: 'Plan expired or suspended', test: (b) => b.planState === 'expired' || b.planState === 'suspended' },
  // reached from the overview tiles
  { id: 'with-items', label: 'With at least 1 item', test: (b) => b.items > 0, hidden: true },
  { id: 'with-approved', label: 'With at least 1 approved picture', test: (b) => b.pics.approved > 0, hidden: true },
  { id: 'published-once', label: 'Published at least once', test: (b) => b.published, hidden: true },
  { id: 'with-views', label: 'With diner views in the last 7 days', test: (b) => b.views7 > 0, hidden: true },
];
export function filterBusinesses(list, filterId, query) {
  const f = (BUSINESS_FILTERS.find((x) => x.id === filterId) || BUSINESS_FILTERS[0]).test;
  const q = str(query).trim().toLocaleLowerCase();
  return list.filter((b) => f(b) && (!q || [b.nameHe, b.nameEn, b.slug, b.ownerEmail, b.contactName, b.contactPhone, b.areaHe, b.areaEn, b.kind]
    .some((v) => v.toLocaleLowerCase().includes(q))));
}

// ---------------------------------------------------------------- plan change → the exact RPC arguments
export const PLAN_ACTIONS = [
  { id: 'extend', label: 'Extend the trial', needsDate: true },
  { id: 'pilot', label: 'Pilot, active until', needsDate: true, openEnded: true },
  { id: 'paid', label: 'Paid, active until', needsDate: true, openEnded: true },
  { id: 'suspend', label: 'Suspend', needsDate: false },
];
export function planRequest(b, action, day, noEnd, note) {
  const a = PLAN_ACTIONS.find((x) => x.id === action);
  if (!a) return { error: 'Choose what to change.' };
  const n = clean(note).trim();
  if (n.length > 500) return { error: 'The note is longer than 500 characters.' };
  let until = null;
  if (a.needsDate && !(a.openEnded && noEnd)) {
    until = endOfDayIsrael(day);
    if (!until) return { error: 'Choose a date.' };
  }
  const args = { p_business: b.id, p_note: n || null, p_until: until };
  if (action === 'extend') Object.assign(args, { p_plan: 'trial', p_status: 'trialing' });
  else if (action === 'suspend') Object.assign(args, { p_plan: b.plan, p_status: 'suspended', p_until: null });
  else Object.assign(args, { p_plan: action, p_status: 'active' });
  const untilText = until ? 'until ' + fmtDate(Date.parse(until)) : 'with no end date';
  const summary = action === 'extend' ? `Trial runs ${untilText}`
    : action === 'suspend' ? 'Suspend the plan: diners will see "menu not available" and the owner cannot publish'
      : `${action === 'pilot' ? 'Pilot' : 'Paid'} plan, active ${untilText}`;
  return { args, summary, past: until != null && Date.parse(until) < Date.now() };
}

// ---------------------------------------------------------------- lead edit → the exact RPC arguments
// ops_update_lead keeps a field when it gets null, so only changed fields are sent. A text field is cleared by
// sending ''. A date cannot be cleared through this function (null = keep): the UI says so.
export function leadPatch(lead, draft) {
  const args = { p_id: lead.id, p_status: null, p_owner: null, p_next_action: null, p_next_action_on: null, p_notes: null };
  let changed = 0; const errors = [];
  const text = (key, param, max, label) => {
    if (draft[key] === undefined) return;
    const v = clean(draft[key]).trim();
    if (v === lead[key]) return;
    if (v.length > max) { errors.push(`${label} is longer than ${max} characters.`); return; }
    args[param] = v; changed++;
  };
  if (draft.status !== undefined && draft.status !== lead.status) {
    if (!LEAD_STATUSES.includes(draft.status)) errors.push('Unknown status.'); else { args.p_status = draft.status; changed++; }
  }
  text('owner', 'p_owner', 80, 'Owner');
  text('nextAction', 'p_next_action', 300, 'Next action');
  text('notes', 'p_notes', 4000, 'Notes');
  if (draft.nextOn !== undefined && draft.nextOn !== lead.nextOn) {
    if (draft.nextOn === '') errors.push('A date cannot be removed yet, only changed (backend limit).');
    else if (!validDay(draft.nextOn)) errors.push('The date is not valid.');
    else { args.p_next_action_on = draft.nextOn; changed++; }
  }
  return { args, changed, errors };
}

// ---------------------------------------------------------------- CSV (Excel-safe)
// Text cells that would start a formula get a leading apostrophe; every cell is quoted; CRLF rows; UTF-8 BOM.
export function csvCell(v) {
  if (v == null) return '""';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '""';
  let s = clean(v);
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function toCsv(header, rows) {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
const iso = (ms) => (ms == null ? '' : new Date(ms).toISOString());
export function businessesCsv(list, cfg) {
  const header = ['name_he', 'name_en', 'slug', 'menu_link', 'kind', 'stage', 'stalled', 'needs_attention', 'created_at', 'owner_email', 'contact_name', 'contact_phone',
    'categories', 'items', 'items_with_picture', 'pictures_approved', 'pictures_waiting_review', 'pictures_in_progress', 'pictures_failed', 'revisions',
    'first_published_at', 'last_published_at', 'live_now', 'plan', 'plan_state', 'plan_ends_at', 'days_left', 'plan_note', 'views_7d', 'views_total',
    'last_activity_at', 'last_sign_in_at', 'id'];
  const rows = list.map((b) => {
    const l = menuLinks(b.slug, cfg);
    return [b.nameHe, b.nameEn, b.slug, l ? l.short : '', b.kind, stageLabel(b.base), b.stalled ? 'yes' : 'no', b.attention.map((a) => a.text).join(' | '), iso(b.created),
      b.ownerEmail, b.contactName, b.contactPhone, b.categories, b.items, b.itemsWithPicture, b.pics.approved, b.pics.review, b.pics.working, b.pics.failed, b.revisions,
      iso(b.firstPub), iso(b.lastPub), b.liveNow ? 'yes' : 'no', b.plan, b.planState, iso(b.endsAt), b.daysLeft == null ? '' : String(b.daysLeft), b.planNote,
      b.views7, b.viewsTotal, iso(b.activity), iso(b.lastSignIn), b.id];
  });
  return toCsv(header, rows);
}
export function leadsCsv(list) {
  const header = ['ref', 'created_at', 'status', 'source', 'package', 'name', 'contact', 'dream', 'owner', 'next_action', 'next_action_on', 'notes', 'locale', 'page', 'id'];
  const rows = list.map((l) => [l.ref, iso(l.created), l.status, l.source, l.pkg, l.name, l.contact, l.dream, l.owner, l.nextAction, l.nextOn, l.notes, l.locale, l.page, l.id]);
  return toCsv(header, rows);
}
