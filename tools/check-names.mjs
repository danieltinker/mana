#!/usr/bin/env node
/* The name guard: no tracked or new text file, no commit of this branch (origin/main..HEAD: messages and patches) and
   not the name of the branch being pushed may hold a forbidden name (the mock client's, in every spelling).

   The names are never in the repository, not even as hashes (a short name's hash reverses): they are read from a file
   outside git, MANA_FORBIDDEN_NAMES_FILE if it is set, else private/forbidden-names.txt (git-ignored). One name per
   line, any script; # starts a comment. Without that file the check says so in one line and passes: it is a local
   guard, run before every push on a machine that has the list. Findings name the file and line, never the name.

   Text is read the way a person would read it: JSON \uXXXX escapes, HTML entities and %XX are decoded, format
   characters (zero-width, soft hyphen, bidi marks) are dropped, then NFKD, accents and points dropped, lower case,
   Hebrew final letters folded, letters only. A name matches as its words in a row (across a line break, a hyphen, an
   underscore) or written as one word (camel case); a pair that shares only one word with it does not.

     node --test tools/check-names.mjs        (tools/test-all.mjs: the "names" suite)
   The pushed branch's name: the current branch and its upstream; with a detached HEAD, set MANA_PUSH_BRANCH. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './env.mjs';

/** Where the list is: MANA_FORBIDDEN_NAMES_FILE, else private/forbidden-names.txt. */
export const listFile = (env = process.env) => env.MANA_FORBIDDEN_NAMES_FILE || path.join(ROOT, 'private/forbidden-names.txt');

const ENTITIES = { nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", shy: '', zwj: '', zwnj: '', lrm: '', rlm: '' };
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const codePoint = (n) => { try { return String.fromCodePoint(n); } catch { return ' '; } };

/** What a reader sees: escapes and entities decoded, format characters dropped. */
export function decode(s) {
  return s
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})/g, (m, a, b) => codePoint(parseInt(a ?? b, 16)))
    .replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (m, e) => {
      if (e[0] === '#') return codePoint(/^#[xX]/.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      const accented = /^([A-Za-z])(acute|grave|circ|uml|tilde|cedil|ring|slash|caron)$/.exec(e);
      return accented ? accented[1] : ENTITIES[e.toLowerCase()] ?? ' ';
    })
    .replace(/(?:%[0-9a-fA-F]{2})+/g, (m) => { try { return decodeURIComponent(m); } catch { return m; } })
    .replace(/\p{Cf}/gu, '');
}
/** A line's words: decoded, NFKD, accents and points dropped, lower case, Hebrew finals folded, letters only. */
export const wordsOf = (s) => (decode(s).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[ךםןףץ]/g, (c) => FINALS[c]).match(/\p{L}+/gu) ?? []);

/** The names in a list file's text: [{ words, joined }] (a blank line or a # comment is skipped). */
export function parseList(text) {
  return text.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean).map((l) => wordsOf(l)).filter((w) => w.length)
    .map((words) => ({ words, joined: words.length > 1 ? words.join('') : null }));
}

/** The lines of `text` that hold a listed name: [{ line, entry }] (the name's place in the list, never the name). */
export function findNames(text, names) {
  const out = [], longest = Math.max(1, ...names.map((n) => n.words.length));
  let recent = [];                                          // the last words read, across lines: { w, line }
  text.split('\n').forEach((s, i) => {
    for (const w of wordsOf(s)) {
      recent.push({ w, line: i + 1 });
      if (recent.length > longest) recent = recent.slice(-longest);
      names.forEach((n, entry) => {
        const k = n.words.length, tail = recent.slice(-k);
        if (tail.length === k && tail.every((x, j) => x.w === n.words[j])) out.push({ line: tail[0].line, entry });
        if (n.joined && w === n.joined) out.push({ line: i + 1, entry });
      });
    }
  });
  return out;
}

const git = (args, cwd = ROOT) => spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 30 });
/** The file's text, or null for a binary file (a NUL byte in its first 8 KB) or one that is gone. */
function readText(file) {
  let fd; try { fd = fs.openSync(file, 'r'); } catch { return null; }
  try { const head = Buffer.alloc(8192), n = fs.readSync(fd, head, 0, head.length, 0); if (head.subarray(0, n).includes(0)) return null; } finally { fs.closeSync(fd); }
  return fs.readFileSync(file, 'utf8');
}
/** The names of the branch being pushed: MANA_PUSH_BRANCH, the current branch and its upstream (none on a detached HEAD). */
export function pushedBranches(env = process.env, cwd = ROOT) {
  const out = env.MANA_PUSH_BRANCH ? [env.MANA_PUSH_BRANCH] : [];
  const head = git(['symbolic-ref', '--short', '-q', 'HEAD'], cwd).stdout.trim();
  if (head) {
    out.push(head);
    const up = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], cwd);
    if (up.status === 0 && up.stdout.trim()) out.push(up.stdout.trim());
  }
  return out;
}

const FILE = listFile(), NAMES = fs.existsSync(FILE) ? parseList(fs.readFileSync(FILE, 'utf8')) : null;
if (!NAMES?.length) {
  console.log(`names: no forbidden-names list (${process.env.MANA_FORBIDDEN_NAMES_FILE ? 'MANA_FORBIDDEN_NAMES_FILE' : 'private/forbidden-names.txt'} is ${NAMES ? 'empty' : 'not there'}): nothing to check here; the machines that push have it`);
} else {
  test('no tracked or new text file holds a forbidden name', () => {
    const r = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
    assert.equal(r.status, 0, 'git ls-files: the check needs a git checkout');
    const found = [];
    let read = 0;
    for (const f of r.stdout.split('\0').filter(Boolean)) {
      const s = readText(path.join(ROOT, f)); if (s === null) continue; read++;
      for (const x of findNames(s, NAMES)) found.push(`${f}:${x.line}: forbidden name #${x.entry + 1}`);
    }
    assert.ok(read > 100, 'the repository\'s text files were read');
    assert.deepEqual(found, []);
  });

  test('no commit of this branch holds one (origin/main..HEAD: messages and patches)', (t) => {
    if (git(['rev-parse', '--verify', '-q', 'origin/main']).status !== 0) return t.skip('no origin/main here (not a clone with its remote)');
    const log = git(['log', '-p', '--format=commit %H%n%B', 'origin/main..HEAD']);
    assert.equal(log.status, 0, log.stderr);
    const lines = log.stdout.split('\n'), commitAt = (n) => { for (let i = n - 1; i >= 0; i--) if (/^commit [0-9a-f]{40}$/.test(lines[i])) return lines[i].slice(7, 14); return '?'; };
    assert.deepEqual(findNames(log.stdout, NAMES).map((x) => `commit ${commitAt(x.line)}: forbidden name #${x.entry + 1}`), []);
  });

  test('the branch being pushed is not named after one', (t) => {
    const branches = pushedBranches();
    if (!branches.length) return t.skip('a detached HEAD: set MANA_PUSH_BRANCH=<branch> to check the pushed branch\'s name');
    assert.deepEqual(branches.filter((b) => findNames(b, NAMES).length).map((b, i) => `branch ${i + 1} of ${branches.length}`), []);
  });
}

/* ---------------------------------------------------------------- the guard itself, on names invented here at run time */
const pick = (alphabet, n) => Array.from({ length: n }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
const LATIN = 'bcdfghjklmnpqrstvwxz', VOWELS = 'aeiou', HEBREW = 'אבגדהוזחטיכלמנסעפצקרשת';
const latinWord = () => pick(LATIN, 1) + pick(VOWELS, 1) + pick(LATIN, 1) + pick(VOWELS, 1) + pick(LATIN, 2);
const [A, B, C] = [latinWord(), latinWord(), latinWord()];
const [H1, H2] = [pick(HEBREW, 4), pick(HEBREW, 3) + 'מ'];       // the second ends in a letter that has a final form
const cap = (w) => w[0].toUpperCase() + w.slice(1);

function invented() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mana-names-')), file = path.join(dir, 'forbidden-names.txt');
  fs.writeFileSync(file, `# an invented venue, in two scripts\n${cap(A)} ${cap(B)}\n\n${H1} ${H2}   # Hebrew\n`);
  try { return parseList(fs.readFileSync(file, 'utf8')); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('the list is read from MANA_FORBIDDEN_NAMES_FILE, else private/forbidden-names.txt; comments and blank lines are skipped', () => {
  assert.equal(listFile({ MANA_FORBIDDEN_NAMES_FILE: '/elsewhere/names.txt' }), '/elsewhere/names.txt');
  assert.equal(listFile({}), path.join(ROOT, 'private/forbidden-names.txt'));
  assert.equal(git(['check-ignore', '-q', 'private/forbidden-names.txt']).status, 0, 'the default list is git-ignored');
  assert.deepEqual(invented().map((n) => n.words.length), [2, 2]);
});

test('an invented name is found however it is written', () => {
  const names = invented(), name = `${A} ${B}`;
  const forms = {
    plain: `x ${name} y`, capitals: `${A.toUpperCase()} ${B.toUpperCase()}`, hyphen: `${A}-${B}`, underscore: `${A}_${B}`,
    'line break': `${A}\n${B}`, 'camel case': `${cap(A)}${cap(B)}`, 'combining accent': `${A[0]}́${A.slice(1)} ${B}`,
    'precomposed accent': `${(A[1] + '́').normalize('NFC')}`.replace(/^/, A[0]) + `${A.slice(2)} ${B}`,
    'JSON escapes': [...name].map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join(''),
    'HTML entities': [...A].map((c) => `&#${c.charCodeAt(0)};`).join('') + '&nbsp;' + `&${B[1]}acute;`.replace(/^/, B[0]) + B.slice(2),
    'percent-encoding': [...name].map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    'zero-width space': `${A.slice(0, 2)}​${A.slice(2)} ${B}`, 'soft hyphen': `${A.slice(0, 3)}­${A.slice(3)} ${B}`,
    'bidi marks': `‫${A}‬ ‏${B}`, 'Hebrew with points and a final letter': `${H1[0]}ָ${H1.slice(1)} ${H2.slice(0, -1)}ם`,
  };
  for (const [what, s] of Object.entries(forms)) assert.ok(findNames(s, names).length >= 1, what);
  assert.deepEqual(findNames(`one\ntwo ${A}\n${B} three`, names), [{ line: 2, entry: 0 }], 'the line of the first word');
  for (const s of [`${A} ${C}`, `${B} ${A}`, `${A} and ${B}`, A, B, `${A} ${B}x`, H1]) assert.deepEqual(findNames(s, names), [], s);
});

test('the branch being pushed: MANA_PUSH_BRANCH, the current branch and its upstream; none on a detached HEAD', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mana-branch-')), g = (...a) => git(a, dir);
  try {
    g('init', '-q', '-b', 'feat/x'); g('-c', 'user.email=t@example.invalid', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'x');
    assert.deepEqual(pushedBranches({}, dir), ['feat/x']);
    assert.deepEqual(pushedBranches({ MANA_PUSH_BRANCH: 'feat/y' }, dir), ['feat/y', 'feat/x']);
    g('checkout', '-q', '--detach');
    assert.deepEqual(pushedBranches({}, dir), []);
    assert.deepEqual(pushedBranches({ MANA_PUSH_BRANCH: 'feat/y' }, dir), ['feat/y']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  assert.equal(findNames(`feat/${A}-${B}`, invented()).length, 1, 'a name in a branch name');
});
