import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanEmail, emailProblem } from '../../src/lib/email.ts';

test('e-mail: what a phone keyboard adds is removed before the service sees it', () => {
  assert.equal(cleanEmail(' Owner@Example.AI '), 'owner@example.ai');
  assert.equal(cleanEmail('owner@example.ai.'), 'owner@example.ai', 'a trailing full stop');
  assert.equal(cleanEmail('owner@example.ai‏'), 'owner@example.ai', 'a right-to-left mark');
  assert.equal(cleanEmail('​owner@example.ai​'), 'owner@example.ai', 'zero-width spaces');
  assert.equal(cleanEmail('owner＠example．ai'), 'owner@example.ai', 'full-width @ and full stop');
  assert.equal(cleanEmail('owner@example.ai '), 'owner@example.ai', 'a no-break space');
  for (const ok of ['owner@example.ai', 'a.b-c_d+e@sub.example.co.il', 'x@y.io', "o'neil@example.com"]) assert.equal(emailProblem(cleanEmail(ok)), '', ok);
});

test('e-mail: the one thing wrong with an address is named', () => {
  const want = { '': 'empty', 'not-an-email': 'no_at', 'a@b@c.com': 'many_at', 'owner@exam ple.ai': 'space', '@example.ai': 'no_name', 'owner@': 'no_domain',
    'owner@example': 'no_dot', 'owner@example.a': 'no_dot', 'owner@example..ai': 'chars', 'בעלים@example.ai': 'chars', 'owner@exámple.ai': 'chars', '.owner@example.ai': 'chars' };
  for (const [email, problem] of Object.entries(want)) assert.equal(emailProblem(cleanEmail(email)), problem, email);
  assert.equal(emailProblem('o'.repeat(200) + '@x.ai'), 'long');
});
