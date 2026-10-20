// The client walkthrough's small pieces, without a stack or a browser (the walkthrough itself is e2e/walkthrough.test.mjs):
// the TOTP code Halom's second step is completed with (RFC 6238), and the demo accounts read from private/demo.env.
//   node --test tools/test/*.test.mjs   (tools/test-all.mjs: the "tools" suite)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { base32Decode, totp } from '../../e2e/walkthrough/totp.mjs';
import { demoAccounts, readEnvFile } from '../../e2e/walkthrough/accounts.mjs';

/** RFC 6238's published test key ("12345678901234567890"), in base32. */
const RFC_B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test('TOTP: RFC 6238 appendix B, HMAC-SHA1, 8 digits, and the same codes cut to 6', () => {
  const key = Buffer.from('12345678901234567890', 'ascii');
  const vectors = [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']];
  for (const [t, code] of vectors) {
    assert.equal(totp(key, { time: t * 1000, digits: 8 }), code, `T = ${t}`);
    assert.equal(totp(key, { time: t * 1000 }), code.slice(-6), `T = ${t}, 6 digits`);
  }
  // the same key as an authenticator app is given it: base32, any case, spaces and padding ignored
  assert.deepEqual(base32Decode(RFC_B32), key);
  assert.equal(totp('gezd gnbv gy3t qojq gezd gnbv gy3t qojq', { time: 59_000 }), '287082');
  assert.equal(totp(RFC_B32 + '====', { time: 59_000 }), '287082');
  // a code holds for its 30 seconds
  assert.equal(totp(key, { time: 60_000 }), totp(key, { time: 89_999 }));
  assert.throws(() => base32Decode('not base32!'), /not base32/);
});

test('demo accounts: from private/demo.env, the TOTP secret optional, each missing account named by its step', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'walkthrough-env-'));
  try {
    assert.deepEqual(demoAccounts({ root, env: 'local', runId: 'r' }), {}, 'local makes its own');
    assert.equal(demoAccounts({ root, env: 'demo', runId: 'r' }).problems.length, 2, 'no file: the owner and Halom');
    fs.mkdirSync(path.join(root, 'private'));
    fs.writeFileSync(path.join(root, 'private/demo.env'), [
      '# a comment', 'MANA_DEMO_STAFF_EMAIL=staff@example.com', "MANA_DEMO_STAFF_PASSWORD='a pass=word'",
      'export MANA_DEMO_OWNER_EMAIL="halom.studio+demo-{run}@gmail.com"', '',
    ].join('\n'));
    assert.equal(readEnvFile(path.join(root, 'private/demo.env')).MANA_DEMO_STAFF_PASSWORD, 'a pass=word');
    const a = demoAccounts({ root, env: 'demo', runId: '1020-1400-abc' });
    assert.deepEqual(a, { owner: { email: 'halom.studio+demo-1020-1400-abc@gmail.com' }, staff: { email: 'staff@example.com', password: 'a pass=word' }, problems: [] });
    fs.appendFileSync(path.join(root, 'private/demo.env'), 'MANA_DEMO_STAFF_TOTP_SECRET=' + RFC_B32 + '\n');   // RFC 6238's test key
    assert.equal(demoAccounts({ root, env: 'demo', runId: 'r' }).staff.totp, RFC_B32);
    fs.appendFileSync(path.join(root, 'private/demo.env'), 'MANA_DEMO_STAFF_TOTP_SECRET=not base32!\n');
    assert.match(demoAccounts({ root, env: 'demo', runId: 'r' }).problems.join(' '), /MANA_DEMO_STAFF_TOTP_SECRET is not a base32 secret/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
