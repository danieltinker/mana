// The addresses of a menu. The link people share and copy is shortBase + slug; the QR code carries the same address
// with ?t=1, which is how the viewer knows a guest came from the printed code (CONTRACT.md v2).
import { cfg, sibling } from './api.ts';

export const shortUrl = (slug: string) => (cfg!.shortBase || 'https://halom.io/m/') + slug;
export const qrUrl = (slug: string) => shortUrl(slug) + '?t=1';
export const shortText = (slug: string) => shortUrl(slug).replace(/^https?:\/\//, '');
/** Where "Open the menu" and "Share" lead: the short link once it is routed (config.shortLive), else the viewer's own address. */
export const openUrl = (slug: string) => (cfg!.shortLive ? shortUrl(slug) : sibling(cfg!.viewPath || '../view/', '?m=' + encodeURIComponent(slug)));
