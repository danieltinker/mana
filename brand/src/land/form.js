/* "Talk to us" → the leads function (Supabase RPC submit_lead). Ported unchanged in behaviour from brand/site/mana.js:
   WhatsApp is the first button; the short form is behind one tap on a phone and open on a wide screen. A preview build
   (MANA_PREVIEW=1) renders the form switched off (data-off) and this sends nothing. */
export function initForm({ $, $$, mq, lang }) {
  const more = $('#talk-more');
  if (more && mq('(min-width: 900px)')) more.open = true;
  const form = $('#talk');
  if (!form) return;
  let opened = Date.now(), busy = false;
  const KEY = 'mana-lead-token';
  const T = {
    he: { sending: 'שולחים…', rate: 'נשלחו מכאן הרבה פניות בזמן קצר. נסו שוב בעוד שעה, או כתבו לנו בוואטסאפ.', fail: 'הפנייה לא נשלחה. מה שכתבתם נשאר כאן: אפשר לנסות שוב, או לשלוח אותו בוואטסאפ.',
      offline: 'אין חיבור לרשת כרגע. מה שכתבתם נשאר כאן.', invalid: 'משהו בפרטים לא עבר. בדקו את הטלפון או האימייל ונסו שוב.', waText: 'היי, כותבים מהעמוד של מנה.' },
    en: { sending: 'Sending…', rate: 'Too many messages came from here in a short time. Try again in an hour, or write to us on WhatsApp.', fail: 'Your message was not sent. What you wrote is still here: try again, or send it on WhatsApp.',
      offline: 'You are offline right now. What you wrote is still here.', invalid: 'Something in the details did not pass. Check the phone or e-mail and try again.', waText: 'Hi, writing from the Mana page.' }
  };
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = Array.prototype.map.call(b, (x) => (x + 256).toString(16).slice(1)).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  /* one token per message, kept across retries and reloads so a second click can never make a second lead */
  function token() { let t = null; try { t = sessionStorage.getItem(KEY); } catch (e) { /* ignore */ } if (!t) { t = uuid(); try { sessionStorage.setItem(KEY, t); } catch (e) { /* ignore */ } } return t; }
  function clearToken() { try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
  const f = { place: $('#f-place'), contact: $('#f-contact'), msg: $('#f-msg'), hp: $('#f-site'), news: $('#f-news') };
  const btn = $('#f-send'), bad = $('#talk-bad'), badText = $('#talk-bad-text'), ok = $('#talk-ok'), ref = $('#talk-ref'), wa = $('#talk-wa');
  function contactOk(v) { v = v.trim(); return v.length >= 5 && v.length <= 200 && (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || /^\d{7,15}$/.test(v.replace(/\D/g, ''))); }
  function mark(el, isBad) { const w = el.closest('.field'); if (isBad) w.setAttribute('data-bad', ''); else w.removeAttribute('data-bad'); el.setAttribute('aria-invalid', isBad ? 'true' : 'false'); }
  function dream() {
    let s = (lang() === 'he' ? 'מסעדה: ' : 'Restaurant: ') + f.place.value.trim();
    if (f.msg.value.trim()) s += '\n' + f.msg.value.trim();
    s += '\n' + (f.news.checked ? '[updates: yes]' : '[updates: no]');     // marketing consent travels with the message until the table has a column for it
    return s.slice(0, 4000);
  }
  function waLink() { return 'https://wa.me/972542022269?text=' + encodeURIComponent(T[lang()].waText + '\n' + dream().replace(/\n\[updates:.*$/, '')); }
  function showBad(key) { badText.textContent = T[lang()][key]; wa.href = waLink(); bad.hidden = false; bad.focus(); }
  function setBusy(b) { busy = b; btn.disabled = b; form.setAttribute('aria-busy', b ? 'true' : 'false'); $$('.lbl', btn).forEach((s) => { s.hidden = b; }); $('.busy', btn).hidden = !b; $('.busy', btn).textContent = T[lang()].sending; }
  form.addEventListener('submit', (ev) => {
    ev.preventDefault(); if (busy || form.hasAttribute('data-off')) return;                 // a preview build: the form is off and sends nothing
    bad.hidden = true;
    const p = f.place.value.trim().length < 2, c = !contactOk(f.contact.value);
    mark(f.place, p); mark(f.contact, c);
    if (p || c) { (p ? f.place : f.contact).focus(); return; }
    const cfg = window.HALOM_MENUS_CONFIG;
    if (!cfg || !cfg.supabaseUrl || !cfg.supabaseKey) { showBad('fail'); return; }
    if (navigator.onLine === false) { showBad('offline'); return; }
    setBusy(true);
    const body = { p_token: token(), p_dream: dream(), p_contact: f.contact.value.trim(), p_name: null, p_package: 'menus', p_source: 'menus-landing',
      p_locale: lang(), p_page: (location.pathname + location.search).slice(0, 500), p_hp: f.hp.value || '', p_elapsed_ms: Date.now() - opened };
    const ctl = 'AbortController' in window ? new AbortController() : null, to = setTimeout(() => { if (ctl) ctl.abort(); }, 20000);
    fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/submit_lead', { method: 'POST', headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then((j) => {
        clearTimeout(to); setBusy(false);
        if (j && j.ok) { clearToken(); ref.textContent = j.ref || ''; $$('.has-ref', ok).forEach((e) => { e.hidden = !j.ref; }); form.hidden = true; ok.hidden = false; ok.focus(); return; }
        const code = j && j.code;
        if (code === 'rate_limited') showBad('rate'); else if (code === 'invalid') { mark(f.contact, true); showBad('invalid'); } else showBad('fail');
      })
      .catch(() => { clearTimeout(to); setBusy(false); showBad(navigator.onLine === false ? 'offline' : 'fail'); });
  });
  [f.place, f.contact].forEach((el) => el.addEventListener('input', () => mark(el, false)));
  const again = $('#talk-again'); if (again) again.addEventListener('click', () => { form.reset(); opened = Date.now(); ok.hidden = true; form.hidden = false; f.place.focus(); });
}
