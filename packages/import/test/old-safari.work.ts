// What old-safari.test.ts runs twice, in this Node and in a child with old Safari's JavaScript: every reader on the
// fixtures, and the price rules on lines that once needed a lookbehind. Returns plain data to compare.
import { classifyPasteLine, classifyWoltLine, fromScanEvents, mergeDrafts, parsePaste, parseWoltText, readPrice, readScanReply, scanDraft, scanPrompt, splitPrice } from '../src/index.ts';
import { hasMoney } from '../src/price.ts';
import { PASTE_EN, PASTE_MIXED, REPLY_MENU, REPLY_WOLT, SCAN_EVENTS, WOLT_EN_PAGE, WOLT_EN_SHEET, WOLT_HE_PAGE, WOLT_HE_SHEET } from './fixtures.ts';

export function work(): unknown {
  const ctx = { langs: ['he', 'en'] as const, stock: [{ id: 'schnitzel', label: 'schnitzel' }], truncated: false };
  const wolt = parseWoltText(`${WOLT_EN_PAGE}\n${WOLT_EN_SHEET}`);
  const woltHe = parseWoltText(`${WOLT_HE_PAGE}\n${WOLT_HE_SHEET}`);
  const scan = scanDraft('scan_menu', [readScanReply(REPLY_MENU, { ...ctx, page: 1 })]);
  const shots = scanDraft('wolt_screenshots', [readScanReply(REPLY_WOLT, { ...ctx, page: 1 })]);
  const lines = ['Cocktails', 'Lentils 32', 'Tennis', 'NIS 42', '42 NIS', 'ILS 9.90', '42 ש"ח', 'Soup 30 ש"ח', '₪ 4O', 'Kids burger ₪ 4O', 'Snails ₪56.00'];
  return {
    wolt: wolt.draft, woltNotes: wolt.notes, woltHe: woltHe.draft,
    paste: [parsePaste(PASTE_MIXED).draft, parsePaste(PASTE_EN).draft, parsePaste('Mains\n64 Schnitzel\nבירה 28\nBeer\n\nCocktails\nPaloma 44').notes],
    scan: [scan.draft, shots.draft, fromScanEvents(SCAN_EVENTS).draft],
    merged: mergeDrafts([wolt.draft, parseWoltText(WOLT_EN_PAGE).draft]).draft,
    prompt: scanPrompt('scan_menu', ['he', 'en'], ctx.stock, 2).length,
    lines: lines.map((l) => [readPrice(l, true), splitPrice(l, true), classifyPasteLine(l)?.rule, classifyWoltLine(l).rule, hasMoney(l)]),
  };
}
