/**
 * @mana/import: the menu readers of ADR-006. Each turns what the owner brings into an `ImportDraft` of
 * @mana/contracts that passes `validateDraft`, plus notes on the source (what was left out, what to check):
 * - `parsePaste(text)`: a typed or pasted menu (source `paste`);
 * - `parseWoltText(text)`: text copied from the owner's own Wolt page (source `wolt_text`; D33: nothing is fetched);
 * - `fromScanEvents(events)`: the v1 scanner's NDJSON events (source `scan`);
 * - `readScanReply` / `scanDraft`: the v2 scanner's model answers (sources `scan`, `wolt_screenshots`), with its prompt;
 * - `mergeDrafts(drafts)`: one draft from overlapping drafts of the same menu.
 * Pure: no network, no model, no cost. Runs in browsers, in Node 22.18+ and in Deno (the scanner) as it is.
 */
export { buildDraft, draftModel, mergeDrafts, nameIdentity, type Reading, type ReadResult } from './build.ts';
export { contractNote, NOTE_CODES, NOTE_LINES_MAX, NOTES, NOTES_MAX, type NoteCode, type NoteSeverity, type ReaderNote } from './notes.ts';
export { amount, readOptionPrice, readPrice, splitPrice, type PriceRead } from './price.ts';
export { guessKind, readRule, ruleLimits, type GroupRule } from './rules.ts';
export { classifyPasteLine, parsePaste, type PasteToken } from './paste.ts';
export { classifyWoltLine, parseWoltText, type WoltToken } from './wolt-text.ts';
export { fromScanEvents, type ScanEventV1 } from './scan-events.ts';
export { MODE_SOURCE, readScanReply, SCAN_MODES, scanDraft, scanPrompt, scanSystem, type PageReading, type ScanMode, type StockHint } from './scan.ts';
