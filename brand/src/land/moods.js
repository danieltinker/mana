/* "Your dream, our creative": the AI host's mini-ad. The phone plays one mood (muted, inline, from the start), and when it ends a
   burst of light and a whip of colour bring the next one: the same invented woman in another place. The chips name the mood
   that plays and fill as it runs; a tap switches at once. The films load only when the phone is on screen and pause when it
   leaves, when the tab hides or the demo dialog covers the page. Reduced motion or Save-Data: no film; the chips switch the
   posters. */
export function initMoods({ $, $$, doc, hasIO, saveData, reduced, covered }) {
  const ad = $('#ad'); if (!ad) return;
  const btns = $$('.mood', ad), ids = btns.map((b) => b.getAttribute('data-mood'));
  const vid = (id) => $('.reel-video.m-' + id, ad), still = (id) => $('.reel-still.m-' + id, ad);
  const films = !saveData && !reduced && hasIO;
  let cur = 0, visible = false, raf = 0, boomT = 0;
  const v = () => vid(ids[cur]);
  function progress() {
    raf = 0; const el = v(), b = btns[cur];
    if (el && b && el.duration) b.style.setProperty('--p', Math.min(1, el.currentTime / el.duration).toFixed(3));
    if (el && !el.paused) raf = requestAnimationFrame(progress);
  }
  function boom() {
    ad.classList.remove('boom-on'); void ad.offsetWidth; ad.classList.add('boom-on');
    clearTimeout(boomT); boomT = setTimeout(() => ad.classList.remove('boom-on'), 800);
  }
  function play() {
    if (!films || !visible || (covered && covered())) return;
    const el = v(); if (!el) return;
    if (!el.getAttribute('src')) { el.muted = true; el.setAttribute('src', el.getAttribute('data-src')); }
    const p = el.play(); if (p && p.catch) p.catch(() => { /* refused: the poster stays */ });
  }
  function pauseAll() { ids.forEach((id) => { const el = vid(id); if (el && el.getAttribute('src')) el.pause(); }); }
  function show(i, withBoom) {
    const prev = cur; cur = (i + ids.length) % ids.length;
    btns.forEach((b, k) => { b.setAttribute('aria-pressed', k === cur ? 'true' : 'false'); if (k !== cur) b.style.setProperty('--p', '0'); });
    ad.setAttribute('data-mood', ids[cur]);
    ids.forEach((id, k) => { const st = still(id); if (st) st.classList.toggle('on', k === cur); });
    if (prev !== cur || withBoom) {
      const old = vid(ids[prev]); if (old && prev !== cur) { old.classList.remove('on'); if (old.getAttribute('src')) old.pause(); }
      const el = v(); if (el && el.getAttribute('src')) { try { el.currentTime = 0; } catch (e) { /* not ready */ } }
      if (withBoom) boom();
    }
    play();
  }
  ids.forEach((id, k) => {
    const el = vid(id); if (!el) return;
    el.addEventListener('playing', () => { if (k === cur) { el.classList.add('on'); if (!raf) raf = requestAnimationFrame(progress); } });
    el.addEventListener('ended', () => { if (k === cur) show(cur + 1, true); });
  });
  btns.forEach((b, k) => b.addEventListener('click', () => { if (k !== cur) show(k, true); else play(); }));
  if (films) new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) play(); else pauseAll(); }, { threshold: .35 }).observe($('.phone', ad) || ad);
  doc.addEventListener('mana:settle', (e) => { if (e.detail) pauseAll(); else play(); });
}
