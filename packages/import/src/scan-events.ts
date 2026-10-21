/**
 * `fromScanEvents(events)`: what the v1 scanner (`functions/menus-ai`, live in production) streams as NDJSON for one
 * or more pages, as a draft with source `scan`. Pages are separated by their `start` events; a section that continues
 * on the next page is merged by `buildDraft`.
 *
 * The v1 scanner fills the language the menu does not print with a translation, without saying which: every
 * language other than the page's printed one (`lang`) counts as translated, and both do when the page's language is
 * "other" or unknown. The owner checks them (`translation_check`). It reads no option groups and no allergens.
 */
import { isInt, isObject, isString, LANGS, LIMITS, SECTION_KINDS, TAGS, type Lang, type SectionKind, type Tag, type Text } from '@mana/contracts';
import { buildDraft, type ReadResult } from './build.ts';
import { DEFAULT_SECTION_NAME, newDish, newSection, type MSection } from './model.ts';
import { NoteBook } from './notes.ts';

/** The v1 scanner's events (`functions/menus-ai/index.ts`, `apps/studio/src/lib/ai.ts`). */
export type ScanEventV1 =
  | { readonly t: 'start' }
  | { readonly t: 'lang'; readonly v: string }
  | { readonly t: 'cat'; readonly he: string; readonly en: string; readonly kind: string }
  | {
    readonly t: 'item'; readonly he: string; readonly en: string; readonly dhe: string; readonly den: string; readonly price_minor: number | null;
    readonly note_he: string; readonly note_en: string; readonly tags: readonly string[]; readonly stock: string | null;
  }
  | { readonly t: 'done'; readonly truncated: boolean }
  | { readonly t: 'error'; readonly code: string };

const str = (v: unknown): string => (isString(v) ? v : '');

/** Reads the v1 scanner's events (parsed NDJSON lines; anything else in the list is skipped) into a draft. */
export function fromScanEvents(events: readonly unknown[]): ReadResult {
  const book = new NoteBook();
  const sections: MSection[] = [];
  let section: MSection | null = null;
  let page = 0, printed: Lang | null = null, itemsOnPage = 0, dropped = 0;
  const translatedOf = (...texts: Text[]): Lang[] => LANGS.filter((l) => l !== printed && texts.some((t) => t[l] !== ''));

  for (const e of events) {
    if (!isObject(e) || !isString(e.t)) { dropped += 1; continue; }
    switch (e.t) {
      case 'start':
        page += 1; printed = null; itemsOnPage = 0; section = null;
        break;
      case 'lang':
        printed = e.v === 'he' || e.v === 'en' ? e.v : null;
        break;
      case 'cat': {
        const name = { he: str(e.he), en: str(e.en) };
        const kind = (SECTION_KINDS as readonly string[]).includes(str(e.kind)) ? (e.kind as SectionKind) : 'food';
        section = newSection(name, kind, { translated: translatedOf(name) });
        sections.push(section);
        break;
      }
      case 'item': {
        if (!section) { section = newSection(DEFAULT_SECTION_NAME, 'food'); sections.push(section); }
        const name = { he: str(e.he), en: str(e.en) }, desc = { he: str(e.dhe), en: str(e.den) };
        const price = isInt(e.price_minor) && e.price_minor >= 0 && e.price_minor <= LIMITS.price ? e.price_minor : null;
        const tags = Array.isArray(e.tags) ? TAGS.filter((t: Tag) => (e.tags as unknown[]).includes(t)) : [];
        section.dishes.push(newDish(name, {
          desc, translated: translatedOf(name, desc), price, priceNote: { he: str(e.note_he), en: str(e.note_en) }, tags,
          illustration: isString(e.stock) ? e.stock : null,
        }));
        itemsOnPage += 1;
        break;
      }
      case 'done':
        if (e.truncated === true) book.add('page_truncated', [Math.max(page, 1)]);
        break;
      case 'error':
        if (itemsOnPage === 0) book.add('page_unreadable', [Math.max(page, 1)]);
        break;
      default:
        dropped += 1;
    }
  }
  if (events.length === 0) book.add('empty_input', [], { count: 1 });
  return buildDraft('scan', [{ model: { sections }, notes: book.list(), dropped }]);
}
