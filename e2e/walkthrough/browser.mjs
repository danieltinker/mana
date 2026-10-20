// The browser a walkthrough drives: Chromium through playwright-core, on this machine.
// - Linux (the cloud machines, CI): the repository's Chromium (tools/browser.mjs: CHROME).
// - A Mac (Daniel's, `npm run demo -- --scenario …`): $CHROME when set, else the installed Google Chrome.
// The browser reaches only this machine and, on demo, the one database the site's settings name: every other host fails
// to resolve, so a walkthrough can never touch production or anything else.
import fs from 'node:fs';
import { ARGS, CHROME, playwright } from '../../tools/browser.mjs';

/** The owner's and a guest's phone (an iPhone 13's screen), and Halom's desk. */
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' };
export const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, locale: 'en-GB', timezoneId: 'Asia/Jerusalem' };

/**
 * @param {{ apiUrl: string, headed?: boolean }} o  apiUrl: the database the site talks to (its host is the one outside
 *   host the browser may reach; a loopback address needs nothing more)
 */
export async function launchBrowser({ apiUrl, headed = process.env.MANA_WALKTHROUGH_HEADED === '1' }) {
  const host = new URL(apiUrl).hostname;
  const loopback = ['127.0.0.1', 'localhost'].includes(host);
  const args = ARGS.map((a) => (a.startsWith('--host-resolver-rules=') && !loopback ? `${a}, EXCLUDE ${host}` : a))
    .filter((a) => process.platform === 'linux' || a !== '--no-sandbox');
  const pw = playwright();
  const executablePath = process.env.CHROME || (fs.existsSync(CHROME) ? CHROME : null);
  if (executablePath) return pw.chromium.launch({ executablePath, headless: !headed, args });
  if (process.platform === 'darwin') {
    try { return await pw.chromium.launch({ channel: 'chrome', headless: !headed, args }); }
    catch (e) { throw new Error(`no browser to drive: install Google Chrome, or set CHROME to a Chromium (${e.message.split('\n')[0]})`); }
  }
  throw new Error(`no browser to drive: ${CHROME} is missing; set CHROME to a Chromium`);
}

/** A new page in its own context (its own sign-in), with the page's errors kept in `page.problems`. */
export async function newPage(browser, device, { init = null } = {}) {
  const ctx = await browser.newContext(device);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('pageerror: ' + e.message));
  return page;
}
