/**
 * A stored revision, read in full before guests see it ("The menu to approve"): everything in it that guests will see,
 * in both languages (model.ts `readMenu`, from the contracts' snapshot types). The venue's block at the top (name,
 * logo, area, cuisine, order and booking links, phone, the table under the dishes); sections and their hours; each
 * dish's names, description, price and price note, tags, allergens (the owner's words), wine and beer details, picture,
 * hours and "goes well with"; every add-on group with its options, limits, prices and the one nesting level; the
 * suggestion rules in words. Every text is a text node, each owner name in its own <bdi>. A picture is shown only from
 * this environment's own storage (the configured Supabase project's public bucket); one that cannot be shown says so.
 */
import { useMemo, useState } from 'preact/hooks';
import type { SnapshotV2, Text } from '@mana/contracts';
import {
  fmtMoney, limitWords, names, readMenu, storageOf, type DishRead, type GroupRead, type MenuDiff, type PictureRead, type VenueRead, type Words,
} from './model.ts';
import { Badge, T, useCtx } from './ui.tsx';

/** A sentence with owner names: each name in its own <bdi>. */
export function WordsView({ w }: { w: Words }) {
  return <>{w.map((x, i) => (typeof x === 'string' ? x : <T key={i}>{x.name}</T>))}</>;
}

const has = (t: Text): boolean => t.he.trim() !== '' || t.en.trim() !== '';

/** Both languages, English then Hebrew, each marked; a missing one is said. */
function Both({ t, quote = false }: { t: Text; quote?: boolean }) {
  const q = (s: string) => (quote ? `“${s}”` : s);
  return (
    <span class="both">
      {t.en.trim() ? <T class="both-en">{q(t.en)}</T> : <span class="muted small">(no English)</span>}
      <span class="both-sep" aria-hidden="true"> · </span>
      {t.he.trim() ? <span lang="he"><T class="both-he">{q(t.he)}</T></span> : <span class="muted small">(no Hebrew)</span>}
    </span>
  );
}

function Picture({ p, name }: { p: PictureRead; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!p) return <span class="mr-pic is-none" data-picture="none">No picture</span>;
  if (!p.src || failed) {
    return (
      <span class="mr-pic is-none" data-picture="unavailable" data-picture-of={p.kind}>
        {p.label[0]!.toUpperCase() + p.label.slice(1)}: cannot be shown here {!p.src ? '(its address is not this environment’s own picture storage)' : '(this page’s settings or the network did not let it load)'}.
      </span>
    );
  }
  return (
    <figure class="mr-pic" data-picture={p.kind}>
      <img src={p.src} alt={`${name}: ${p.label}`} width={72} height={72} loading="lazy" referrerpolicy="no-referrer" onError={() => setFailed(true)} />
      <figcaption class="small muted">{p.label}</figcaption>
    </figure>
  );
}

function Group({ g, nested = false }: { g: GroupRead; nested?: boolean }) {
  return (
    <div class={'mr-group' + (nested ? ' is-nested' : '')} data-group={g.id}>
      <p class="small"><strong><Both t={g.name} /></strong> · {g.selection === 'single' ? 'one choice' : 'several choices'} · {limitWords(g.min, g.max)}
        {g.min >= 1 ? ' (required)' : ' (optional)'}</p>
      <ul class="mr-options">
        {g.options.map((o) => (
          <li key={o.id} data-option={o.id}>
            <span class="small"><Both t={o.name} /> · {o.price === 0 ? 'free' : `+${fmtMoney(o.price)}`}{o.maxQty > 1 ? ` · up to ${o.maxQty} of it` : ''}{o.default ? ' · pre-selected' : ''}</span>
            {o.opens && <div class="mr-opens"><span class="small muted">Choosing it opens:</span><Group g={o.opens} nested /></div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dish({ d, isNew, was }: { d: DishRead; isNew: boolean; was: number | null | undefined }) {
  const name = names(d.name).main;
  return (
    <li class="mr-dish" data-id={d.id}>
      <div class="mr-dish-head">
        <Picture p={d.picture} name={name} />
        <div class="mr-dish-main">
          <p class="mr-name"><Both t={d.name} />{isNew && <> <Badge tone="info" data="new">new</Badge></>}</p>
          <p class="mr-price small" data-price>{was !== undefined ? <>{was === null ? 'no price' : fmtMoney(was)} → </> : null}{d.price === null ? 'no price' : fmtMoney(d.price)}
            {has(d.priceNote) && <> · <Both t={d.priceNote} /></>}</p>
          {has(d.desc) && <p class="small mr-desc" data-desc><Both t={d.desc} /></p>}
          {d.tags.length > 0 && <p class="small" data-tags>Tags: {d.tags.join(', ')}</p>}
          {has(d.allergens) && <p class="small" data-allergens>Allergens, in the owner’s words: <Both t={d.allergens} /></p>}
          {d.details.length > 0 && <p class="small" data-details>{d.details.map(([k, v], i) => <span key={k}>{i ? ' · ' : ''}{k}: <T>{v}</T></span>)}</p>}
          {d.when && <p class="small muted" data-when>Shown <WordsView w={d.when} /></p>}
          {d.related.length > 0 && <p class="small muted">Goes well with: {d.related.map((r, i) => <span key={i}>{i ? ', ' : ''}<T>{names(r).main}</T></span>)}</p>}
        </div>
      </div>
      {d.addons.length > 0 && <div class="mr-groups" data-addons>{d.addons.map((g) => <Group key={g.id} g={g} />)}</div>}
    </li>
  );
}

/** The block at the top of the guest menu. */
function Venue({ v }: { v: VenueRead }) {
  const has = (t: Text) => t.he.trim() !== '' || t.en.trim() !== '';
  const plain = (s: string | null, none: string) => (s ? <T class="break">{s}</T> : <span class="muted">{none}</span>);
  return (
    <section class="mr-venue" data-venue-block aria-label="What guests see at the top">
      <h3 class="sub-h">What guests see at the top</h3>
      <div class="mr-dish-head">
        {v.logo ? <Picture p={v.logo} name="the venue" /> : <span class="mr-pic is-none" data-picture="none" data-picture-of="logo">No logo</span>}
        <dl class="mr-venue-facts small">
          <div><dt>Name</dt><dd data-venue-name-read><Both t={v.name} /></dd></div>
          <div><dt>Area</dt><dd data-venue-area>{has(v.area) ? <Both t={v.area} /> : <span class="muted">none</span>}</dd></div>
          <div><dt>Cuisine</dt><dd data-venue-cuisine>{has(v.cuisine) ? <Both t={v.cuisine} /> : <span class="muted">none</span>}</dd></div>
          <div><dt>Order link</dt><dd data-venue-order>{plain(v.orderUrl, 'none')}</dd></div>
          <div><dt>Booking link</dt><dd data-venue-book>{plain(v.bookUrl, 'none')}</dd></div>
          <div><dt>Phone</dt><dd data-venue-phone>{plain(v.phone, 'none')}</dd></div>
          <div><dt>Table</dt><dd data-venue-table>{v.table.look}</dd></div>
          <div><dt>Sold out</dt><dd data-venue-soldout>{v.soldOut === 'hide' ? 'hidden from guests' : 'shown at the bottom of its section'}</dd></div>
        </dl>
        {v.table.photo && <Picture p={v.table.photo} name="the table" />}
      </div>
    </section>
  );
}

export function MenuReadView({ snapshot, diff }: { snapshot: SnapshotV2; diff: MenuDiff | null }) {
  const { conn } = useCtx();
  // pictures only from this environment's own storage: the configured project's public bucket (SEC-N14)
  const storage = storageOf(conn.config.supabaseUrl);
  const m = useMemo(() => readMenu(snapshot, storage), [snapshot, storage]);
  const added = new Set(diff?.dishesAdded.map((d) => d.id));
  const before = new Map(diff?.prices.map((p) => [p.id, p.from] as const));
  return (
    <div class="menu-read" data-revision-menu>
      <Venue v={m.venue} />
      {m.sections.map((sec) => (
        <section key={sec.id} class="mr-sec" data-section={sec.id} aria-label={names(sec.name).main}>
          <h3 class="mr-sec-h" data-menu-row="section"><Both t={sec.name} /></h3>
          {sec.when && <p class="small muted" data-when>Shown <WordsView w={sec.when} /></p>}
          <ul class="mr-dishes">{sec.dishes.map((d) => <Dish key={d.id} d={d} isNew={added.has(d.id)} was={before.has(d.id) ? before.get(d.id) ?? null : undefined} />)}</ul>
        </section>
      ))}
      <section class="mr-rules" data-rules aria-label="Suggestions">
        <h3 class="sub-h">Suggestions guests may get</h3>
        {m.rules.length === 0 ? <p class="small muted">No suggestion rule.</p> : (
          <ul>
            {m.rules.map((r) => (
              <li key={r.id} data-rule={r.id} class={r.active ? '' : 'is-off'}>
                <p class="small" data-rule-words><WordsView w={r.words} /></p>
                <p class="small muted">The line guests read: <Both t={r.line} quote /></p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
