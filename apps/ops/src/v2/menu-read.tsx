/**
 * A stored revision, read in full before guests see it ("The menu to approve"): everything in it that guests will see,
 * in both languages (model.ts `readMenu`, from the contracts' snapshot types). Sections and their hours; each dish's
 * names, description, price and price note, tags, allergens (the owner's words), wine and beer details, picture, hours
 * and "goes well with"; every add-on group with its options, limits, prices and the one nesting level; the suggestion
 * rules in words. Every text is a text node. A picture that cannot be shown here says so.
 */
import { useMemo, useState } from 'preact/hooks';
import type { SnapshotV2, Text } from '@mana/contracts';
import { fmtMoney, limitWords, names, readMenu, type DishRead, type GroupRead, type MenuDiff, type PictureRead } from './model.ts';
import { Badge, T } from './ui.tsx';

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
      <span class="mr-pic is-none" data-picture="unavailable">
        {p.label[0]!.toUpperCase() + p.label.slice(1)}: cannot be shown here {!p.src ? '(its address is not this menu’s own storage)' : '(this page’s settings or the network did not let it load)'}.
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
          {d.when && <p class="small muted">Shown {d.when}</p>}
          {d.related.length > 0 && <p class="small muted">Goes well with: {d.related.map((r, i) => <span key={i}>{i ? ', ' : ''}<T>{names(r).main}</T></span>)}</p>}
        </div>
      </div>
      {d.addons.length > 0 && <div class="mr-groups" data-addons>{d.addons.map((g) => <Group key={g.id} g={g} />)}</div>}
    </li>
  );
}

export function MenuReadView({ snapshot, diff }: { snapshot: SnapshotV2; diff: MenuDiff | null }) {
  const m = useMemo(() => readMenu(snapshot), [snapshot]);
  const added = new Set(diff?.dishesAdded.map((d) => d.id));
  const before = new Map(diff?.prices.map((p) => [p.id, p.from] as const));
  return (
    <div class="menu-read" data-revision-menu>
      {m.sections.map((sec) => (
        <section key={sec.id} class="mr-sec" data-section={sec.id} aria-label={names(sec.name).main}>
          <h3 class="mr-sec-h" data-menu-row="section"><Both t={sec.name} /></h3>
          {sec.when && <p class="small muted">Shown {sec.when}</p>}
          <ul class="mr-dishes">{sec.dishes.map((d) => <Dish key={d.id} d={d} isNew={added.has(d.id)} was={before.has(d.id) ? before.get(d.id) ?? null : undefined} />)}</ul>
        </section>
      ))}
      <section class="mr-rules" data-rules aria-label="Suggestions">
        <h3 class="sub-h">Suggestions guests may get</h3>
        {m.rules.length === 0 ? <p class="small muted">No suggestion rule.</p> : (
          <ul>
            {m.rules.map((r) => (
              <li key={r.id} data-rule={r.id} class={r.active ? '' : 'is-off'}>
                <p class="small"><T>{r.words}</T></p>
                <p class="small muted">The line guests read: <Both t={r.line} quote /></p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
