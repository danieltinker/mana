// Home, once the menu has been published: the owner's numbers (my_stats), drawn by hand in SVG, and the few things
// worth doing next. Before any guest came, the same tiles are shown as quiet outlines.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { PRODUCT } from '../product.ts';
import { t, tn, lang, fmtDate } from '../lib/i18n.ts';
import { D, edit, sortRows, planOf, textOf } from '../lib/store.ts';
import { stats, loadStats, weekChange, share, sparkPaths, barHeights, peakHours, type Stats } from '../lib/stats.ts';
import { hasChanges } from '../lib/draft.ts';
import { shortUrl, shortText } from '../lib/links.ts';
import { Btn, Icon, Switch, Ltr, CopyIcon, Sheet, IconBtn, go } from '../ui.tsx';
import { picState } from '../pic.tsx';
import { PlanNote, QrSheet } from './publish.tsx';

const nameOf = (row: any) => textOf(row, 'name', lang.value);
const num = (n: number) => n.toLocaleString(lang.value === 'he' ? 'he-IL' : 'en-GB');

// ---------------------------------------------------------------- charts (SVG, no library)
function Spark({ values, ghost }: { values: number[]; ghost?: boolean }) {
  const W = 300, H = 64;
  const vals = ghost ? [3, 4, 3, 5, 6, 5, 7, 6, 8, 7, 9, 8, 10, 9, 8, 10, 12, 11, 10, 12, 13, 12, 14, 13, 12, 14, 15, 14, 16, 17] : values;
  const p = sparkPaths(vals, W, H);
  return (
    <svg class={'chart spark' + (ghost ? ' is-ghost' : '')} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={t('home.t.views30')} data-chart="spark">
      {!ghost && <path d={p.area} class="spark-area" />}
      <path d={p.line} class="spark-line" vector-effect="non-scaling-stroke" />
    </svg>
  );
}
function Hours({ hours, ghost }: { hours: number[]; ghost?: boolean }) {
  const vals = ghost ? [0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 2, 3, 6, 7, 5, 3, 2, 3, 6, 9, 10, 8, 4, 1] : hours;
  const hs = barHeights(vals), peak = ghost ? null : peakHours(vals);
  const inPeak = (h: number) => !!peak && (peak[0] < peak[1] ? h >= peak[0] && h < peak[1] : h >= peak[0] || h < peak[1]);
  return (
    <svg class={'chart hours' + (ghost ? ' is-ghost' : '')} viewBox="0 0 240 62" role="img" aria-label={t('home.t.hours')} data-chart="hours">
      {hs.map((v, h) => <rect key={h} x={h * 10 + 2} y={46 - Math.max(v * 44, 2)} width="6" height={Math.max(v * 44, 2)} rx="2" class={'bar' + (inPeak(h) ? ' bar-peak' : '')} data-hour={h} data-v={vals[h]} />)}
      {[0, 6, 12, 18].map((h) => <text key={h} x={h * 10 + 5} y="59" text-anchor="middle" class="tick">{String(h).padStart(2, '0')}</text>)}
    </svg>
  );
}
function TopDishes({ items, ghost }: { items: Stats['items']; ghost?: boolean }) {
  const rows = ghost ? [5, 4, 3, 2.2, 1.5].map((v, i) => ({ id: 'g' + i, name_he: '', name_en: '', opens: v, adds: 0 })) : items.slice(0, 5);
  const max = Math.max(1, ...rows.map((r) => r.opens));
  return (
    <ol class={'topdishes' + (ghost ? ' is-ghost' : '')} data-chart="top">
      {rows.map((r) => (
        <li key={r.id} data-top={ghost ? '' : r.id}>
          <span class="top-name" dir="auto">{ghost ? '' : nameOf(r)}</span>
          <svg class="chart top-bar" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width={Math.max(4, (r.opens / max) * 100)} height="8" rx="4" class="bar bar-peak" /></svg>
          <Ltr class="top-n">{ghost ? '' : num(r.opens)}</Ltr>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- sold out today
function SoldOutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = D.value!;
  const cats = useMemo(() => sortRows(d.categories), [d.categories]);
  if (!open) return null;
  return (
    <Sheet open onClose={onClose} title={t('home.soldout')} tall name="soldout">
      <p class="hint">{t('home.soldoutLead')}</p>
      {cats.map((c) => {
        const items = sortRows(d.items.filter((i) => i.category_id === c.id));
        if (!items.length) return null;
        return (
          <div key={c.id} class="outgroup">
            <h3>{nameOf(c)}</h3>
            <ul class="outlist">{items.map((it) => (
              <li key={it.id} class={it.available ? '' : 'is-out'} data-soldout-item={it.id}>
                <span class="out-name">{nameOf(it)}</span>
                <Switch checked={!it.available} label={t('item.soldOut') + ': ' + nameOf(it)} onChange={(v) => edit('items', it.id, { available: !v }, { now: true })} />
              </li>
            ))}</ul>
          </div>
        );
      })}
    </Sheet>
  );
}

// ---------------------------------------------------------------- the screen
export function HomeScreen() {
  const d = D.value!;
  const name = nameOf(d.biz);
  const p = planOf(d.ent);
  const live = !!d.menu.published_revision_id;
  const visible = live && (p.state === 'trialing' || p.state === 'active');
  const [qr, setQr] = useState(false), [out, setOut] = useState(false);
  useEffect(() => { loadStats(); }, [d.biz.id, d.menu.published_revision_id]);
  const s = stats.value.biz === d.biz.id ? stats.value.data : null;
  const ghost = !s || s.totals.viewsAll === 0;
  const tt = s ? s.totals : null;
  const change = tt ? weekChange(tt.views7, tt.viewsPrev7) : null;
  const peak = s ? peakHours(s.hours) : null;
  const hh = (h: number) => String(h).padStart(2, '0') + ':00';

  // at most two nudges, each one read from the data
  const noPhoto = d.items.filter((i) => { const st = picState(i).state; return st === 'none' || st === 'stock' || st === 'failed'; }).length;
  const waiting = d.assets.filter((a) => a.status === 'ready_for_review').length;
  const noEnglish = d.biz.langs.includes('en') ? d.items.filter((i) => !String(i.name_en || '').trim()).length : 0;
  const noPrice = d.items.filter((i) => i.price_minor == null).length;
  const soldOut = d.items.filter((i) => !i.available).length;
  const nudges: { key: string; icon: string; text: string; href?: string; act?: () => void }[] = [];
  if (waiting) nudges.push({ key: 'waiting', icon: 'check', text: tn('home.n.waiting', waiting), href: '#/pictures' });
  if (tt && tt.views30 >= 5 && share(tt.en30, tt.views30) >= 15 && noEnglish) nudges.push({ key: 'english', icon: 'globe', text: tn('home.n.english', noEnglish, { pct: share(tt.en30, tt.views30) }), href: '#/menu' });
  if (noPhoto) nudges.push({ key: 'photos', icon: 'camera', text: tn('home.n.photos', noPhoto), href: '#/pictures' });
  if (tt && tt.views30 >= 10 && tt.qr30 === 0) nudges.push({ key: 'qr', icon: 'qr', text: t('home.n.qr'), act: () => setQr(true) });
  if (noPrice) nudges.push({ key: 'price', icon: 'edit', text: tn('home.n.price', noPrice), href: '#/menu' });
  if (!d.biz.logo_path) nudges.push({ key: 'logo', icon: 'image', text: t('home.n.logo'), href: '#/style' });

  return (
    <div class="page page-home" data-stats={stats.value.loading && !s ? 'loading' : ghost ? 'empty' : 'ready'}>
      <header class="home-head">
        <h1 tabIndex={-1}>{name}</h1>
        <p class="status" data-live-state={visible ? 'live' : live ? 'blocked' : 'off'}><span class={'dot ' + (visible ? 'dot-on' : 'dot-off')} aria-hidden="true" /><span>{visible ? t('home.published') : live ? t('home.offline') : t('home.notPublished')}</span></p>
        <p class="home-link">
          <Ltr class="home-url" data-short-link>{shortText(d.biz.slug)}</Ltr>
          <CopyIcon text={shortUrl(d.biz.slug)} />
          <IconBtn icon="qr" label={t('pub.qr')} onClick={() => setQr(true)} data-action="qr" />
        </p>
        {(hasChanges.value || !live) && <Btn kind="primary" icon="send" onClick={() => go('publish')} data-action="update">{live ? t('pub.updateLong') : t('pub.publish')}</Btn>}
      </header>

      <PlanNote />

      {nudges.length > 0 && (
        <ul class="nudges" data-nudges>
          {nudges.slice(0, 2).map((n) => (
            <li key={n.key} data-nudge={n.key}>
              {n.href ? <a href={n.href}><Icon name={n.icon} size={20} /><span>{n.text}</span><Icon name="chev" size={16} flip /></a>
                : <button type="button" onClick={n.act}><Icon name={n.icon} size={20} /><span>{n.text}</span><Icon name="chev" size={16} flip /></button>}
            </li>
          ))}
        </ul>
      )}

      {/* before any guest came: say so first, then show what will fill in */}
      {ghost && !(stats.value.loading && !s) && <p class="muted dash-empty" data-dash-empty><Icon name="clock" size={17} /><span>{t('home.noData')}</span></p>}
      <section class={'dash' + (ghost ? ' is-ghost' : '')} aria-label={t('home.numbers')}>
        <div class="dt dt-views" data-tile="views">
          <p class="dt-label"><Icon name="trend" size={16} />{t('home.t.views7')}</p>
          <p class="dt-big"><Ltr data-n="views7">{ghost ? '–' : num(tt!.views7)}</Ltr>
            {!ghost && change !== null && <span class={'delta ' + (change >= 0 ? 'delta-up' : 'delta-down')} data-n="change"><Icon name={change >= 0 ? 'up' : 'down'} size={14} /><Ltr>{Math.abs(change)}%</Ltr></span>}
          </p>
          <Spark values={s ? s.days.map((x) => x.views) : []} ghost={ghost} />
          <p class="dt-foot"><span>{t('home.t.views30')}</span>{!ghost && <Ltr data-n="views30">{num(tt!.views30)}</Ltr>}</p>
          {/* three smaller numbers of the same 30 days, read in one line under the chart instead of three tiles */}
          <ul class="dt-minis">
            <li data-mini="english"><Ltr data-n="english">{ghost ? '–' : share(tt!.en30, tt!.views30) + '%'}</Ltr><span><Icon name="globe" size={14} />{t('home.t.english')}</span></li>
            <li data-mini="qr"><Ltr data-n="qr">{ghost ? '–' : share(tt!.qr30, tt!.views30) + '%'}</Ltr><span><Icon name="qr" size={14} />{t('home.t.qr')}</span></li>
            <li data-mini="adds"><Ltr data-n="adds">{ghost ? '–' : num(tt!.adds30)}</Ltr><span><Icon name="bookmark" size={14} />{t('home.t.adds')}</span></li>
          </ul>
        </div>

        <div class="dt dt-top" data-tile="top">
          <p class="dt-label"><Icon name="star" size={16} />{t('home.t.top')}</p>
          {!ghost && s!.items.length === 0 ? <p class="dt-none">–</p> : <TopDishes items={s ? s.items : []} ghost={ghost || !s!.items.length} />}
        </div>

        <div class="dt dt-hours" data-tile="hours">
          <p class="dt-label"><Icon name="clock" size={16} />{t('home.t.hours')}</p>
          <p class="dt-mid"><Ltr data-n="peak">{ghost || !peak ? '–' : `${hh(peak[0])}–${hh(peak[1])}`}</Ltr></p>
          <Hours hours={s ? s.hours : []} ghost={ghost} />
        </div>

      </section>

      <nav class="acts" aria-label={t('home.actions')}>
        <button type="button" class="act" onClick={() => setOut(true)} data-act="soldout"><span class="act-ico"><Icon name="ban" size={22} />{soldOut > 0 && <b>{soldOut}</b>}</span><span>{t('home.a.soldout')}</span></button>
        <a class="act" href="#/menu" data-act="menu"><span class="act-ico"><Icon name="menu" size={22} /></span><span>{t('home.a.menu')}</span></a>
        <a class="act" href="#/pictures" data-act="photos"><span class="act-ico"><Icon name="camera" size={22} />{noPhoto > 0 && <b>{noPhoto}</b>}</span><span>{t('home.a.photos')}</span></a>
        <a class="act" href="#/style" data-act="style"><span class="act-ico"><Icon name="look" size={22} /></span><span>{t('home.a.style')}</span></a>
        <button type="button" class="act" onClick={() => setQr(true)} data-act="qr"><span class="act-ico"><Icon name="print" size={22} /></span><span>{t('home.a.qr')}</span></button>
      </nav>

      {p.state === 'trialing' && p.daysLeft !== null && (
        <p class="trial" data-plan="trialing">
          <span>{p.daysLeft === 1 ? t('home.plan.trialing1') : t('home.plan.trialing', { n: p.daysLeft })}</span>
          <svg class="chart trial-bar" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="4" rx="2" class="bar" /><rect width={Math.max(3, Math.min(100, (p.daysLeft / 30) * 100))} height="4" rx="2" class="bar bar-peak" /></svg>
          <a href={PRODUCT.whatsapp} target="_blank" rel="noopener noreferrer">{t('home.plan.next')}</a>
        </p>
      )}
      {p.state === 'active' && p.until && <p class="trial" data-plan="active"><span>{t('home.plan.activeUntil', { date: fmtDate(p.until) })}</span></p>}

      <QrSheet open={qr} onClose={() => setQr(false)} />
      <SoldOutSheet open={out} onClose={() => setOut(false)} />
    </div>
  );
}
