// Run by old-safari.test.ts in its own process: the JavaScript of Safari and iOS 15.0 (no regular-expression
// lookbehind, no `Object.hasOwn`, no `crypto.randomUUID`, no `Array.prototype.at` / `findLast`, no `structuredClone`),
// then every module of the readers loaded and every reader run (old-safari.work.ts). Prints one JSON line; any throw
// fails the parent test. A regular-expression literal is not built by the RegExp constructor: the parent's scan of the
// sources covers those.
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
const modules: string[] = [];
for (const f of fs.readdirSync(src).filter((n) => n.endsWith('.ts')).sort()) { await import(pathToFileURL(path.join(src, f)).href); modules.push(f); }
const { work } = await import('./old-safari.work.ts');
console.log(JSON.stringify({ modules: modules.length, out: work() }));
