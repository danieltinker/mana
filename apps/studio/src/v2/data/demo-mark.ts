// Backlog B5: outside production (`env` demo or local) every QR code and every print carries a visible "demo" mark, so a
// demo card can never pass for a real one, on screen, on paper or as a file. Pure: screens/qr.tsx draws it, the unit
// tests check it.
import type { AppEnv } from '@mana/contracts';

/** The mark: the same words in both languages, so a card in either language carries it. */
export const DEMO_MARK = 'DEMO · הדגמה';
/** Its colour: a red no table card of Mana's uses, white words on it. */
export const DEMO_RED = '#b4232a';

/** Every environment but production marks its codes and prints. */
export const marksDemo = (env: AppEnv): boolean => env !== 'production';

/**
 * A QR code's SVG (as the `qrcode` package writes it: `viewBox="0 0 w h"`) with a band under it that says "demo". The
 * band is outside the code's own square (the picture grows by it), so the code scans exactly as before. An SVG without
 * a viewBox it recognises is returned as it is.
 */
export function withDemoBand(svg: string): string {
  const m = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
  if (!m) return svg;
  const w = Number(m[1]), h = Number(m[2]), band = Math.max(6, Math.round(w * 0.16));
  const grown = svg
    .replace(m[0], `viewBox="0 0 ${w} ${h + band}"`)
    // a fixed width or height on the root would squeeze the taller picture: the viewBox alone sizes it
    .replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(?:width|height)="[^"]*"/g, ''));
  const mark = `<rect x="0" y="${h}" width="${w}" height="${band}" fill="${DEMO_RED}"/>` +
    `<text x="${w / 2}" y="${h + band * 0.68}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${band * 0.56}" fill="#fff" data-demo="mark">${DEMO_MARK}</text>`;
  return grown.replace(/<\/svg>\s*$/, mark + '</svg>');
}
