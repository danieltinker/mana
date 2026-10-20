// Run by old-safari.test.ts in its own process: the JavaScript of Safari and iOS 15.0 (no regular-expression
// lookbehind, no `Object.hasOwn`, no `crypto.randomUUID`, no `Array.prototype.at` / `findLast`, no `structuredClone`),
// then every contract module loaded and used. Prints one JSON line; any throw fails the parent test.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const NativeRegExp = RegExp;
const OldRegExp = function (this: unknown, pattern: string | RegExp, flags?: string) {
  const source = pattern instanceof NativeRegExp ? pattern.source : String(pattern);
  if (/\(\?<[=!]/.test(source)) throw new SyntaxError('Invalid regular expression: invalid group specifier name');
  return new.target ? new NativeRegExp(pattern, flags) : NativeRegExp(pattern, flags);
} as unknown as RegExpConstructor;
(OldRegExp as { prototype: unknown }).prototype = NativeRegExp.prototype;
Object.setPrototypeOf(OldRegExp, NativeRegExp);
globalThis.RegExp = OldRegExp;
delete (Object as { hasOwn?: unknown }).hasOwn;
delete (Array.prototype as { at?: unknown }).at;
delete (Array.prototype as { findLast?: unknown }).findLast;
delete (Array.prototype as { findLastIndex?: unknown }).findLastIndex;
delete (String.prototype as { at?: unknown }).at;
delete (globalThis as { structuredClone?: unknown }).structuredClone;
delete (Object.getPrototypeOf(globalThis.crypto) as { randomUUID?: unknown }).randomUUID;
if (typeof (Object as { hasOwn?: unknown }).hasOwn !== 'undefined' || typeof globalThis.crypto.randomUUID !== 'undefined') throw new Error('not old enough');

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const modules: Record<string, Record<string, unknown>> = {};
for (const f of fs.readdirSync(src).filter((n) => n.endsWith('.ts')).sort()) modules[f] = await import(pathToFileURL(path.join(src, f)).href);

const c = await import('../src/index.ts');
const { bistroDraft } = await import('./import-fixtures.ts');
const flags = c.configFlags({ env: 'demo', schema: 2, realtime: false });
const draft = c.validateDraft(bistroDraft());
const id = c.newEventId();
const event = c.validateEvent({ id, venueId: id, name: 'menu_opened', at: new Date(Date.now()).toISOString(), props: { src: 'qr', lang: 'he', revision: 1 } });
const extra = c.validateEvent({ id, venueId: id, name: 'menu_opened', at: new Date(Date.now()).toISOString(), props: { src: 'qr', lang: 'he', revision: 1, toString: 1 } });
console.log(JSON.stringify({
  modules: Object.keys(modules).length,
  flags: [flags.env, flags.schema, flags.realtime, flags.issues.length],
  draft: draft.ok,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id),
  event: event.ok,
  extra: extra.ok ? [] : extra.errors.map((e) => `${e.code}@${e.path}`),
  keys: [c.importKey('צ\'יפס'), c.importKey('צ׳יפס'), c.importKey('Rock\'n\'roll'), c.importKey('א\'\'ב')],
  storable: ['ok', 'a\uD83C', '\uDF54b', 'a\u0000', '🍔'].map((s) => c.isStorableText(s)),
}));
