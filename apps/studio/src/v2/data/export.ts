// The owner's menu, any time (F08 "export"): export_menu's reply (MenuExport, @mana/contracts) as the JSON file it is,
// and as a readable CSV for a spreadsheet: one row per dish, then one row per add-on choice under it (a nested group's
// choices under the choice that opens it), with both languages side by side and prices in shekels. Built in the
// browser from the reply; no server file. Pure: the screens add the download.
import type { AddonGroupRow, AddonOptionRow, MenuExport } from '@mana/contracts';
import { ruleLine } from '../format.ts';
import { t } from '../i18n.ts';

/** Agorot as a plain number of shekels with two decimals ("62.00"), as a spreadsheet sums it; null is no price. */
export const shekelCell = (agorot: number | null): string => (agorot === null ? '' : (agorot / 100).toFixed(2));

/**
 * One CSV field (RFC 4180): quoted when it holds a comma, a quote or a line break, a quote doubled. Text a spreadsheet
 * would run as a formula (starting with = + - @, a tab or a return) is kept as text with a leading apostrophe.
 */
export function csvCell(v: string, { text = true } = {}): string {
  const s = text && /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Lines end with CRLF (RFC 4180); the byte order mark lets Excel read Hebrew as UTF-8. */
export const csvOf = (rows: readonly (readonly string[])[]): string => '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n') + '\r\n';

type Cell = { readonly v: string; readonly text?: boolean };
const tx = (v: string): Cell => ({ v });
const nb = (v: string): Cell => ({ v, text: false });

/** The CSV of a menu export: headings in the owner's language, then sections, dishes and their add-ons in menu order. */
export function menuCsv(x: MenuExport): string {
  const T = x.tables;
  const lang = (k: string, l: 'he' | 'en') => `${t(k)} (${t('app.' + l)})`;
  const head = [
    lang('csv.section', 'he'), lang('csv.section', 'en'), lang('csv.dish', 'he'), lang('csv.dish', 'en'), t('csv.price'),
    lang('csv.group', 'he'), lang('csv.group', 'en'), t('csv.choose'), lang('csv.choice', 'he'), lang('csv.choice', 'en'), t('csv.choicePrice'), t('csv.hidden'),
  ];
  const groups = new Map<string, AddonGroupRow>(T.addon_groups.map((g) => [g.id, g]));
  const optionsOf = (groupId: string): AddonOptionRow[] => T.addon_options.filter((o) => o.group_id === groupId);
  const rows: Cell[][] = [];

  for (const s of T.sections) {
    for (const d of T.dishes.filter((x) => x.section_id === s.id)) {
      const hidden = s.hidden || d.hidden ? t('csv.yes') : '';
      const base = [tx(s.name_he), tx(s.name_en), tx(d.name_he), tx(d.name_en)];
      rows.push([...base, nb(shekelCell(d.price)), tx(''), tx(''), tx(''), tx(''), tx(''), tx(''), tx(hidden)]);
      const choiceRows = (g: AddonGroupRow, min: number, max: number, path: { he: string; en: string } | null) => {
        const gname = { he: path ? `${path.he} › ${g.name_he}` : g.name_he, en: path ? `${path.en} › ${g.name_en}` : g.name_en };
        for (const o of optionsOf(g.id)) {
          rows.push([...base, nb(''), tx(gname.he), tx(gname.en), tx(ruleLine(min, max)), tx(o.name_he), tx(o.name_en), nb(shekelCell(o.price)), tx(hidden)]);
          const nested = !path && o.opens_group_id ? groups.get(o.opens_group_id) : undefined;
          if (nested) choiceRows(nested, nested.min_units, nested.max_units, { he: o.name_he, en: o.name_en });
        }
      };
      for (const link of T.dish_addon_groups.filter((l) => l.dish_id === d.id)) {
        const g = groups.get(link.group_id);
        if (g) choiceRows(g, link.min_units ?? g.min_units, link.max_units ?? g.max_units, null);
      }
    }
  }
  return csvOf([head.map((h) => csvCell(h)), ...rows.map((r) => r.map((c) => csvCell(c.v, { text: c.text !== false })))]);
}

/** "bistro-sim-menu-2026-10-16.json": the place's address, then the export's own day (UTC, as it says). */
export const exportFileName = (x: Pick<MenuExport, 'venue' | 'exportedAt'>, ext: 'json' | 'csv'): string =>
  `${x.venue.slug}-menu-${x.exportedAt.slice(0, 10)}.${ext}`;

/** The JSON file: the reply exactly, indented for a person. */
export const menuJson = (x: MenuExport): string => JSON.stringify(x, null, 2) + '\n';
