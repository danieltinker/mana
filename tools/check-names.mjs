#!/usr/bin/env node
/* The name guard: no tracked or new file (its text and its path), no commit of this branch (origin/main..HEAD:
   messages and patches) and not the name of the branch being pushed may hold a forbidden name (the mock client's, in
   every spelling).

   The names are never in the repository, not even as hashes (a short name's hash reverses): they are read from a file
   outside git, MANA_FORBIDDEN_NAMES_FILE if it is set, else private/forbidden-names.txt (git-ignored). One name per
   line, any script; # starts a comment. Without the default file the suite says "no list: nothing checked" and passes:
   it is a local guard, run before every push on a machine that has the list. A MANA_FORBIDDEN_NAMES_FILE that points at
   nothing (or at an empty list) fails. Findings name the file (a listed word in its path masked) and line, never the
   name.

   Text is read the way a person would read it: HTML tags dropped; JSON and JavaScript escapes (\uXXXX, \u{…}, \n, \t,
   \r, \\, \", \'), HTML entities and %XX decoded; format characters (zero-width, soft hyphen, bidi marks) dropped; then
   NFKD, accents and points dropped, camel case split (seedName, NameMenu), lower case, Hebrew final letters folded,
   letters only. A name matches as its words in a row (across a line break, a hyphen, an underscore, a tag), its last
   word also in the plural (s, es); or written as one word, also inside a longer run of letters. A pair that shares only
   one word with it does not.

   It is a safety net against accidents, not against an adversary: deliberate evasions (look-alike letters from another
   script, letters spaced apart, double encoding) are out of its scope.

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

/* the reader and matcher live in tools/names.mjs (no tests there), so other suites check their files with them */
import { findingsIn, findNames, listFile, maskPath, parseList, readList } from './names.mjs';
export { decode, findingsIn, findNames, listFile, maskPath, parseList, readList, wordsOf } from './names.mjs';

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

const LIST = readList(), NAMES = LIST.names;
if (LIST.problem) {
  test('the list MANA_FORBIDDEN_NAMES_FILE names is there and holds names', () => { assert.fail(LIST.problem); });
} else if (LIST.note) {
  console.log('note: ' + LIST.note);
} else {
  test('no tracked or new file holds a forbidden name, in its text or its path', () => {
    const r = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
    assert.equal(r.status, 0, 'git ls-files: the check needs a git checkout');
    const found = [];
    let read = 0;
    for (const f of r.stdout.split('\0').filter(Boolean)) {
      const s = readText(path.join(ROOT, f)); if (s !== null) read++;
      found.push(...findingsIn(f, s, NAMES));
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
const LATIN = 'bcdfghjklmnpqrtvwxz', VOWELS = 'aiou', HEBREW = 'אבגדהוזחטיכלמנסעפצקרשת';     // no s, no e: a plural stays a plural
const latinWord = () => pick(LATIN, 1) + pick(VOWELS, 1) + pick(LATIN, 1) + pick(VOWELS, 1) + pick(LATIN, 2);
const [A, B, C] = [latinWord(), latinWord(), latinWord()];
const [H1, H2] = [pick(HEBREW, 4), pick(HEBREW, 3) + 'מ'];       // the second ends in a letter that has a final form
const cap = (w) => w[0].toUpperCase() + w.slice(1);
const COMBINING_ACUTE = '́', ZERO_WIDTH = '​', SOFT_HYPHEN = '­', RTL_EMBED = '‫', POP = '‬', RLM = '‏', QAMATS = 'ָ';

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

test('an invented name is found however it is written by accident', () => {
  const names = invented(), name = `${A} ${B}`;
  const forms = {
    plain: `x ${name} y`, capitals: `${A.toUpperCase()} ${B.toUpperCase()}`, hyphen: `${A}-${B}`, underscore: `${A}_${B}`,
    'line break': `${A}\n${B}`, 'camel case': `${cap(A)}${cap(B)}`, 'combining accent': `${A[0]}${COMBINING_ACUTE}${A.slice(1)} ${B}`,
    'precomposed accent': A[0] + (A[1] + COMBINING_ACUTE).normalize('NFC') + `${A.slice(2)} ${B}`,
    'JSON \\u escapes': [...name].map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join(''),
    'JSON \\n between the words': `"${cap(A)}\\n${cap(B)}"`, 'JSON \\t and quotes': `"\\"${A}\\t${B}\\""`,
    'HTML entities': [...A].map((c) => `&#${c.charCodeAt(0)};`).join('') + '&nbsp;' + `&${B[1]}acute;`.replace(/^/, B[0]) + B.slice(2),
    'HTML tags': `<td>${cap(A)}</td> <td><b>${cap(B)}</b></td>`, 'a tag inside a word': `${A.slice(0, 2)}<span>${A.slice(2)}</span> ${B}`,
    'percent-encoding': [...name].map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    'zero-width space': `${A.slice(0, 2)}${ZERO_WIDTH}${A.slice(2)} ${B}`, 'soft hyphen': `${A.slice(0, 3)}${SOFT_HYPHEN}${A.slice(3)} ${B}`,
    'bidi marks': `${RTL_EMBED}${A}${POP} ${RLM}${B}`, 'Hebrew with points and a final letter': `${H1[0]}${QAMATS}${H1.slice(1)} ${H2.slice(0, -1)}ם`,
    'camel case after a word': `seed${cap(A)}${cap(B)}`, 'camel case before a word': `${cap(A)}${cap(B)}Menu`, 'a file name': `${cap(A)}${cap(B)}Menu.tsx`,
    'inside a lower-case run': `seed${A}${B}menu`, 'the plural': `${A} ${B}s`, 'the plural as one word': `${cap(A)}${cap(B)}s`,
  };
  for (const [what, s] of Object.entries(forms)) assert.ok(findNames(s, names).length >= 1, what);
  assert.deepEqual(findNames(`one\ntwo ${A}\n${B} three`, names), [{ line: 2, entry: 0 }], 'the line of the first word');
  for (const s of [`${A} ${C}`, `${B} ${A}`, `${A} and ${B}`, A, B, `${A} ${B}x`, `${A} ${B}ing`, H1, `${A}<br>${C}`]) assert.deepEqual(findNames(s, names), [], s);
});

test('a path: found too, and printed with the listed words masked', () => {
  const names = invented(), p = `apps/${A}-${B}/${cap(A)}${cap(B)}Menu.tsx`;
  assert.ok(findNames(p.replace(/\//g, ' / '), names).length >= 1);
  assert.equal(maskPath(p, names), 'apps/[masked]/[masked]');
  assert.equal(maskPath(`docs/${C}/${A}.md`, names), `docs/${C}/[masked]`, 'one listed word is enough to mask a part');
  assert.equal(maskPath(`docs/${C}/notes.md`, names), `docs/${C}/notes.md`);
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

test('a MANA_FORBIDDEN_NAMES_FILE that points at nothing fails the suite; without any list it passes and says so', () => {
  if (process.env.MANA_NAMES_SELF) return;       // the runs below run this file again; once is enough
  /* this file again, as the runner runs it (NODE_TEST_CONTEXT would make it report to this run instead) */
  const run = (list) => {
    const env = { ...process.env, MANA_NAMES_SELF: '1' }; delete env.NODE_TEST_CONTEXT; delete env.MANA_FORBIDDEN_NAMES_FILE;
    if (list) env.MANA_FORBIDDEN_NAMES_FILE = list;
    return spawnSync(process.execPath, ['--test', path.join(ROOT, 'tools/check-names.mjs')], { encoding: 'utf8', env });
  };
  const nowhere = run(path.join(os.tmpdir(), 'no-such-list-' + crypto.randomUUID()));
  assert.equal(nowhere.status, 1, nowhere.stdout);
  assert.match(nowhere.stdout, /MANA_FORBIDDEN_NAMES_FILE points at nothing/);
  if (!fs.existsSync(listFile({}))) {
    const none = run(null);
    assert.equal(none.status, 0, none.stdout);
    assert.match(none.stdout, /^# note: no list: nothing checked/m);
  }
});
