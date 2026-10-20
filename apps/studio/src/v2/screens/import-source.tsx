// Bringing the menu (F03 step 2, D33), four ways, each one import (`create_import`):
// - a pasted list, and the text the owner copied from their own Wolt page: read here on the phone (@mana/import's
//   readers; no network, no cost), then stored with `save_import_draft`;
// - the owner's own Wolt screenshots, and photos of a printed menu: uploaded to the import's private folder, then read by
//   the scanner. Where the scanner is not available, the screen says so plainly and offers the two text ways.
// Mana never opens Wolt: the owner brings what they copied or photographed. No dish photo comes from Wolt in phase 1:
// each dish shows "no photo yet" (or its illustration) until the owner adds one. The same input imported again finds
// the earlier import (`reused`), so nothing is read or stored twice.
import { useEffect, useRef, useState } from 'preact/hooks';
import { IMPORT_SOURCES, IMPORT_TEXT_MAX, oneOf, textLength, type ImportSource } from '@mana/contracts';
import { Btn, Field, Icon, Loading, Note, go } from '../../ui.tsx';
import { toV2Error, V2Error } from '../data/errors.ts';
import { imagesMax, isEmptyDraft, isTextSource, readText, type ImageSource, type TextSource } from '../data/imports.ts';
import { checkScanner, createImageImport, importApi, keepNotes, loadImports, prepareImage, runScan, saveTextDraft, scanner, type Prepared } from '../data/onboarding.ts';
import { newId } from '../data/rows.ts';
import { menu } from '../data/store.ts';
import { errText, lang, t, tn } from '../i18n.ts';

const ICON: Readonly<Record<ImportSource, string>> = { paste: 'paste', wolt_text: 'copy', wolt_screenshots: 'image', scan: 'camera' };
const ORDER: readonly ImportSource[] = ['wolt_text', 'wolt_screenshots', 'scan', 'paste'];

/** The four ways in, as cards; the two that need the scanner say so when it is not here. */
export function SourceCards() {
  useEffect(() => { void checkScanner(); }, []);
  const off = scanner.value === 'off';
  return (
    <section class="card" aria-labelledby="src-h" data-sources>
      <h2 id="src-h">{t('ob.src.title')}</h2>
      <ul class="srclist">
        {ORDER.map((s) => (
          <li key={s}>
            <a class="srccard" href={'#/onboarding/menu/' + s} data-source={s} data-available={!isTextSource(s) && off ? 'no' : 'yes'}>
              <Icon name={ICON[s]} size={24} />
              <span class="srccard-text"><span class="strong">{t('ob.src.' + s)}</span><span class="fine">{!isTextSource(s) && off ? t('ob.scan.off.short') : t('ob.src.' + s + '.sub')}</span></span>
              <Icon name="chev" size={18} flip />
            </a>
          </li>
        ))}
      </ul>
      <p class="fine" data-never-wolt>{t('ob.src.neverWolt')}</p>
    </section>
  );
}

export function SourceScreen({ source }: { source: string }) {
  useEffect(() => { if (!oneOf(IMPORT_SOURCES, source)) go('onboarding/menu', true); }, [source]);
  if (!oneOf(IMPORT_SOURCES, source)) return null;
  return (
    <div class="srcscreen" data-source-screen={source}>
      <a class="backlink" href="#/onboarding/menu"><Icon name="chev" size={16} back />{t('ob.src.title')}</a>
      <h2 class="srcscreen-h">{t('ob.src.' + source)}</h2>
      {isTextSource(source) ? <TextImport key={source} source={source} /> : <ImageImport key={source} source={source} />}
    </div>
  );
}

/** After create_import: the same input as an earlier import leads to it; a new one goes on. */
function reusedTarget(r: { importId: string; status: string; reused: boolean }): 'review' | 'applied' | 'go_on' {
  if (!r.reused) return 'go_on';
  if (r.status === 'parsed') return 'review';
  if (r.status === 'applied') return 'applied';
  return 'go_on';
}

/** The same input was imported and applied before: nothing to read again. */
function AlreadyIn({ importId }: { importId: string }) {
  return (
    <Note kind="ok" title={t('ob.src.already.title')} action={<Btn small onClick={() => go('onboarding/review/' + importId)} data-action="see-import">{t('ob.src.already.see')}</Btn>}>
      {t('ob.src.already.body')}
    </Note>
  );
}

// ---------------------------------------------------------------- text: a list, or the owner's Wolt page copied
function TextImport({ source }: { source: TextSource }) {
  const d = menu.value!;
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [applied, setApplied] = useState<string | null>(null);
  const n = textLength(text);
  async function read(e: Event) {
    e.preventDefault();
    if (busy) return;
    setError(''); setApplied(null);
    setBusy(true);
    try {
      const reading = readText(source, text);
      if (isEmptyDraft(reading.draft)) throw new V2Error('nothing_read');
      const made = await importApi.create({ venueId: d.venue.id, source, text, rightsConfirmed: false });
      const where = reusedTarget(made);
      if (where === 'applied') { setApplied(made.importId); return; }
      if (where === 'go_on') await saveTextDraft(made.importId, reading.draft, reading.notes);
      else keepNotes(made.importId, reading.notes);
      await loadImports().catch(() => {});
      go('onboarding/review/' + made.importId);
    } catch (err) { setError(errText(toV2Error(err).code, 'ob.src.e')); }
    finally { setBusy(false); }
  }
  return (
    <form class="card srcform" onSubmit={read} noValidate data-text-import={source}>
      {source === 'wolt_text'
        ? <>
          <p data-d33>{t('ob.wolt.never')}</p>
          <ol class="howto"><li>{t('ob.wolt.how1')}</li><li>{t('ob.wolt.how2')}</li><li>{t('ob.wolt.how3')}</li></ol>
        </>
        : <>
          <p>{t('ob.paste.how')}</p>
          <pre class="example" dir="auto" aria-label={t('ob.paste.example')}>{t('ob.paste.sample')}</pre>
        </>}
      <Field label={t(source === 'wolt_text' ? 'ob.wolt.field' : 'paste.field')} hint={t('ob.src.count', { n: n.toLocaleString(lang.value === 'he' ? 'he-IL' : 'en-GB'), max: IMPORT_TEXT_MAX.toLocaleString(lang.value === 'he' ? 'he-IL' : 'en-GB') })}>{(p) => (
        <textarea {...p} dir="auto" rows={12} value={text} data-field="import-text" onInput={(e) => { setText((e.target as HTMLTextAreaElement).value); setError(''); }} />
      )}</Field>
      {applied && <AlreadyIn importId={applied} />}
      {error && <Note kind="error">{error}</Note>}
      <Btn type="submit" kind="primary" block busy={busy} disabled={!text.trim() || n > IMPORT_TEXT_MAX} icon="scan" data-action="read-text">{t('ob.src.read')}</Btn>
      <p class="fine">{t('ob.src.nothingSaved')}</p>
    </form>
  );
}

// ---------------------------------------------------------------- pictures: the owner's Wolt screenshots, or a printed menu
type Chosen = { readonly key: string; readonly file: File; readonly url: string };

function ImageImport({ source }: { source: ImageSource }) {
  useEffect(() => { void checkScanner(); }, []);
  const s = scanner.value;
  if (s === 'unknown' || s === 'checking') return <Loading />;
  if (s === 'off') {
    return (
      <section class="card" data-scanner="off">
        <Note kind="info" title={t('ob.scan.off.title')}>{t('ob.scan.off.body')}</Note>
        <div class="flow-actions">
          <Btn kind="primary" block icon="copy" onClick={() => go('onboarding/menu/wolt_text')} data-action="use-wolt-text">{t('ob.src.wolt_text')}</Btn>
          <Btn block icon="paste" onClick={() => go('onboarding/menu/paste')} data-action="use-paste">{t('ob.src.paste')}</Btn>
        </div>
      </section>
    );
  }
  return <Pictures source={source} />;
}

function Pictures({ source }: { source: ImageSource }) {
  const d = menu.value!;
  const max = imagesMax(source);
  const [chosen, setChosen] = useState<Chosen[]>([]);
  const [busy, setBusy] = useState<'' | 'preparing' | 'uploading' | 'reading'>(''), [error, setError] = useState('');
  const [applied, setApplied] = useState<string | null>(null);
  // the import's id is made once and kept, so trying again after a lost answer uploads into the same folder
  const importId = useRef(newId());
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { for (const c of chosen) URL.revokeObjectURL(c.url); }, []);
  function add(files: FileList | null) {
    if (!files) return;
    setError('');
    const room = max - chosen.length;
    const list = [...files];
    if (list.length > room) setError(t('ob.src.e.too_many', { n: max }));
    const more = list.slice(0, Math.max(0, room)).map((file) => ({ key: newId(), file, url: URL.createObjectURL(file) }));
    setChosen([...chosen, ...more]);
    importId.current = newId();                                    // other pictures: another input
  }
  function remove(key: string) {
    const c = chosen.find((x) => x.key === key); if (c) URL.revokeObjectURL(c.url);
    setChosen(chosen.filter((x) => x.key !== key));
    importId.current = newId();
  }
  async function read() {
    if (busy || !chosen.length) return;
    setError(''); setApplied(null);
    try {
      setBusy('preparing');
      const ready: Prepared[] = [];
      for (const [i, c] of chosen.entries()) {
        try { ready.push(await prepareImage(c.file)); }
        catch (e) { throw new V2Error(toV2Error(e).code, { picture: i + 1 }); }
      }
      setBusy('uploading');
      const made = await createImageImport(source, importId.current, ready);
      const where = reusedTarget(made);
      if (where === 'applied') { setApplied(made.importId); return; }
      if (where === 'review') { await loadImports().catch(() => {}); go('onboarding/review/' + made.importId); return; }
      setBusy('reading');
      const r = await runScan(source, made.importId);
      await loadImports().catch(() => {});
      if (!r.ok) throw new V2Error(r.code);
      keepNotes(made.importId, r.notes);
      go('onboarding/review/' + made.importId);
    } catch (e) {
      const err = toV2Error(e);
      const at = (err.detail as { picture?: number } | null)?.picture;
      const words = errText(err.code, 'ob.scan.e');
      setError(at ? t('ob.src.e.picture', { n: at }) + ' ' + words : words);
    } finally { setBusy(''); }
  }
  return (
    <section class="card srcform" data-image-import={source}>
      {source === 'wolt_screenshots'
        ? <>
          <p data-d33>{t('ob.shots.never')}</p>
          <ol class="howto"><li>{t('ob.shots.how1')}</li><li>{t('ob.shots.how2')}</li></ol>
          <p class="fine" data-no-wolt-photos>{t('ob.shots.photos')}</p>
        </>
        : <p>{t('ob.scan.how')}</p>}
      <input ref={input} id="import-files" class="sr" type="file" accept="image/*" multiple data-field="import-files"
        onChange={(e) => { add((e.target as HTMLInputElement).files); (e.target as HTMLInputElement).value = ''; }} />
      {chosen.length < max && <Btn icon={source === 'scan' ? 'camera' : 'image'} onClick={() => input.current?.click()} data-action="choose-pictures">{t('ob.src.choose')}</Btn>}
      <p class="fine" aria-live="polite" data-chosen={chosen.length}>{t('ob.src.chosen', { n: chosen.length, max })}</p>
      {chosen.length > 0 && (
        <ul class="thumbs">
          {chosen.map((c, i) => (
            <li key={c.key}>
              <img src={c.url} alt={t('ob.src.pictureN', { n: i + 1 })} />
              <button type="button" class="iconbtn" aria-label={t('ob.src.removeN', { n: i + 1 })} onClick={() => remove(c.key)} disabled={!!busy}><Icon name="x" size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      {applied && <AlreadyIn importId={applied} />}
      {error && <Note kind="error">{error}</Note>}
      {busy && <p class="muted" role="status"><span class="spin spin-sm" aria-hidden="true" /> {t('ob.src.busy.' + busy)}</p>}
      <Btn kind="primary" block busy={!!busy} disabled={!chosen.length} icon="scan" onClick={read} data-action="read-pictures">{tn('ob.src.readN', chosen.length)}</Btn>
      <p class="fine">{t('ob.src.nothingSaved')}</p>
    </section>
  );
}
