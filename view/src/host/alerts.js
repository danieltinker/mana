/* How the manager hears that a table's time is up: a soft chime made with WebAudio (no sound file), a buzz where the
   device has one, "● " before the tab's title, and a system notification when he allowed them. Browsers keep sound off
   until a tap, so nothing here makes a sound before arm() runs inside the "Turn on alerts" tap; that same tap is the only
   place the notification permission is asked. */
export function createAlerts({ reduce = false } = {}) {
  let ctx = null, armed = false, baseTitle = document.title;
  const api = {
    get armed() { return armed; },
    /* inside the manager's tap */
    async arm() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC && !ctx) ctx = new AC();
        if (ctx && ctx.state === 'suspended') await ctx.resume();
      } catch (e) { ctx = null; }
      armed = true;
      try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch (e) { /* refused or not offered */ }
      api.chime(0.5);                                                   // a quiet one now, so he knows what it sounds like
      return armed;
    },
    /* two soft bell partials over a low warm one, 1.6 s, no click at either end */
    chime(level = 1) {
      if (!armed || !ctx) return false;
      try {
        const t0 = ctx.currentTime + 0.02, out = ctx.createGain();
        out.gain.value = 0.18 * level; out.connect(ctx.destination);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(out);
        [[659.25, 0, 1, 1.6], [987.77, 0.11, 0.62, 1.4], [329.63, 0, 0.35, 1.8], [1318.5, 0.11, 0.12, 0.9]].forEach(([f, d, g, len]) => {
          const o = ctx.createOscillator(), e = ctx.createGain();
          o.type = 'sine'; o.frequency.value = f;
          e.gain.setValueAtTime(0.0001, t0 + d); e.gain.exponentialRampToValueAtTime(g, t0 + d + 0.018); e.gain.exponentialRampToValueAtTime(0.0001, t0 + d + len);
          o.connect(e); e.connect(lp); o.start(t0 + d); o.stop(t0 + d + len + 0.05);
        });
        return true;
      } catch (e) { return false; }
    },
    buzz() { try { if (!reduce && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate([90, 70, 90]); } catch (e) { /* no motor */ } },      // only after a first tap: browsers refuse (and log) a buzz before it
    notify(title, body, tag) {
      try {
        if (!armed || !('Notification' in window) || Notification.permission !== 'granted') return false;
        const n = new Notification(title, { body, tag, silent: true }); n.onclick = () => { window.focus(); n.close(); };
        return true;
      } catch (e) { return false; }
    },
    /* the tab's title: "● " while any table's time is up and not yet seen */
    title(base, hot) { baseTitle = base; document.title = (hot ? '● ' : '') + baseTitle; }
  };
  return api;
}
