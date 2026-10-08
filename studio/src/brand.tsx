import { PRODUCT } from './product.ts';
import { lang, setLang, t } from './lib/i18n.ts';
import { Icon } from './ui.tsx';

export function Brand({ small, big }: { small?: boolean; big?: boolean }) {
  return <span class={'brand' + (small ? ' brand-sm' : '') + (big ? ' brand-lg' : '')} dir="ltr"><span class="brand-mark" lang="en">{PRODUCT.en}</span><span class="brand-dot" aria-hidden="true">·</span><span class="brand-mark" lang="he">{PRODUCT.he}</span></span>;
}
export function LangToggle({ plain }: { plain?: boolean }) {
  return <button type="button" class={plain ? 'linkbtn' : 'langbtn'} onClick={() => setLang(lang.value === 'he' ? 'en' : 'he')} aria-label={t('app.langSwitchLabel')} lang={lang.value === 'he' ? 'en' : 'he'}><Icon name="globe" size={17} /><span>{t('app.langSwitch')}</span></button>;
}

/** What Mana does, without words: a photographed menu becomes dishes on a table, behind a QR code. Mirrored in Hebrew so it reads from the right. */
export function Flow() {
  return (
    <svg class="flow" viewBox="0 0 336 100" role="presentation" aria-hidden="true" focusable="false">
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        {/* a paper menu in a camera's frame */}
        <rect x="30" y="16" width="52" height="68" rx="6" fill="#fff" stroke="#0F0F0F" stroke-width="1.6" />
        <path d="M40 30h24M40 40h32M40 48h28M40 58h32M40 66h20" stroke="#c9b8b0" stroke-width="2.4" />
        <path d="M40 30h14" stroke="#0F0F0F" stroke-width="2.4" />
        <path d="M18 22v-8a4 4 0 0 1 4-4h8M82 10h8a4 4 0 0 1 4 4v8M94 78v8a4 4 0 0 1-4 4h-8M30 90h-8a4 4 0 0 1-4-4v-8" stroke="#9A5238" stroke-width="2.2" />
        {/* dishes on a table */}
        <circle cx="168" cy="50" r="40" fill="#16110e" stroke="none" />
        <circle cx="168" cy="50" r="25" fill="#fffdfc" stroke="none" />
        <circle cx="168" cy="50" r="16" fill="#FFC9B6" stroke="none" />
        <path d="M160 48c3-5 10-6 15-2" stroke="#9A5238" stroke-width="2.2" />
        <circle cx="163" cy="56" r="2.6" fill="#2f6b4a" stroke="none" /><circle cx="174" cy="55" r="2" fill="#2f6b4a" stroke="none" />
        <path d="M204 14l1.900 5.100 5.100 1.900-5.100 1.900-1.900 5.100-1.900-5.100-5.100-1.900 5.100-1.900z" fill="#9A5238" stroke="none" />
        {/* a phone at the table with the code */}
        <rect x="252" y="10" width="52" height="80" rx="9" fill="#fff" stroke="#0F0F0F" stroke-width="1.6" />
        <g fill="#0F0F0F" stroke="none">
          <rect x="262" y="26" width="12" height="12" rx="2" /><rect x="282" y="26" width="12" height="12" rx="2" /><rect x="262" y="46" width="12" height="12" rx="2" />
          <rect x="282" y="46" width="5" height="5" /><rect x="289" y="53" width="5" height="5" /><rect x="282" y="60" width="5" height="5" /><rect x="262" y="64" width="5" height="5" /><rect x="271" y="64" width="5" height="5" />
        </g>
        <path d="M272 82h12" stroke="#c9b8b0" stroke-width="2.4" />
        {/* the way from one to the next */}
        <path d="M104 50h20M212 50h28" stroke="#9A5238" stroke-width="2" stroke-dasharray="1 6" />
        <path d="M122 45l5 5-5 5M238 45l5 5-5 5" stroke="#9A5238" stroke-width="2" />
      </g>
    </svg>
  );
}

// Marks of the sign-in providers (simple-icons, CC0), drawn in one colour.
const MARKS: Record<string, string> = {
  google: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  apple: 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701',
  facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
};
export const ProviderMark = ({ name }: { name: string }) => <svg class="ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d={MARKS[name] || ''} fill="currentColor" /></svg>;
