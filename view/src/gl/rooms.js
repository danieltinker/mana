/* The rooms of the place, drawn: what stands around the dishes and drinks in each room, and what lies far behind.
   (Which room a category is in: scenes/rooms.js. The eye of each room: its preset in scenes/walk.js.)

   Every room is the same three things, so they cost little and are built only when the guest comes near:
     the counter   the room's long surface (the table shader's lit top, glossy, reflecting the backdrop); it ends `wall` behind
                   the focus and fades into the backdrop there
     the backdrop  one photograph of a place like it (themes/rooms/*.jpg, made with AI, already out of focus), drawn behind
                   everything, above the counter's far end, drifting a little as the guest walks
     the props     a few simple shapes in the room's own materials: a glass case with brass edges, wine fridges and oak barrels,
                   a brass drip tray and warm bulbs, a backlit shelf. They stand where they stand (fixed along the walk), so they
                   pass by as the guest moves, and they keep to their room's side of the line between two rooms (uEdge).
   Nothing here is a dish. Nothing here pretends to be the restaurant's own room: the backdrop is labelled where it shows. */
import {
  Group, Mesh, PlaneGeometry, BoxGeometry, CylinderGeometry, SphereGeometry, ShaderMaterial, Vector2, Vector3, Color,
  DoubleSide, AdditiveBlending
} from 'three';
import * as SH from './shaders.js';

const PROP_VS = `varying vec3 vW; varying vec3 vN; varying vec3 vL;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vL = position; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const LIT = `
uniform vec3 uCam; uniform vec3 uLampPos; uniform vec3 uPool; uniform float uDim; uniform float uFade; uniform float uGlow; uniform vec3 uLamp; uniform vec3 uAmb;
varying vec3 vW; varying vec3 vN; varying vec3 vL;
${SH.LANE}
float poolAt(vec3 w){ float d = length(w.xz - uPool.xy); return uDim / pow(1.0 + d * d / (uPool.z * 2.2), 1.2); }
vec3 shade(vec3 alb, float spec, float shin, float metal){
  vec3 n = normalize(vN), l = normalize(uLampPos - vW), v = normalize(uCam - vW), h = normalize(l + v);
  float pool = 0.35 + 0.65 * poolAt(vW), dif = max(dot(n, l), 0.0) * pool;
  float sp = pow(max(dot(n, h), 0.0), shin) * spec * pool;
  float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 c = alb * (uAmb * 1.6 + uLamp * dif * mix(1.1, 0.35, metal)) + uLamp * sp * mix(1.0, 2.2, metal);
  return c + alb * fr * metal * 0.55 * (0.4 + uLamp);
}`;
/* a plain lit material: wood, stone, brass (metal = 1) */
const PROP_FS = `uniform vec3 uCol; uniform float uMetal; uniform float uShin; uniform float uSpec; uniform float uEmit;
${LIT}
void main(){
  if (ours(vW) < 0.0) discard;
  if (uGlow > 0.5) { gl_FragColor = vec4(uCol * uEmit * uFade, 1.0); return; }
  vec3 c = shade(uCol * uCol, uSpec, uShin, uMetal) + uCol * uEmit;
  gl_FragColor = vec4(sqrt(max(c, 0.0)) * uFade * smoothstep(0.0, uEdge.z, ours(vW)), 1.0);
}`;
/* oak barrels: staves round the barrel, three iron hoops, darker heads (local coordinates of a unit cylinder) */
const BARREL_FS = `
${LIT}
float hash(float n){ return fract(sin(n * 127.1) * 43758.5); }
void main(){
  if (ours(vW) < 0.0) discard;
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float a = atan(vL.z, vL.x), st = floor(a / 6.2832 * 22.0), y = vL.y;
  float bulge = 1.0;
  vec3 oak = mix(vec3(0.42, 0.24, 0.12), vec3(0.58, 0.36, 0.18), hash(st + 3.0)) * (0.85 + 0.15 * sin(y * 40.0 + hash(st) * 9.0));
  float seam = smoothstep(0.035, 0.0, abs(fract(a / 6.2832 * 22.0) - 0.5) - 0.46);
  oak *= 1.0 - 0.45 * seam;
  float hoop = max(max(smoothstep(0.025, 0.0, abs(abs(y) - 0.40)), smoothstep(0.02, 0.0, abs(abs(y) - 0.22) - 0.015)), 0.0);
  vec3 alb = mix(oak, vec3(0.10, 0.09, 0.08), hoop);
  if (abs(vL.y) > 0.548 && length(vL.xz) < 0.54) alb = vec3(0.30, 0.17, 0.08) * (0.8 + 0.2 * sin(length(vL.xz) * 60.0));
  vec3 c = shade(alb * alb, mix(0.12, 0.6, hoop), mix(14.0, 50.0, hoop), hoop * 0.8) * bulge;
  gl_FragColor = vec4(sqrt(max(c, 0.0)) * uFade * smoothstep(0.0, uEdge.z, ours(vW)), 1.0);
}`;
/* a wall of wine fridges seen from the walk: dark glass doors in steel frames, racks lit warm white, the ends of bottles lying in
   them, a little mist at the foot of the glass. Drawn on one long box; the doors are laid out along the walk (world z) */
const FRIDGE_FS = `uniform float uTime;
${LIT}
float hash2(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
void main(){
  if (ours(vW) < 0.0) discard;
  float door = 1.42, u = vW.z / door, ix = floor(u), fu = fract(u), y = vW.y;
  float frame = max(smoothstep(0.045, 0.02, fu) , smoothstep(0.955, 0.98, fu)) + smoothstep(0.1, 0.05, y) + smoothstep(3.1, 3.16, y);
  float face = step(0.6, abs(vN.x));
  float rack = fract((y - 0.18) / 0.36), shelf = smoothstep(0.08, 0.0, abs(rack - 0.04));
  vec2 cell = vec2(fu * 6.0, (y - 0.18) / 0.36); vec2 id = floor(cell), f = fract(cell) - 0.5;
  float bottle = smoothstep(0.36, 0.30, length(f * vec2(1.0, 1.1))) * step(0.18, y) * step(y, 3.0) * step(0.15, hash2(id + ix * 7.0));
  float foil = smoothstep(0.14, 0.08, length(f * vec2(1.0, 1.1)));
  vec3 glassTint = mix(vec3(0.20, 0.03, 0.05), vec3(0.42, 0.40, 0.18), step(0.55, hash2(id * 1.3 + ix)));
  vec3 inside = vec3(0.012, 0.011, 0.012) + vec3(1.0, 0.86, 0.66) * shelf * 0.55;
  inside = mix(inside, glassTint * 0.30 + vec3(1.0, 0.85, 0.6) * foil * 0.25, bottle * 0.9);
  inside += vec3(1.0, 0.9, 0.75) * 0.06 * smoothstep(0.5, 0.0, abs(fu - 0.5)) ;
  float mist = smoothstep(0.9, 0.15, y) * 0.12;
  vec3 v = normalize(uCam - vW); float fr = pow(1.0 - abs(dot(normalize(vN), v)), 2.0);
  vec3 c = inside + vec3(0.75, 0.82, 0.9) * (mist + fr * 0.10);
  c = mix(c, shade(vec3(0.30, 0.31, 0.33), 0.5, 40.0, 1.0), clamp(frame, 0.0, 1.0));
  if (face < 0.5) c = shade(vec3(0.10, 0.10, 0.11), 0.3, 30.0, 0.6);
  if (uGlow > 0.5) { gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * shelf * 0.5 * face * (1.0 - clamp(frame, 0.0, 1.0)) * uFade, 1.0); return; }
  gl_FragColor = vec4(c * uFade * smoothstep(0.0, uEdge.z, ours(vW)), 1.0);
}`;
/* boutique shelves and the cocktail bar's back-bar: the bar's own shelves of bottles, lit from behind, along the walk */
const SHELF_FS = `uniform vec3 uWarm; uniform float uDepth;
uniform vec3 uCam; uniform float uFade; uniform float uGlow; varying vec3 vW; varying vec3 vN; varying vec3 vL;
${SH.LANE}
${SH.BACKBAR}
void main(){
  if (ours(vW) < 0.0) discard;
  vec3 c = backbar(vec2(vW.z * 0.9, vW.y - 0.25)) * uWarm * 1.5;
  if (uGlow > 0.5) { gl_FragColor = vec4(max(c - 0.18, 0.0) * 0.6 * uFade, 1.0); return; }
  gl_FragColor = vec4(c * uFade * smoothstep(0.0, uEdge.z, ours(vW)), 1.0);
}`;
/* glass: almost nothing, a sheen that runs down it and a brighter edge where it is seen at a slant */
const GLASS_FS = `uniform vec3 uTintG; uniform float uK;
uniform vec3 uCam; uniform float uFade; uniform float uGlow; varying vec3 vW; varying vec3 vN; varying vec3 vL;
${SH.LANE}
void main(){
  if (ours(vW) < 0.0) discard;
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0); return; }
  vec3 v = normalize(uCam - vW); float fr = pow(1.0 - abs(dot(normalize(vN), v)), 3.0);
  float sheen = smoothstep(0.0, 1.0, sin(vW.z * 0.55 + vW.y * 1.7) * 0.5 + 0.5) * 0.35 + 0.65;
  float a = (0.035 + 0.30 * fr) * sheen * uK;
  gl_FragColor = vec4(uTintG * a * uFade, 1.0);
}`;
/* a light: warm bulbs, the strip of light inside the case. It gives off light, so it blooms */
const EMIT_FS = `uniform vec3 uCol; uniform float uK; uniform float uFade; uniform float uGlow; varying vec3 vW; varying vec3 vN; varying vec3 vL;
${SH.LANE}
void main(){ if (ours(vW) < 0.0) discard; vec3 c = uCol * uK; gl_FragColor = vec4((uGlow > 0.5 ? c * 0.9 : c) * uFade, 1.0); }`;

/* The backdrop: a full-screen picture behind everything. vNdc runs -1…1 over the screen; uLine = where the counter ends (screen
   height, -1…1): the picture sits on that line and rises to the top of the screen. */
const PLATE_VS = 'varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 0.99999, 1.0); }';
const PLATE_FS = `uniform sampler2D map; uniform float uFade; uniform float uGlow; uniform float uLine; uniform float uAspect; uniform float uImg; uniform vec2 uDrift; uniform float uK; uniform vec3 uTint;
varying vec2 vNdc;
void main(){
  vec2 s = vNdc * 0.5 + 0.5; float line = uLine * 0.5 + 0.5, hR = max(1.0 - line, 0.3);
  float imgH = max(hR * 1.5, 1.0 / (uImg / uAspect)), imgW = imgH * uImg / uAspect;      // the picture covers the width and a little more than the height above the line
  vec2 uv = vec2((s.x - 0.5) / imgW + 0.5 + uDrift.x, (s.y - (line - hR * 0.32)) / imgH + uDrift.y);
  vec3 c = texture2D(map, clamp(uv, vec2(0.002), vec2(0.998))).rgb; c *= c;
  float near = smoothstep(line - 0.06, line + 0.16, s.y);                               // it comes out of the shadow at the counter's far end
  c *= mix(0.18, 1.0, near) * uK * uTint;
  c *= 1.0 - 0.35 * smoothstep(0.55, 1.0, abs(s.x - 0.5) * 2.0);
  if (uGlow > 0.5) { gl_FragColor = vec4(max(sqrt(c) - 0.62, 0.0) * 1.3 * uFade, 1.0); return; }
  gl_FragColor = vec4(sqrt(c) * uFade, 1.0);
}`;
/* the room's counter: the bar's lit slab, reflecting the backdrop, ending `wall` behind the focus where it fades into it */
const ROOM_FS = `
uniform sampler2D map; uniform sampler2D hmap; uniform float uSize; uniform float uSpec; uniform float uShin; uniform float uBump;
uniform float uGlow; uniform float uFade; uniform vec3 uLamp; uniform vec3 uCam; uniform vec3 uLampPos; uniform vec3 uPool; uniform float uDim; uniform vec2 uFar;
uniform float uBack; uniform float uGloss; uniform sampler2D uPlate; uniform vec3 uAmb; uniform float uYaw;
varying vec3 vW;
${SH.LANE}
void main(){
  float mine = ours(vW); if (mine < 0.0) discard;
  float toBack = vW.z - uBack; if (toBack < 0.0) discard;
  float a = smoothstep(0.0, 1.6, toBack);
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, a); return; }
  vec2 uv = vW.xz / uSize;
  vec3 alb = texture2D(map, uv).rgb; alb *= alb;
  float e = 1.0 / 512.0;
  vec2 g = vec2(texture2D(hmap, uv + vec2(e, 0.0)).r - texture2D(hmap, uv - vec2(e, 0.0)).r, texture2D(hmap, uv + vec2(0.0, e)).r - texture2D(hmap, uv - vec2(0.0, e)).r) * uBump;
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y)), l = normalize(uLampPos - vW), v = normalize(uCam - vW);
  float d = length(vW.xz - uPool.xy), pool = uDim / pow(1.0 + d * d / uPool.z, 1.5);
  float dif = max(dot(n, l), 0.0) * pool, sp = pow(max(dot(n, normalize(l + v)), 0.0), uShin) * uSpec * pool;
  vec3 col = alb * (uAmb + uLamp * dif * 1.25) + uLamp * sp;
  col *= 1.0 - 0.5 * smoothstep(uFar.x, uFar.y, abs(vW.z - uPool.y));
  vec3 r = reflect(-v, normalize(vec3(n.x * 0.35, 1.0, n.z * 0.35)));
  float ca = cos(uYaw), sa = sin(uYaw); vec2 rr = vec2(r.x * ca - r.z * sa, r.x * sa + r.z * ca);      // the backdrop stands across the eye's own direction
  vec2 pu = vec2(0.5 + rr.x * 0.55, clamp(0.18 + r.y * 1.1, 0.02, 0.98));
  vec3 rf = texture2D(uPlate, pu, 2.5).rgb; rf *= rf;
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(v, n), 0.0), 4.0);
  col += rf * fres * uGloss * 1.4 * smoothstep(-0.2, -0.9, r.z);
  col *= 1.0 - 0.55 * smoothstep(5.0, 0.0, toBack) * 0.5;
  float j; float edge = laneEdge(vW, j); col *= mix(0.32, 1.0, smoothstep(-0.03, 0.03, edge));      // a case or a counter of its own width: the room around it is quieter
  gl_FragColor = vec4(sqrt(max(col, 0.0)) * uFade * smoothstep(0.0, uEdge.z, mine), a);
}`;

/* a riser in the vitrine: a short drum of pale stone with a brass edge, the dish standing on its top (local y = 0) */
const RISER_FS = `uniform float uBase;
${LIT}
void main(){
  if (ours(vW) < 0.0) discard;
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float band = smoothstep(0.035, 0.02, -vL.y) + smoothstep(0.03, 0.0, abs(vL.y - uBase));
  vec3 alb = mix(vec3(0.93, 0.91, 0.88) * (0.94 + 0.06 * sin(vW.x * 9.0 + vW.y * 23.0)), vec3(0.80, 0.60, 0.31), clamp(band, 0.0, 1.0));
  if (vN.y > 0.9) alb = vec3(0.95, 0.94, 0.92);
  vec3 c = shade(alb * alb, mix(0.3, 0.9, band), mix(40.0, 70.0, band), band);
  gl_FragColor = vec4(sqrt(max(c, 0.0)) * uFade * smoothstep(0.0, uEdge.z, ours(vW)), 1.0);
}`;
const riserGeo = new Map();
export function makeRiser(h, cu, U) {
  let gm = riserGeo.get(h); if (!gm) { gm = new CylinderGeometry(1.24, 1.26, h, 64, 1, false).translate(0, -h / 2, 0); riserGeo.set(h, gm); }
  const u = { uCam: cu.uCam, uLampPos: cu.uLampPos, uPool: cu.uPool, uDim: cu.uDim, uFade: cu.uFade, uGlow: U.glow, uLamp: cu.uLamp, uAmb: cu.uAmb, uLane: cu.uLane, uLanes: cu.uLanes, uEdge: cu.uEdge, uBase: { value: -h } };
  const m = new Mesh(gm, new ShaderMaterial({ uniforms: u, vertexShader: PROP_VS, fragmentShader: RISER_FS }));
  m.frustumCulled = false; m.renderOrder = -2.6; return m;      // under the dish's shadow, which lies on its top
}

const PERIOD = { vitrine: 4.6, cellar: 1.42, taps: 3.2, cocktail: 3 };

export function createRoomSet(kind, preset, ctx) {
  const g = new Group(), cu = ctx.u, keep = [], geos = [], mats = [];
  const def = preset.surface(), amb = def.amb || [.08, .07, .06];
  Object.assign(cu, { uBack: { value: -12 }, uGloss: { value: def.gloss == null ? 1 : def.gloss }, uPlate: { value: ctx.blank }, uAmb: { value: new Vector3().fromArray(amb) }, uYaw: { value: preset.yaw || 0 } });
  const own = (m) => { mats.push(m); return m; }, geo = (x) => { geos.push(x); return x; };
  const counter = new Mesh(ctx.ground, own(new ShaderMaterial({ uniforms: cu, vertexShader: SH.WORLD_VS, fragmentShader: ROOM_FS, transparent: true })));
  counter.frustumCulled = false; counter.scale.set(260, 1, 260); counter.renderOrder = -3; g.add(counter);
  const plateU = { map: { value: ctx.blank }, uFade: cu.uFade, uGlow: ctx.U.glow, uLine: { value: 0 }, uAspect: { value: 1 }, uImg: { value: 1.5 }, uDrift: { value: new Vector2() }, uK: { value: def.plateK || 1 }, uTint: { value: new Vector3(1, 1, 1) } };
  const plate = new Mesh(geo(new PlaneGeometry(2, 2)), own(new ShaderMaterial({ uniforms: plateU, vertexShader: PLATE_VS, fragmentShader: PLATE_FS, depthWrite: false, depthTest: false })));
  plate.frustumCulled = false; plate.renderOrder = -100; g.add(plate);
  const base = { uCam: cu.uCam, uLampPos: cu.uLampPos, uPool: cu.uPool, uDim: cu.uDim, uFade: cu.uFade, uGlow: ctx.U.glow, uLamp: cu.uLamp, uAmb: cu.uAmb, uLane: cu.uLane, uLanes: cu.uLanes, uEdge: cu.uEdge };
  const lit = (col, metal, shin, spec, emit) => own(new ShaderMaterial({ uniforms: Object.assign({ uCol: { value: new Color().fromArray(col) }, uMetal: { value: metal }, uShin: { value: shin }, uSpec: { value: spec }, uEmit: { value: emit || 0 } }, base), vertexShader: PROP_VS, fragmentShader: PROP_FS }));
  const emit = (col, k) => own(new ShaderMaterial({ uniforms: Object.assign({ uCol: { value: new Color().fromArray(col) }, uK: { value: k } }, base), vertexShader: PROP_VS, fragmentShader: EMIT_FS }));
  const glass = (tint, k) => own(new ShaderMaterial({ uniforms: Object.assign({ uTintG: { value: new Color().fromArray(tint) }, uK: { value: k } }, base), vertexShader: PROP_VS, fragmentShader: GLASS_FS, transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending }));
  const shelf = (warm) => own(new ShaderMaterial({ uniforms: Object.assign({ uWarm: { value: new Vector3().fromArray(warm) }, uDepth: { value: 0 } }, base), vertexShader: PROP_VS, fragmentShader: SHELF_FS, side: DoubleSide }));
  const add = (m, mat, x, y, z, follow) => { const o = new Mesh(m, mat); o.position.set(x, y, z); o.frustumCulled = false; g.add(o); if (follow) keep.push({ o, x, dz: z, follow }); return o; };
  const side = (x) => x;
  const brass = lit([.78, .58, .30], 1, 60, .9);
  const long = 70;                                            // things that are the same all along the walk follow the eye; their pattern stays put
  const repeat = [];                                          // things that stand at fixed places along the walk: a few, moved on as the guest walks
  const row = (n, make) => { for (let k = 0; k < n; k++) repeat.push({ o: make(k), k, n }); };

  if (kind === 'vitrine') {
    const W = 1.62, Hc = 1.72;
    [-W, W].forEach((x) => {
      add(geo(new PlaneGeometry(long, Hc)).rotateY(Math.PI / 2).translate(0, Hc / 2, 0), glass([.92, .97, 1], 1), x, 0, 0, 'z');
      add(geo(new BoxGeometry(.05, .05, long)), brass, x, Hc, 0, 'z');
      add(geo(new BoxGeometry(.07, .09, long)), brass, x, .04, 0, 'z');
      add(geo(new BoxGeometry(.03, .025, long)), emit([1, .93, .82], 1.15), x * .97, Hc - .06, 0, 'z');      // the light strip inside the case
    });
    const post = geo(new BoxGeometry(.06, Hc, .06)).translate(0, Hc / 2, 0);
    row(10, (k) => add(post, brass, k % 2 ? W : -W, 0, 0));
  } else if (kind === 'cellar') {
    add(geo(new BoxGeometry(1.0, 3.3, long)).translate(0, 1.65, 0), own(new ShaderMaterial({ uniforms: Object.assign({ uTime: ctx.U.time }, base), vertexShader: PROP_VS, fragmentShader: FRIDGE_FS })), side(-2.25), 0, 0, 'z');
    add(geo(new PlaneGeometry(long, 3.6)).rotateY(-Math.PI / 2).translate(0, 1.8, 0), shelf([1.05, .82, .62]), side(3.1), 0, 0, 'z');      // the boutique's shelves behind the barrels
    const barrel = geo(new CylinderGeometry(.56, .56, 1.1, 40, 6, false));
    { const p = barrel.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 1 + .09 * (1 - (y / .55) * (y / .55)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } barrel.computeVertexNormals(); }      // a barrel's belly
    const bm = own(new ShaderMaterial({ uniforms: Object.assign({}, base), vertexShader: PROP_VS, fragmentShader: BARREL_FS }));
    row(8, () => add(barrel, bm, side(2.05), .55, 0));
    row(8, () => { const o = add(barrel, bm, side(2.2), 1.66, 0); o.rotation.z = Math.PI / 2; o.scale.set(.92, .92, .92); return o; });
  } else if (kind === 'taps') {
    add(geo(new BoxGeometry(.62, .035, long)), lit([.62, .46, .24], 1, 40, .7), .27, .018, 0, 'z');      // the drip tray under the glasses
    add(geo(new CylinderGeometry(.045, .045, long, 12)).rotateX(Math.PI / 2), brass, side(1.35), .42, 0, 'z');      // a brass rail along the guest's side
    const bulb = geo(new SphereGeometry(.13, 16, 12)), cord = geo(new CylinderGeometry(.008, .008, 2.4, 4).translate(0, 1.2, 0));
    const warm = emit([1, .72, .36], 1.4), dark = lit([.05, .05, .05], 0, 10, .1);
    row(6, () => { const o = add(bulb, warm, -.6, 3.1, 0), c = new Mesh(cord, dark); c.frustumCulled = false; o.add(c); return o; });
  } else if (kind === 'cocktail') {
    add(geo(new PlaneGeometry(long, 1.9)).rotateY(Math.PI / 2).translate(0, .95, 0), shelf([.8, 1.15, 1.25]), side(-2.6), 0, 0, 'z');      // the back-bar, lit from behind; the backdrop rises above it
    add(geo(new CylinderGeometry(.04, .04, long, 12)).rotateX(Math.PI / 2), brass, side(1.55), .05, 0, 'z');
  }
  g.visible = false;

  let plateTex = null;
  function setPlate(tex) { plateTex = tex; plateU.map.value = tex; cu.uPlate.value = tex; const im = tex.image; if (im && im.width) plateU.uImg.value = im.width / im.height; }
  const P = new Vector3();
  /* each frame: the counter and the long things follow the eye; the repeated things are laid at their fixed places nearest it;
     the backdrop sits on the counter's far end as the camera sees it */
  function place(fx, fz, camera, w, h, t) {
    const back = fz - (preset.wall || 9); cu.uBack.value = back;
    counter.position.set(fx, 0, fz);
    keep.forEach((k) => { k.o.position.z = fz + k.dz; });
    const per = PERIOD[kind] || 3;
    repeat.forEach((r) => {
      const idx = kind === 'vitrine' ? r.k >> 1 : r.k, slot = Math.floor(fz / per) + 1 - idx;      // from one place ahead of the focus to several behind it
      r.o.position.z = slot * per + (kind === 'cellar' && r.o.rotation.z ? per * .5 : 0);
    });
    P.set(fx, 0, back).project(camera); plateU.uLine.value = Math.max(-.6, Math.min(.85, P.y)); plateU.uAspect.value = w / h;
    plateU.uDrift.value.set(-fz * .0035 + Math.sin(t * .07) * .006, Math.sin(t * .05) * .004);
  }
  function dispose() { mats.forEach((m) => m.dispose()); geos.forEach((x) => x.dispose()); }
  return { g, counter, plate, setPlate, place, dispose, def, get plateTex() { return plateTex; } };
}
