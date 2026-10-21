/**
 * The v2 back office (schema 2: the demo database `mana` and the simulator's stack). src/entry.js loads this bundle
 * only when the config says schema 2 (ADR-007). It adds its stylesheet (v2.css, beside this file; app.css, the v1
 * stylesheet already on the page, carries the shared base: tokens, buttons, fields, tables) and renders the app.
 */
import { render } from 'preact';
import { App } from './app.tsx';

export function startV2(mount: HTMLElement): void {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('v2.css', import.meta.url).href;
  const draw = () => { mount.replaceChildren(); render(<App config={window.HALOM_MENUS_CONFIG} />, mount); };
  css.addEventListener('load', draw, { once: true });
  css.addEventListener('error', draw, { once: true });
  document.head.appendChild(css);
}
