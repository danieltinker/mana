// The QR code and the table card for a place that has published (F03 step 9): the code on screen, the card printed at A6
// or A5, the code as PNG or SVG. The code carries the link guests scan (`qrUrl`: the short link with ?t=1, CONTRACT.md).
// Backlog B5: outside production (`env` demo or local) every code and every print carries a visible "demo" mark,
// drawn into the picture itself (below the code, never over it, so it still scans), so a demo card can never pass for a
// real one, on screen, on paper or as a file.
import { useEffect, useState } from 'preact/hooks';
import QRCode from 'qrcode';
import type { VenueRow } from '@mana/contracts';
import { PRODUCT } from '../../product.ts';
import { qrUrl, shortText, shortUrl } from '../../lib/links.ts';
import { Btn, CopyBtn, Ltr } from '../../ui.tsx';
import { runtime } from '../data/client.ts';
import { DEMO_MARK, DEMO_RED, marksDemo, withDemoBand } from '../data/demo-mark.ts';
import { t } from '../i18n.ts';

const QR_OPTS = { errorCorrectionLevel: 'Q' as const, margin: 4 };
const isDemo = () => marksDemo(runtime.env);

function useQrSvg(url: string): string {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let on = true;
    QRCode.toString(url, { ...QR_OPTS, type: 'svg' }).then((s: string) => { if (on) setSvg(isDemo() ? withDemoBand(s) : s); }).catch(() => {});
    return () => { on = false; };
  }, [url]);
  return svg;
}
const svgSrc = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** The code as a large PNG; outside production with the same band under it. */
async function qrPng(code: string): Promise<Blob> {
  const size = 2048;
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, code, { ...QR_OPTS, width: size });
  if (!isDemo()) return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'));
  const band = Math.round(size * 0.16);
  const out = document.createElement('canvas');
  out.width = size; out.height = size + band;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0);
  ctx.fillStyle = DEMO_RED; ctx.fillRect(0, size, size, band);
  ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(band * 0.56)}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(DEMO_MARK, size / 2, size + band / 2);
  return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'));
}

function printCard(size: 'A6' | 'A5') {
  const card = document.querySelector('[data-table-card]');
  if (!card) return;
  // a copy of the card, alone on the sheet: the app is taken out of the print layout so exactly one page comes out
  const root = document.createElement('div');
  root.className = 'print-root';
  root.appendChild(card.cloneNode(true));
  const style = document.createElement('style');
  style.textContent = `@page { size: ${size === 'A6' ? '105mm 148mm' : '148mm 210mm'}; margin: 0; }`;
  document.body.appendChild(root); document.head.appendChild(style);
  document.documentElement.dataset.print = size;
  let cleaned = false;
  const done = () => { if (cleaned) return; cleaned = true; delete document.documentElement.dataset.print; style.remove(); root.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 120000);
}

/** The code, the table card and the files, for a place that has published (its first publish may still wait for Halom). */
export function QrCard({ venue }: { venue: Pick<VenueRow, 'slug' | 'name_he' | 'name_en'> }) {
  const code = qrUrl(venue.slug);
  const svg = useQrSvg(code);
  const demo = isDemo();
  return (
    <section class="card qrcard" aria-labelledby="qr-h" data-qr-card data-demo={demo ? 'on' : undefined}>
      <h2 id="qr-h">{t('pub.qr')}</h2>
      {demo && <p class="fine" data-demo-note>{t('qr2.demo')}</p>}
      <div class="qrsheet">
        <div class="tcard" data-table-card>
          <p class="tcard-name">{venue.name_he && venue.name_en ? <><span lang="he" dir="rtl">{venue.name_he}</span><span lang="en" dir="ltr" class="tcard-name2">{venue.name_en}</span></> : <span>{venue.name_he || venue.name_en}</span>}</p>
          {svg ? <img class="tcard-qr" src={svgSrc(svg)} alt={t('pub.qrAlt', { url: shortText(venue.slug) })} data-qr /> : <span class="tcard-qr" aria-hidden="true" />}
          <p class="tcard-scan"><span lang="he" dir="rtl">{t('pub.cardScanHe')}</span><span lang="en" dir="ltr">{t('pub.cardScanEn')}</span></p>
          <p class="tcard-foot" dir="ltr">Menu by {PRODUCT.en.toLowerCase()} · {PRODUCT.site}</p>
          {demo && <p class="tcard-demo" dir="ltr" data-demo="card">{DEMO_MARK}</p>}
        </div>
        <div class="actgrid">
          <Btn icon="print" onClick={() => printCard('A6')} data-print="A6">{t('pub.cardA6')}</Btn>
          <Btn icon="print" onClick={() => printCard('A5')} data-print="A5">{t('pub.cardA5')}</Btn>
          <Btn icon="download" onClick={async () => download(`mana-qr-${venue.slug}${demo ? '-demo' : ''}.png`, await qrPng(code))} data-qr-png>{t('pub.qrPng')}</Btn>
          <Btn icon="download" disabled={!svg} onClick={() => download(`mana-qr-${venue.slug}${demo ? '-demo' : ''}.svg`, new Blob([svg], { type: 'image/svg+xml' }))} data-qr-svg>{t('pub.qrSvg')}</Btn>
        </div>
        <p class="linkline"><Ltr class="biglink">{shortText(venue.slug)}</Ltr><CopyBtn text={shortUrl(venue.slug)} /></p>
      </div>
    </section>
  );
}
