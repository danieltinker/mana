/* The light parts of the floor: the table clock (a thin flat ring above a seated table that runs down, with a soft glow and
   a bright head), the status dots (free: sage, reserved: sky), the soft colour pool under a table, and the slab's blurred
   shadow on the ground. Colours are given in sRGB and drawn as they are (no tone mapping), so they match the page's. */
import { ShaderMaterial, PlaneGeometry, Mesh, CanvasTexture, SpriteMaterial, Sprite, MeshBasicMaterial, Color, DoubleSide, sRGBEncoding } from 'three';

export const STATE = { free: '#6FAE8E', seated: '#F5B120', soon: '#FF7A45', up: '#E25C7A', reserved: '#7FA9DB' };
const rgb = (hex) => { const c = new Color(hex); return [c.r, c.g, c.b]; };      // hex in, sRGB numbers out (no conversion)

const RING_V = `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_F = `
uniform vec3 uColor; uniform float uFrac, uR, uW, uAlpha, uPulse, uTrack;
varying vec2 vP;
const float TAU = 6.2831853;
void main(){
  float d = length(vP), px = max(fwidth(d), 1e-4);
  float a = atan(vP.x, vP.y); float t = a < 0.0 ? (a + TAU) / TAU : a / TAU;            // 0 at the top, clockwise
  float hw = max(uW * .5, px * 1.1);
  float line = 1.0 - smoothstep(hw - px, hw + px, abs(d - uR));
  float arc = clamp((uFrac - t) * TAU * d / px + .5, 0.0, 1.0) * step(.0005, uFrac);   // inside the time that is left
  float glow = exp(-pow((d - uR) / (uW * 3.2 + px * 2.0), 2.0));
  float ha = uFrac * TAU; vec2 head = uR * vec2(sin(ha), cos(ha)); float hd = length(vP - head);
  float headDot = (1.0 - smoothstep(hw * 2.1 - px, hw * 2.1 + px, hd)) * step(.0005, uFrac);
  float headGlow = exp(-pow(hd / (uW * 5.0 + px * 3.0), 2.0)) * step(.0005, uFrac);
  float p = .5 + .5 * uPulse;
  float alpha = line * mix(uTrack, 1.0, arc) + glow * arc * (.20 + .28 * uPulse) + headDot + headGlow * (.35 + .3 * uPulse);
  vec3 col = mix(uColor, vec3(1.0), headDot * .55);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0) * uAlpha * mix(1.0, p, step(.001, uPulse)));
}`;

export function makeRing(radius) {
  const W = .055, pad = W * 8 + .1, g = new PlaneGeometry(2 * (radius + pad), 2 * (radius + pad));
  const m = new ShaderMaterial({
    vertexShader: RING_V, fragmentShader: RING_F, transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false,
    extensions: { derivatives: true },
    uniforms: { uColor: { value: rgb(STATE.seated) }, uFrac: { value: 1 }, uR: { value: radius }, uW: { value: W }, uAlpha: { value: 0 }, uPulse: { value: 0 }, uTrack: { value: .16 } }
  });
  const mesh = new Mesh(g, m); mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 3;
  return {
    mesh,
    set(color, frac, alpha, pulse, track) { const u = m.uniforms; u.uColor.value = rgb(color); u.uFrac.value = frac; u.uAlpha.value = alpha; u.uPulse.value = pulse; u.uTrack.value = track == null ? .16 : track; mesh.visible = alpha > .003; },
    dispose() { g.dispose(); m.dispose(); }
  };
}

function canvasTex(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new CanvasTexture(c); return t; }
let dotTex = null, poolTex = null;
const dotTexture = () => dotTex || (dotTex = canvasTex(64, (x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.34, 'rgba(255,255,255,1)'); g.addColorStop(.42, 'rgba(255,255,255,.55)'); g.addColorStop(.6, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
}));
const poolTexture = () => poolTex || (poolTex = canvasTex(128, (x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.45, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
}));

/* a small glowing status dot (a sprite: round from every side) */
export function makeDot() {
  const m = new SpriteMaterial({ map: dotTexture(), color: new Color(STATE.free).convertSRGBToLinear(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
  const s = new Sprite(m); s.scale.set(.34, .34, 1); s.renderOrder = 4;
  return { sprite: s, set(color, alpha) { m.color.set(color).convertSRGBToLinear(); m.opacity = alpha; s.visible = alpha > .003; }, dispose() { m.dispose(); } };
}
/* a soft pool of the state's colour on the floor under a table */
export function makePool(r) {
  const g = new PlaneGeometry(2 * r, 2 * r), m = new MeshBasicMaterial({ map: poolTexture(), color: new Color(STATE.free).convertSRGBToLinear(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new Mesh(g, m); mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 1;
  return { mesh, set(color, alpha) { m.color.set(color).convertSRGBToLinear(); m.opacity = alpha; mesh.visible = alpha > .003; }, dispose() { g.dispose(); m.dispose(); } };
}
/* the slab's shadow on the ground: a blurred rounded rectangle (canvas shadowBlur works in every browser) */
export function makeGroundShadow(w, d) {
  const S = 256, k = .62, tex = canvasTex(S, (x) => {
    const rw = S * k, rh = rw * d / w, r = rw * .09, off = 1000;
    x.shadowColor = 'rgba(70,45,20,1)'; x.shadowBlur = S * .085; x.shadowOffsetX = off;
    x.fillStyle = '#000'; x.beginPath();
    const x0 = (S - rw) / 2 - off, y0 = (S - rh) / 2;
    x.moveTo(x0 + r, y0); x.arcTo(x0 + rw, y0, x0 + rw, y0 + rh, r); x.arcTo(x0 + rw, y0 + rh, x0, y0 + rh, r); x.arcTo(x0, y0 + rh, x0, y0, r); x.arcTo(x0, y0, x0 + rw, y0, r); x.closePath(); x.fill();
  });
  tex.encoding = sRGBEncoding;
  const g = new PlaneGeometry(w / k, w / k), m = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, opacity: .3, color: 0xffffff });
  const mesh = new Mesh(g, m); mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = -1;
  return { mesh, mat: m, dispose() { g.dispose(); m.dispose(); tex.dispose(); } };
}
export function disposeShared() { if (dotTex) dotTex.dispose(); if (poolTex) poolTex.dispose(); dotTex = poolTex = null; }
