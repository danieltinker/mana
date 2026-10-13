// Style: logo, colour, table, languages, the ordering link and phone, and the place's name in both languages.
// The two quick picks (colour dots, table strip) are also shown on the publish step, where they change the preview at once.
import { useEffect, useRef, useState } from 'preact/hooks';
import { cfg, sb, q, toAppError, publicUrl } from '../lib/api.ts';
import { t, errText, lang } from '../lib/i18n.ts';
import { D, edit, everPublished } from '../lib/store.ts';
import { resize, accentFromImage, brighten, isBright } from '../lib/images.ts';
import { shortText } from '../lib/links.ts';
import { Btn, Field, Note, Ltr, Icon, Sticky, go } from '../ui.tsx';
import { KINDS } from './setup.tsx';

// The viewer's tables (ids and names from the viewer's TABLES). 'holo' has no texture.
export const TABLES: { id: string; en: string; he: string }[] = [
  { id: 'oak', en: 'Oak table', he: 'שולחן אלון' }, { id: 'walnut', en: 'Dark walnut', he: 'אגוז כהה' }, { id: 'birch', en: 'Pale birch', he: 'ליבנה בהיר' },
  { id: 'gingham', en: 'Red check cloth', he: 'מפה משובצת אדומה' }, { id: 'gingham-blue', en: 'Blue check cloth', he: 'מפה משובצת כחולה' }, { id: 'linen', en: 'White linen', he: 'מפה לבנה' }, { id: 'damask', en: 'White damask', he: 'מפת דמשק לבנה' },
  { id: 'linen-black', en: 'Black linen', he: 'מפה שחורה' }, { id: 'marble', en: 'White marble', he: 'שיש לבן' }, { id: 'marble-black', en: 'Black marble', he: 'שיש שחור' }, { id: 'terrazzo', en: 'Terrazzo', he: 'טראצו' },
  { id: 'concrete', en: 'Concrete', he: 'בטון' }, { id: 'slate', en: 'Slate', he: 'צפחה' }, { id: 'tiles', en: 'Painted tiles', he: 'אריחים מצוירים' }, { id: 'bamboo', en: 'Bamboo mat', he: 'מחצלת במבוק' },
  { id: 'kraft', en: 'Kraft paper', he: 'נייר קראפט' }, { id: 'steel', en: 'Brushed steel', he: 'נירוסטה מוברשת' }, { id: 'copper', en: 'Hammered copper', he: 'נחושת מרוקעת' }, { id: 'holo', en: 'Hologram stage', he: 'במת הולוגרמה' },
];
const PRESETS = ['#ff8a5c', '#ffc9b6', '#f5c04f', '#c9c56a', '#7fd6a4', '#6ec9e0', '#8fb0ff', '#d59bf0', '#ff8fa3', '#e8e2d6'];
const COLOR_NAMES: Record<string, [string, string]> = { '#ff8a5c': ['כתום', 'Orange'], '#ffc9b6': ['אפרסק', 'Peach'], '#f5c04f': ['צהוב', 'Yellow'], '#c9c56a': ['זית', 'Olive'], '#7fd6a4': ['ירוק', 'Green'], '#6ec9e0': ['טורקיז', 'Turquoise'], '#8fb0ff': ['כחול', 'Blue'], '#d59bf0': ['סגול', 'Purple'], '#ff8fa3': ['ורוד', 'Pink'], '#e8e2d6': ['שמנת', 'Cream'] };

const FEW = ['#ff8a5c', '#f5c04f', '#c9c56a', '#7fd6a4', '#8fb0ff'];      // the publish screen shows five; the style screen has them all
export function AccentDots({ fromLogo, onAdjusted, few }: { fromLogo?: string | null; onAdjusted?: (v: boolean) => void; few?: boolean }) {
  const b = D.value!.biz;
  const cur = (b.accent || '').toLowerCase();
  const shown = few ? FEW.concat(cur && !FEW.includes(cur) ? [cur] : []) : PRESETS;      // the owner's own colour stays in sight
  const setAccent = (hex: string) => { const ok = isBright(hex) ? hex : brighten(hex); onAdjusted && onAdjusted(ok.toLowerCase() !== hex.toLowerCase()); edit('businesses', b.id, { accent: ok }, { now: true }); };
  return (
    <div class="dots" role="radiogroup" aria-label={t('look.accent')}>
      {fromLogo && <button type="button" role="radio" class="dot2 dot2-wide" aria-checked={b.accent.toLowerCase() === fromLogo ? 'true' : 'false'} style={{ '--c': fromLogo }} onClick={() => setAccent(fromLogo)} data-accent-logo><span class="sw" /><span>{t('look.accentFromLogo')}</span></button>}
      {shown.map((c) => <button key={c} type="button" role="radio" class="dot2" aria-checked={b.accent.toLowerCase() === c ? 'true' : 'false'} aria-label={COLOR_NAMES[c] ? COLOR_NAMES[c][lang.value === 'he' ? 0 : 1] : t('look.accentCustom')} style={{ '--c': c }} data-accent={c} onClick={() => setAccent(c)}><span class="sw" /></button>)}
      {!few && <label class="dot2 dot2-custom" style={{ '--c': b.accent }} title={t('look.accentCustom')}><span class="sw"><Icon name="plus" size={16} /></span><span class="sr">{t('look.accentCustom')}</span><input type="color" class="sr" value={b.accent} onChange={(e) => setAccent((e.target as HTMLInputElement).value)} /></label>}
    </div>
  );
}

/** The tables as one sideways strip. Every thumbnail is a small file of our own (public/tables), loaded at once: no blank tiles. */
export function TableStrip() {
  const d = D.value!;
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {                                              // bring the chosen table into view: sideways only, the page itself stays where it is
    const box = strip.current, el = box?.querySelector('[aria-checked=true]') as HTMLElement | null;
    if (!box || !el) return;
    const b = box.getBoundingClientRect(), e = el.getBoundingClientRect();
    box.scrollLeft += e.left - b.left - (b.width - e.width) / 2;
  }, []);
  return (
    <div class="strip" role="radiogroup" aria-label={t('look.surface')} ref={strip}>
      {TABLES.map((tb) => (
        <button key={tb.id} type="button" role="radio" class="swatch2" aria-checked={d.menu.surface === tb.id ? 'true' : 'false'} aria-label={tb[lang.value]} title={tb[lang.value]} data-surface={tb.id} onClick={() => edit('menus', d.menu.id, { surface: tb.id }, { now: true })}>
          <span class={'swatch2-img' + (tb.id === 'holo' ? ' is-holo' : '')}>{tb.id !== 'holo' && <img src={'tables/' + tb.id + '.jpg'} alt="" width="84" height="84" decoding="async" />}{d.menu.surface === tb.id && <span class="swatch2-check"><Icon name="check" size={15} /></span>}</span>
        </button>
      ))}
    </div>
  );
}
export const tableName = (id: string) => { const tb = TABLES.find((x) => x.id === id); return tb ? tb[lang.value] : id; };

export function StyleScreen() {
  const d = D.value!, b = d.biz;
  const path = !everPublished();
  const [logoBusy, setLogoBusy] = useState(false), [error, setError] = useState(''), [fromLogo, setFromLogo] = useState<string | null>(null), [adjusted, setAdjusted] = useState(false);
  const [orderUrl, setOrderUrl] = useState(b.order_url || ''), [orderBad, setOrderBad] = useState(false);
  const [bookUrl, setBookUrl] = useState(b.book_url || ''), [bookBad, setBookBad] = useState(false);
  const bookOn = !!cfg!.features.bookUrl;                       // the booking link needs businesses.book_url (db/proposed/0003): sent only when the config says the backend has it
  useEffect(() => { setOrderUrl(D.value!.biz.order_url || ''); setBookUrl(D.value!.biz.book_url || ''); }, [b.id]);

  async function onLogo(e: Event) {
    const input = e.target as HTMLInputElement, file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    setLogoBusy(true); setError('');
    try {
      const png = await resize(file, 512, 'image/png');
      const path2 = `${b.id}/brand/logo-${crypto.randomUUID().slice(0, 13)}.png`;
      await q(sb.storage.from('menu-public').upload(path2, png, { contentType: 'image/png', cacheControl: '31536000' }));
      // the old file stays where it is: a menu that is already published still points at it
      edit('businesses', b.id, { logo_path: path2 }, { now: true });
      setFromLogo(await accentFromImage(png).catch(() => null));
    } catch (err) { const code = toAppError(err).code; setError(code === 'unknown' ? errText('upload') : code === 'bad_image' ? t('pic.e.bad_image') : errText(code)); }
    finally { setLogoBusy(false); }
  }
  const toggleLang = (l: 'he' | 'en') => {
    const has = b.langs.includes(l);
    if (has && b.langs.length === 1) return;
    const langs = has ? b.langs.filter((x: string) => x !== l) : ['he', 'en'].filter((x) => x === l || b.langs.includes(x));
    edit('businesses', b.id, { langs, default_lang: langs.includes(b.default_lang) ? b.default_lang : langs[0] }, { now: true });
  };
  // the ordering link and the booking link: https only, no spaces, up to 300 characters (the database checks the same)
  const onLink = (field: 'order_url' | 'book_url', v: string) => {
    (field === 'order_url' ? setOrderUrl : setBookUrl)(v);
    const bad = field === 'order_url' ? setOrderBad : setBookBad;
    const s = v.trim();
    if (s === '') { bad(false); return edit('businesses', b.id, { [field]: null }); }
    if (!/^https:\/\/[^\s]+\.[^\s]+$/.test(s) || s.length > 300) return bad(true);
    bad(false); edit('businesses', b.id, { [field]: s });
  };
  const setName = (field: 'name_he' | 'name_en', v: string) => {
    const other = field === 'name_he' ? b.name_en : b.name_he;
    if (!v.trim() && !other.trim()) return setError(t('look.nameNeeded'));
    setError(''); edit('businesses', b.id, { [field]: v });
  };

  return (
    <div class={'page page-style' + (path ? ' has-sticky' : '')}>
      <header class="page-head"><h1 tabIndex={-1}>{t('look.title')}</h1></header>
      {error && <Note kind="error">{error}</Note>}

      <section class="blk blk-logo" aria-labelledby="logo-h">
        <span class="logo-box">{b.logo_path ? <img src={publicUrl(b.logo_path)} alt={t('look.logoAlt')} data-logo /> : <Icon name="image" size={28} />}</span>
        <div class="blk-logo-text">
          <h2 id="logo-h">{t('look.logo')}</h2>
          <div class="btnrow">
            <label class={'btn btn-secondary btn-sm' + (logoBusy ? ' is-busy' : '')}>
              {logoBusy ? <span class="spin" aria-hidden="true" /> : <Icon name="image" size={18} />}
              <span class="btn-txt">{b.logo_path ? t('look.logoReplace') : t('look.logoChoose')}</span>
              <input class="sr" type="file" accept="image/png,image/jpeg,image/webp,image/*" data-logo-input disabled={logoBusy} onChange={onLogo} />
            </label>
            {b.logo_path && <Btn small kind="ghost" onClick={() => { edit('businesses', b.id, { logo_path: null }, { now: true }); setFromLogo(null); }}>{t('look.logoRemove')}</Btn>}
          </div>
        </div>
      </section>

      <section class="blk" aria-labelledby="accent-h">
        <h2 id="accent-h">{t('look.accent')}</h2>
        <AccentDots fromLogo={fromLogo} onAdjusted={setAdjusted} />
        {adjusted && <p class="hint" role="status">{t('look.accentAdjusted')}</p>}
      </section>

      <section class="blk" aria-labelledby="surf-h">
        <h2 id="surf-h">{t('look.surface')}<span class="blk-val">{tableName(d.menu.surface)}</span></h2>
        <TableStrip />
      </section>

      <section class="blk" aria-labelledby="langs-h">
        <h2 id="langs-h">{t('look.langs')}</h2>
        <div class="btnrow" role="group" aria-labelledby="langs-h">
          {(['he', 'en'] as const).map((l) => <label key={l} class={'tagchip' + (b.langs.includes(l) ? ' on' : '')}><input type="checkbox" checked={b.langs.includes(l)} disabled={b.langs.includes(l) && b.langs.length === 1} onChange={() => toggleLang(l)} data-lang-toggle={l} /><span>{t(l === 'he' ? 'app.he' : 'app.en')}</span></label>)}
        </div>
        {b.langs.length > 1 && <Field label={t('look.defaultLang')}>{(p) => <select {...p} value={b.default_lang} data-field="default_lang" onChange={(e) => edit('businesses', b.id, { default_lang: (e.target as HTMLSelectElement).value }, { now: true })}><option value="he">{t('app.he')}</option><option value="en">{t('app.en')}</option></select>}</Field>}
      </section>

      <section class="blk" aria-labelledby="place-h">
        <h2 id="place-h">{t('look.place')}</h2>
        <div class="grid2">
          <Field label={t('look.nameHe')}>{(p) => <input {...p} type="text" dir="rtl" lang="he" maxLength={80} value={b.name_he} data-field="name_he" onInput={(e) => setName('name_he', (e.target as HTMLInputElement).value)} />}</Field>
          <Field label={t('look.nameEn')}>{(p) => <input {...p} type="text" dir="ltr" lang="en" maxLength={80} value={b.name_en} data-field="name_en" onInput={(e) => setName('name_en', (e.target as HTMLInputElement).value)} />}</Field>
        </div>
        <p class="fixed-line"><Icon name="link" size={16} /><Ltr class="strong">{shortText(b.slug)}</Ltr><span class="muted">{t('setup.permanent')}</span></p>
        <details class="more"><summary>{t('look.more')}</summary>
          <div class="kinds kinds-sm" role="radiogroup" aria-label={t('setup.kind')}>
            {KINDS.map((k) => <button key={k} type="button" role="radio" aria-checked={b.kind === k ? 'true' : 'false'} class="kind" data-kind={k} onClick={() => edit('businesses', b.id, { kind: k }, { now: true })}><Icon name={k} size={20} /><span>{t('kind.' + k)}</span></button>)}
          </div>
          <div class="grid2">
            {(['he', 'en'] as const).filter((l) => b.langs.includes(l)).map((l) => <Field key={'a' + l} label={`${t('look.area')} · ${t(l === 'he' ? 'app.he' : 'app.en')}`} optional>{(p) => <input {...p} type="text" dir={l === 'he' ? 'rtl' : 'ltr'} maxLength={80} value={b['area_' + l]} data-field={'area_' + l} onInput={(e) => edit('businesses', b.id, { ['area_' + l]: (e.target as HTMLInputElement).value })} />}</Field>)}
            {(['he', 'en'] as const).filter((l) => b.langs.includes(l)).map((l) => <Field key={'c' + l} label={`${t('look.cuisine')} · ${t(l === 'he' ? 'app.he' : 'app.en')}`} optional>{(p) => <input {...p} type="text" dir={l === 'he' ? 'rtl' : 'ltr'} maxLength={80} value={b['cuisine_' + l]} data-field={'cuisine_' + l} onInput={(e) => edit('businesses', b.id, { ['cuisine_' + l]: (e.target as HTMLInputElement).value })} />}</Field>)}
          </div>
        </details>
      </section>

      <section class="blk" aria-labelledby="contact-h">
        <h2 id="contact-h">{t('look.contact')}</h2>
        <div class="grid2">
          <Field label={t('look.orderUrl')} optional error={orderBad ? t('look.orderUrlBad') : undefined}>{(p) => <input {...p} type="url" dir="ltr" inputMode="url" maxLength={300} placeholder="https://" value={orderUrl} data-field="order_url" onInput={(e) => onLink('order_url', (e.target as HTMLInputElement).value)} />}</Field>
          {bookOn && <Field label={t('look.bookUrl')} optional hint={t('look.bookUrlHint')} error={bookBad ? t('look.orderUrlBad') : undefined}>{(p) => <input {...p} type="url" dir="ltr" inputMode="url" maxLength={300} placeholder="https://" value={bookUrl} data-field="book_url" onInput={(e) => onLink('book_url', (e.target as HTMLInputElement).value)} />}</Field>}
          <Field label={t('look.phone')} optional>{(p) => <input {...p} type="tel" dir="ltr" inputMode="tel" maxLength={40} value={b.phone || ''} data-field="phone" onInput={(e) => edit('businesses', b.id, { phone: (e.target as HTMLInputElement).value.trim() || null })} />}</Field>
        </div>
      </section>

      {path && <Sticky><Btn kind="primary" block onClick={() => go('publish')} data-next="publish">{t('look.backToPublish')}</Btn></Sticky>}
    </div>
  );
}
