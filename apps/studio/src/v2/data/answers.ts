// The owner's answers to an import's questions, as this device keeps them until applying (there is no column for them),
// pure: per account and per import (`mana-import-answers:<user>:<import>`), read back only through the contracts'
// validator (an answer it refuses drops them all), and never a `skip` (the preview leaves things out only by an answer).
// data/onboarding.ts binds them to the signed-in account and removes the others' when the account changes or signs out.
import { validateDecisions, type ImportDecisions } from '@mana/contracts';
import { NO_DECISIONS } from './review.ts';

export const ANSWERS_PREFIX = 'mana-import-answers:';
export const answersKey = (user: string, importId: string) => `${ANSWERS_PREFIX}${user}:${importId}`;

/** What a stored entry is read back as: the answers alone, with the prices to confirm again (never published unseen). */
export function readAnswers(raw: string | null): ImportDecisions {
  if (!raw) return NO_DECISIONS;
  try {
    const j = JSON.parse(raw) as unknown;
    const choices = j && typeof j === 'object' && !Array.isArray(j) ? (j as { choices?: unknown }).choices ?? {} : {};
    const v = validateDecisions({ v: 1, pricesConfirmed: false, choices });
    return v.ok ? { v: 1, pricesConfirmed: false, choices: v.value.choices, skip: [] } : NO_DECISIONS;
  } catch { return NO_DECISIONS; }
}

/** What is stored: the owner's choices, nothing else. */
export const writeAnswers = (d: ImportDecisions): string => JSON.stringify({ choices: d.choices });

/** Remove every stored answer that is not `user`'s (all of them when no one is signed in). */
export function forgetAnswersBut(user: string | null, store: Pick<Storage, 'length' | 'key' | 'removeItem'>) {
  const gone: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && k.startsWith(ANSWERS_PREFIX) && (user === null || !k.startsWith(ANSWERS_PREFIX + user + ':'))) gone.push(k);
  }
  for (const k of gone) store.removeItem(k);
}
