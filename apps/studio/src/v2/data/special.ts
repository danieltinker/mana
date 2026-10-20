// A special in one sheet (Hopa H53, F05/F08's quick actions): a dish that shows only on the days and at the hours the
// owner picks, made from one form: the dish's names and price, its section, the days and hours. It becomes three
// writes the screen makes through the store, each with an id made on the phone (so a retry after a lost answer adds
// nothing twice): a schedule of kind special named after the dish, the dish linked to it, then a publish. Pure.
import { isBlank, stripBlank, textLength, type DishRow, type Weekday } from '@mana/contracts';
import { agorotOf, type FieldError, type Mapped } from './forms.ts';
import { scheduleFromForm, type ScheduleWrite } from './hours.ts';

export type SpecialForm = {
  nameHe: string;
  nameEn: string;
  /** Shekels, as typed. */
  price: string;
  sectionId: string;
  days: Weekday[];
  from: string;
  to: string;
};

/** The schedule's name is the dish's, so the schedule's limit (60, tighter than a dish's 90) is the special's. */
export const SPECIAL_NAME_MAX = 60;

/** Today's weekday, at lunch (the special's default hours, as the hours screen's new special has them). */
export const newSpecialForm = (sectionId: string, today: Weekday): SpecialForm =>
  ({ nameHe: '', nameEn: '', price: '', sectionId, days: [today], from: '12:00', to: '16:00' });

export type SpecialWrite = {
  readonly schedule: ScheduleWrite;
  readonly sectionId: string;
  readonly dish: Pick<DishRow, 'name_he' | 'name_en' | 'price'>;
};

/**
 * Codes, by field: `name` name_missing; `name_he` / `name_en` too_long; `price` price_missing (a special is sold, so it
 * has a price) or price_invalid; `section` section_missing; `days` days_empty; `time` time_invalid.
 */
export function specialFromForm(f: SpecialForm, sectionIds: readonly string[]): Mapped<SpecialWrite> {
  const errors: FieldError[] = [];
  const he = stripBlank(f.nameHe), en = stripBlank(f.nameEn);
  if (isBlank(he) && isBlank(en)) errors.push({ field: 'name', code: 'name_missing' });
  if (textLength(he) > SPECIAL_NAME_MAX) errors.push({ field: 'name_he', code: 'too_long' });
  if (textLength(en) > SPECIAL_NAME_MAX) errors.push({ field: 'name_en', code: 'too_long' });
  const price = agorotOf(f.price);
  if (price === null) errors.push({ field: 'price', code: 'price_missing' });
  else if (price === 'invalid') errors.push({ field: 'price', code: 'price_invalid' });
  if (!sectionIds.includes(f.sectionId)) errors.push({ field: 'section', code: 'section_missing' });
  const s = scheduleFromForm({ kind: 'special', nameHe: he, nameEn: en, windows: [{ key: 'special', days: f.days, from: f.from, to: f.to }], validFrom: '', validTo: '' });
  if (!s.ok) {
    for (const e of s.errors) {
      if (e.field === 'windows.0.days') errors.push({ field: 'days', code: e.code });
      else if (e.field === 'windows.0.time') errors.push({ field: 'time', code: e.code });
    }
  }
  if (errors.length || !s.ok || typeof price !== 'number') return { ok: false, errors };
  return { ok: true, value: { schedule: s.value, sectionId: f.sectionId, dish: { name_he: he, name_en: en, price } } };
}
