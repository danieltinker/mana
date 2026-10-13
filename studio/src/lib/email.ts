// An e-mail address as a person typed it on a phone, made safe for the sign-in service, and the ONE thing wrong with it.
// The service (Supabase Auth) parses the address strictly: a trailing full stop, an invisible mark from a Hebrew keyboard
// (U+200F) or a full-width @ all pass a loose regex and are then refused as "invalid format". So the app cleans first and
// names the problem instead of saying "does not look right".
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g;              // zero-width, bidi marks, joiners, BOM, soft hyphen
const ODD_SPACE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;                        // no-break and typographic spaces

export function cleanEmail(raw: string): string {
  return String(raw || '')
    .replace(INVISIBLE, '').replace(ODD_SPACE, ' ')
    .replace(/\uFF20/g, '@').replace(/[\uFF0E\u3002]/g, '.')                                // full-width @ and full stops
    .trim().replace(/\.+$/, '')                                                               // "example.ai." (a phone's full stop)
    .toLowerCase();
}

export type EmailProblem = '' | 'empty' | 'no_at' | 'many_at' | 'space' | 'no_name' | 'no_domain' | 'no_dot' | 'chars' | 'long';
const NAME_OK = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/, DOMAIN_OK = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

/** What is wrong with a cleaned address, or '' when the service will accept its shape. */
export function emailProblem(email: string): EmailProblem {
  if (!email) return 'empty';
  if (email.length > 200) return 'long';
  if (/\s/.test(email)) return 'space';
  const parts = email.split('@');
  if (parts.length < 2) return 'no_at';
  if (parts.length > 2) return 'many_at';
  const [name, domain] = parts;
  if (!name) return 'no_name';
  if (!domain) return 'no_domain';
  if (!NAME_OK.test(name) || !DOMAIN_OK.test(domain)) return 'chars';
  if (name.startsWith('.') || name.endsWith('.') || name.includes('..')) return 'chars';
  const labels = domain.split('.');
  if (labels.length < 2 || labels[labels.length - 1].length < 2) return 'no_dot';
  return '';
}
