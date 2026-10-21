// How the v2 screens say prices, limits and languages. Browser-free, but reads the current language.
import type { VenueRow } from '@mana/contracts';
import { formatPrice } from '../lib/money.ts';
import { t } from './i18n.ts';

/** The place's menu languages, its first language first. */
export function langsOf(v: Pick<VenueRow, 'langs' | 'default_lang'>): ('he' | 'en')[] {
  const l = (v.langs || ['he', 'en']).filter((x): x is 'he' | 'en' => x === 'he' || x === 'en');
  return [...l].sort((a, b) => (a === v.default_lang ? -1 : b === v.default_lang ? 1 : 0));
}

export const shekels = (agorot: number) => formatPrice(agorot, 'ILS');

/** "Choose 1", "Choose 1 to 2", "Up to 3", with "required" or "optional". */
export function ruleLine(min: number, max: number): string {
  const how = min === max ? t('rule.exactly', { n: min }) : min === 0 ? t('rule.upTo', { n: max }) : t('rule.between', { min, max });
  return how + ' · ' + (min > 0 ? t('rule.required') : t('app.optional'));
}
