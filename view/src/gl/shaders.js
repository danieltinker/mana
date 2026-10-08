/* Shaders. The dish, shadow, projector and bloom programs are carried over from the original Halom engine (base/engine.js);
   the changes are marked with [view]. A relief is ONE photo: colour JPG + PNG (R = height, G = matte), un-projected from the
   photo's own camera elevation so that, seen from that angle and at rest, it is the photo. */
export const DISH_VS = `
uniform sampler2D aux; uniform float uH; uniform float uE; uniform float uGlitch; uniform float uTime; uniform vec2 uO;
varying vec2 vUv; varying float vY; varying vec3 vW;
void main(){
  vUv = uv;
  float h = texture2D(aux, uv).r * uH;
  float se = sin(uE), ce = cos(uE);
  // the photo was shot from elevation uE: lay its plane flat, push each pixel out along the old view axis
  vec2 q = position.xy - uO;
  vec3 p = vec3(q.x, h * se, -q.y / se + h * ce);
  float n = fract(sin(floor(uv.y * 30.0) * 91.7 + floor(uTime * 24.0) * 13.3) * 43758.5453);
  p.x += (n - 0.5) * 0.2 * uGlitch * step(0.5, fract(n * 7.3));
  vY = p.y;
  vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
export const DISH_FS = `
uniform sampler2D map; uniform sampler2D aux;
uniform float uH; uniform float uFocus; uniform float uReveal; uniform float uTime; uniform float uScan; uniform float uGlitch;
uniform float uGlow; uniform float uMirror; uniform vec3 uAccent; uniform vec3 uCenter;
uniform float uHolo; uniform float uLight; uniform float uRefl; uniform vec4 uMask; uniform float uSat;   // [view] uSat: a sold-out dish is drained of colour · uHolo: 1 = drawn as a projection (a placeholder, or the projector stage)
varying vec2 vUv; varying float vY; varying vec3 vW;
void main(){
  vec4 ax = texture2D(aux, vUv);
  float a = ax.g;
  if (a < 0.03) discard;
  if (uMirror > 0.5 && uGlow > 0.5) discard;
  vec3 c = texture2D(map, vUv).rgb;
  if (uHolo < 0.5) {            // on a table: the dish as photographed, under the lamp; no hologram treatment
    float fade = a * uReveal;
    vec3 ct = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, uSat) * uLight;
    if (uGlow > 0.5) { gl_FragColor = vec4(ct * smoothstep(0.74, 1.0, dot(c, vec3(0.299, 0.587, 0.114))) * 0.1, fade); return; }
    if (uMirror > 0.5) {        // a glossy table gives standing things a faint reflection
      float inside = 1.0 - smoothstep(uMask.y - 0.3, uMask.y, abs(vW.x - uMask.x));      // [view] only on its own table top
      gl_FragColor = vec4(ct * 0.85, fade * uRefl * inside * exp(-vY * 2.6)); return;
    }
    gl_FragColor = vec4(ct, fade); return;
  }
  if (uGlitch > 0.01) { vec2 ca = vec2(0.016 * uGlitch, 0.0); c.r = texture2D(map, vUv + ca).r; c.b = texture2D(map, vUv - ca).b; }
  float tx = 1.0 / 256.0;
  float gx = texture2D(aux, vUv + vec2(tx, 0.0)).r - texture2D(aux, vUv - vec2(tx, 0.0)).r;
  float gy = texture2D(aux, vUv + vec2(0.0, tx)).r - texture2D(aux, vUv - vec2(0.0, tx)).r;
  float steep = smoothstep(0.08, 0.5, length(vec2(gx, gy)) * uH * 22.0);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 holo = mix(uAccent * (pow(l, 0.8) * 1.45 + 0.08), c * 1.05, 0.7);            // [view] an illustration keeps about 70% of its own colour and leans lightly towards the menu's accent
  vec3 col = mix(holo, c * 1.03, uFocus);
  col *= 1.0 - 0.12 * steep * (1.0 - uFocus * 0.5);
  float sl = 0.5 + 0.5 * sin(gl_FragCoord.y * 2.1 + uTime * 0.5);                  // fine scan lines, drifting slowly: no flicker
  col *= 1.0 - mix(0.13, 0.018, uFocus) * sl;
  float edge = smoothstep(0.03, 0.5, a) * (1.0 - smoothstep(0.6, 0.99, a));
  vec3 em = uAccent * edge * mix(0.55, 0.5, uFocus);
  em += uAccent * exp(-pow((vY - uScan) / 0.026, 2.0)) * 0.6;
  float r = length(vUv - 0.5) * 1.45, front = uReveal * 1.3;
  float vis = 1.0 - smoothstep(front - 0.03, front, r);
  em += uAccent * smoothstep(front - 0.16, front - 0.02, r) * vis * 1.3;
  float bar = step(0.8, fract(sin(floor(vUv.y * 30.0) * 12.9898 + floor(uTime * 24.0) * 7.1) * 43758.5453));
  em += uAccent * uGlitch * (0.25 + bar * 0.6);
  float al = a * vis * mix(0.84, 1.0, uFocus);
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))) * 0.7, col, uSat) * mix(0.5, 1.0, uLight); em *= mix(0.35, 1.0, uSat) * mix(0.45, 1.0, uLight);   // [view]
  if (uGlow > 0.5) {            // light-only pass, feeds the bloom; the dish still hides what is behind it
    gl_FragColor = vec4(em + holo * (1.0 - uFocus) * 0.07 + c * smoothstep(0.7, 1.0, l) * 0.12 * uFocus, a * vis);
    return;
  }
  col += em;
  if (uMirror > 0.5) {          // reflection in the projector glass
    float rr = length(vW.xz - uCenter.xz);
    float m = (1.0 - smoothstep(1.0, 1.3, rr)) * exp(-vY * 4.5);
    gl_FragColor = vec4(mix(col, uAccent * (l + 0.1), 0.4), al * 0.34 * m);
    return;
  }
  gl_FragColor = vec4(col, al);
}`;
export const BASE_FS = `
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); float an = atan(p.y, p.x);
  float ring = smoothstep(0.014, 0.0, abs(r - 0.955)) * 1.3 + 0.6 * smoothstep(0.01, 0.0, abs(r - 0.8));
  float dash = step(0.5, fract(an * 14.0 / 6.2831853 + uTime * 0.08)) * smoothstep(0.02, 0.0, abs(r - 0.875));
  float tick = step(0.86, fract(an * 60.0 / 6.2831853)) * smoothstep(0.03, 0.0, abs(r - 0.68)) * 0.6;
  float lens = smoothstep(0.34, 0.0, r) * 0.4 + smoothstep(0.012, 0.0, abs(r - 0.36)) * 0.7;
  float glow = pow(max(0.0, 1.0 - r), 2.0) * 0.5;
  float a = (ring + dash * 0.9 + tick + glow + lens * uOn) * mix(0.3, 1.0, uOn) * step(r, 1.0);
  float glass = step(r, 1.0) * 0.8;          // dark glass under the light
  gl_FragColor = vec4(uAccent * a, glass);
}`;
/* [view] a placeholder standing on a real table has no projector puck: only a ring of light on the wood under it */
export const RING_FS = `
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); float an = atan(p.y, p.x);
  float ring = smoothstep(0.016, 0.0, abs(r - 0.93)) * 1.2 + 0.5 * smoothstep(0.01, 0.0, abs(r - 0.80));
  float dash = step(0.5, fract(an * 14.0 / 6.2831853 + uTime * 0.08)) * smoothstep(0.02, 0.0, abs(r - 0.865));
  float glow = pow(max(0.0, 1.0 - r), 1.5) * 0.5;
  float a = (ring + dash * 0.8 + glow) * mix(0.3, 1.0, uOn) * step(r, 1.0);
  gl_FragColor = vec4(uAccent * a, a);
}`;
export const SIDE_FS = `
uniform vec3 uAccent; uniform float uOn;
varying vec2 vUv;
void main(){
  float lip = smoothstep(0.7, 0.98, vUv.y);
  vec3 body = vec3(0.02, 0.03, 0.045) + uAccent * 0.05;
  gl_FragColor = vec4(body + uAccent * lip * mix(0.35, 1.0, uOn), 1.0);
}`;
export const CONE_FS = `
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  float streak = 0.72 + 0.28 * sin(vUv.x * 190.0 + sin(vUv.x * 37.0) * 4.0);
  float rise = 0.85 + 0.15 * sin(vUv.y * 26.0 - uTime * 3.0);
  float a = pow(1.0 - vUv.y, 1.6) * 0.42 * streak * rise * uOn;
  gl_FragColor = vec4(uAccent * a, a);
}`;
export const BEAM_FS = `
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  float streak = 0.6 + 0.4 * sin(vUv.x * 120.0 + sin(vUv.x * 23.0 + uTime * 0.3) * 5.0);
  float a = pow(1.0 - vUv.y, 2.4) * 0.2 * streak * uOn;
  gl_FragColor = vec4(uAccent * a, a);
}`;
export const HUD_FS = `
uniform vec3 uAccent; uniform float uTime; uniform float uOn; uniform float uKind;
varying vec3 vL;
void main(){
  float r = length(vL.xz), an = atan(vL.z, vL.x) / 6.2831853 + 0.5, a = 0.0;
  if (uKind < 0.5) {            // flat instrument ring around the projector
    float t = an + uTime * 0.012;
    a += smoothstep(0.01, 0.0, abs(r - 1.5)) * 0.55;
    a += step(0.5, fract(t * 180.0)) * smoothstep(0.03, 0.0, abs(r - 1.55)) * 0.4;
    a += step(0.88, fract(t * 12.0)) * smoothstep(0.055, 0.0, abs(r - 1.575)) * 0.9;
    a += smoothstep(0.016, 0.0, abs(r - 1.69)) * step(0.66, fract(-an * 3.0 + uTime * 0.045));
  } else if (uKind < 1.5) {     // tilted orbit with one bright satellite
    float d = abs(fract(an - uTime * 0.07) - 0.5);
    a += smoothstep(0.012, 0.0, abs(r - 1.86)) * (0.2 + 0.9 * smoothstep(0.16, 0.0, d));
    a += smoothstep(0.05, 0.0, length(vec2((fract(an - uTime * 0.07) - 0.5) * 11.7, r - 1.86))) * 1.6;
  } else {                      // scanner hoop that rides up with the scan line
    a += smoothstep(0.011, 0.0, abs(r - 1.3)) * 0.8 + smoothstep(0.12, 0.0, abs(r - 1.3)) * 0.07;
  }
  a *= uOn;
  gl_FragColor = vec4(uAccent * a, a);
}`;
export const FLOOR_FS = `
uniform vec3 uAccent; uniform float uTime; uniform vec2 uHub; uniform float uPulse; uniform float uGlow; uniform vec2 uAt;   // [view] uAt: the light pools under the open item, not the origin
varying vec3 vW;
void main(){
  vec2 q = vW.xz - uHub; float r = length(q); float an = atan(q.y, q.x);
  float rings = smoothstep(0.03, 0.0, abs(fract(r * 0.5) - 0.5) * 2.0 - 0.94);
  float spokes = smoothstep(0.012, 0.0, abs(fract(an * 24.0 / 6.2831853) - 0.5) * 2.0 - 0.985 + 0.012 / max(r, 0.4));
  float d0 = length(vW.xz - uAt);
  float fade = exp(-d0 * 0.16) * smoothstep(13.0, 6.0, d0);
  float pool = exp(-d0 * d0 * 0.22) * 0.5;
  float rp = uPulse * 5.5;
  float ripple = exp(-pow((d0 - rp) / 0.16, 2.0)) * exp(-uPulse * 2.6) * step(1.3, d0) * 1.3;
  float a = ((rings * 0.42 + spokes * 0.26) * fade + pool + ripple) * mix(1.0, 0.45, uGlow);
  gl_FragColor = vec4(uAccent * a * 0.55, a * 0.55);
}`;
export const SHADOW_VS = `
uniform float uE; uniform vec2 uO; uniform float uLen; uniform vec2 uCast;   // [view] uCast: pushed away from wherever the lamp is
varying vec2 vUv;
void main(){
  vUv = uv;
  vec2 q = position.xy - uO;
  vec3 p = vec3(q.x * 1.05, 0.0, -q.y / sin(uE) * uLen * 1.05 - 0.02) + vec3(uCast.x, 0.0, uCast.y);         // the dish's outline on the table, pushed a little away from the lamp
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
export const SHADOW_FS = `
uniform sampler2D aux; uniform float uK;
varying vec2 vUv;
float tap(vec2 o){ return texture2D(aux, vUv + o).g; }
void main(){
  float a = tap(vec2(0.0));
  float near = (a + tap(vec2(0.012, 0.0)) + tap(vec2(-0.012, 0.0)) + tap(vec2(0.0, 0.012)) + tap(vec2(0.0, -0.012))) / 5.0;
  float far = (tap(vec2(0.045, 0.012)) + tap(vec2(-0.045, -0.012)) + tap(vec2(0.012, -0.045)) + tap(vec2(-0.012, 0.045))
             + tap(vec2(0.032, 0.032)) + tap(vec2(-0.032, 0.032)) + tap(vec2(0.032, -0.032)) + tap(vec2(-0.032, -0.032))) / 8.0;
  gl_FragColor = vec4(0.0, 0.0, 0.0, (near * 0.55 + far * 0.45) * uK);
}`;
export const SPARK_VS = `
attribute float aSeed; uniform float uTime; uniform float uPx; uniform float uOn; varying float vA;
void main(){
  float t = fract(aSeed * 7.13 + uTime * (0.05 + 0.07 * fract(aSeed * 3.7)));
  vec3 p = position; p.y = t * 2.5; p.xz *= 1.0 + t * 0.3;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.5 + 3.5 * fract(aSeed * 5.3)) * uPx * 4.6 / -mv.z;
  vA = sin(t * 3.14159) * (0.35 + 0.65 * fract(aSeed * 9.1)) * uOn;
  gl_Position = projectionMatrix * mv;
}`;
export const DUST_VS = `
attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
void main(){
  vec3 p = position;
  p.y = mod(p.y + uTime * (0.03 + 0.05 * aSeed), 5.0);
  p.x += sin(uTime * 0.11 + aSeed * 40.0) * 0.35;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = min((1.0 + 2.6 * fract(aSeed * 5.3)) * uPx * 5.0 / max(-mv.z, 0.5), 7.0 * uPx);
  vA = (0.12 + 0.3 * fract(aSeed * 9.1)) * smoothstep(0.0, 0.6, p.y) * smoothstep(5.0, 3.6, p.y) * (0.6 + 0.4 * sin(uTime * (0.5 + aSeed) + aSeed * 30.0));
  gl_Position = projectionMatrix * mv;
}`;
export const BLUR_FS = `
uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec4 s = texture2D(tex, vUv) * 0.227027;
  s += (texture2D(tex, vUv + dir * 1.384615) + texture2D(tex, vUv - dir * 1.384615)) * 0.316216;
  s += (texture2D(tex, vUv + dir * 3.230769) + texture2D(tex, vUv - dir * 3.230769)) * 0.070270;
  gl_FragColor = s;
}`;
export const BLOOM_FS = `
uniform sampler2D a; uniform sampler2D b; uniform float k; varying vec2 vUv;
void main(){
  vec3 c = (texture2D(a, vUv).rgb * 0.6 + texture2D(b, vUv).rgb * 0.95) * k;
  gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0));
}`;
/* [view] the name of a section, lettered on the table between two courses */
export const TITLE_FS = 'uniform sampler2D map; uniform float uGlow; uniform float uK; uniform float uLight; varying vec2 vUv; void main(){ vec4 t = texture2D(map, vUv); if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, t.a * uK); return; } gl_FragColor = vec4(t.rgb * uLight, t.a * uK); }';
export const UV_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
export const LOCAL_VS = 'varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
export const WORLD_VS = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
export const SPARK_FS = 'uniform vec3 uAccent; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(uAccent * a, a); }';
export const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

/* [view] The table: the original lit surface (albedo squared, bump from the height map, one lamp with a pool of light,
   specular towards the camera), laid out as long tables that run away from the guest, side by side: one per category.
   uLane = x of the open table's middle · half its width · distance to the next table; uLanes = how many tables lie on its
   -x side and on its +x side. uPool = where the lamp's pool falls (x, z) and how wide (r squared); uDim = the lamp's level
   (it goes down and comes up when the guest moves to another table); the far end falls into the dark. */
export const LANE = `
uniform vec4 uLane; uniform vec2 uLanes;
float laneEdge(vec3 w, out float j){ j = clamp(floor((w.x - uLane.x) / uLane.z + 0.5), -uLanes.x, uLanes.y); return uLane.y - abs(w.x - uLane.x - j * uLane.z); }`;
export const TABLE_FS = `
uniform sampler2D map; uniform sampler2D hmap; uniform float uSize; uniform float uSpec; uniform float uShin; uniform float uBump;
uniform float uGlow; uniform float uFade; uniform vec3 uLamp; uniform vec3 uCam;
uniform vec3 uLampPos; uniform vec3 uPool; uniform float uDim; uniform vec2 uFar;
varying vec3 vW;
${LANE}
void main(){
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }      // the table gives off no light, it only hides what is under it
  float j; float edge = laneEdge(vW, j);
  vec2 uv = (vW.xz + vec2(j * 1.731, j * 0.413)) / uSize;
  vec3 alb = texture2D(map, uv).rgb; alb *= alb;
  float e = 1.0 / 512.0;
  vec2 g = vec2(texture2D(hmap, uv + vec2(e, 0.0)).r - texture2D(hmap, uv - vec2(e, 0.0)).r,
                texture2D(hmap, uv + vec2(0.0, e)).r - texture2D(hmap, uv - vec2(0.0, e)).r) * uBump;
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 l = normalize(uLampPos - vW);
  float d = length(vW.xz - uPool.xy);
  float pool = uDim / pow(1.0 + d * d / uPool.z, 1.5);
  float dif = max(dot(n, l), 0.0) * pool;
  vec3 hv = normalize(l + normalize(uCam - vW));
  float sp = pow(max(dot(n, hv), 0.0), uShin) * uSpec * pool;
  vec3 amb = vec3(0.105, 0.097, 0.09) * (0.45 + 0.55 * uDim);                       // the room is dim, never black: the table shows its own wood to every edge of the screen
  vec3 col = alb * (amb + uLamp * dif * 1.25) + uLamp * sp;
  col = mix(col, alb * amb * 0.85, 0.9 * smoothstep(uFar.x, uFar.y, abs(vW.z - uPool.y)));     // far along it: the same wood, in shadow
  col *= 0.7 + 0.3 * smoothstep(0.0, 0.34, edge);                                   // the top darkens a little towards its long edges,
  col += uLamp * alb * 0.5 * pool * smoothstep(0.05, 0.0, abs(edge - 0.035));       // which catch a line of light
  col *= smoothstep(0.0, 0.02, edge);                                              // beside the table: the dark of the room
  gl_FragColor = vec4(sqrt(col) * uFade, 1.0);
}`;
/* [view] A print or a name card: flat paper with a white edge, lit by the same lamp. Never given depth. */
export const CARD_FS = `
uniform sampler2D map; uniform float uLight; uniform float uReveal; uniform float uGlow; uniform float uSat;
uniform vec2 uSize; uniform float uBorder; uniform vec4 uFit; uniform vec3 uTint; uniform float uBlank;
varying vec2 vUv;
void main(){
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, uReveal); return; }
  vec2 p = vUv * uSize; vec3 col = vec3(0.94, 0.92, 0.88);
  if (uBlank > 0.5) { col = vec3(0.80, 0.77, 0.72); }
  else if (uBorder <= 0.0 || (p.x > uBorder && p.y > uBorder && p.x < uSize.x - uBorder && p.y < uSize.y - uBorder)) {
    vec2 uv = uBorder > 0.0 ? (p - uBorder) / (uSize - 2.0 * uBorder) : vUv;
    col = texture2D(map, (uv - 0.5) * uFit.xy + 0.5 + uFit.zw).rgb;
  }
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, uSat);
  gl_FragColor = vec4(col * uTint * uLight, uReveal);
}`;
export const BLOB_FS = `
uniform float uK; varying vec2 vUv;
void main(){ vec2 p = (vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.25, length(p * vec2(1.0, 1.0))); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uK); }`;

/* ================= [view] milestone 2: the bar and the drinks ================= */

/* The back-bar, drawn already out of focus: two shelves of bottles lit warm from behind. One function, used twice:
   by the wall itself and by the counter, which mirrors it. p.x runs along the bar, p.y is height above the counter top. */
export const BACKBAR = `
float bbHash(float n){ return fract(sin(n * 91.345) * 47453.5453); }
vec3 backbar(vec2 p){
  vec3 col = vec3(0.030, 0.024, 0.020) * (0.5 + 0.5 * smoothstep(-1.0, 7.0, p.y));
  for (int i = 0; i < 2; i++) {
    float fi = float(i), sy = -0.05 + fi * 2.75, up = p.y - sy;
    float wash = smoothstep(-0.02, 0.14, up) * smoothstep(2.6, 1.3, up);                    // warm light on the wall above each shelf
    col += vec3(1.0, 0.56, 0.22) * wash * (0.08 + 0.30 * smoothstep(0.1, 2.4, up));
    float cell = 0.78, u = p.x / cell + fi * 0.37, ix = floor(u), fx = (fract(u) - 0.5) * cell;
    float h = 1.2 + 0.8 * bbHash(ix * 1.7 + fi * 13.0), w = 0.17 + 0.10 * bbHash(ix * 3.1 + 2.0);
    float hw = mix(w, w * 0.34, smoothstep(h * 0.60, h * 0.80, up));
    float body = smoothstep(hw + 0.13, hw - 0.09, abs(fx)) * smoothstep(-0.06, 0.14, up) * smoothstep(h + 0.12, h - 0.14, up) * step(0.14, bbHash(ix * 5.3 + fi));
    vec3 tint = mix(vec3(0.46, 0.18, 0.04), vec3(0.10, 0.24, 0.08), step(0.5, bbHash(ix * 7.7)));
    tint = mix(tint, vec3(0.52, 0.44, 0.30), step(0.78, bbHash(ix * 2.9)));
    col = mix(col, tint * (0.07 + 0.80 * wash * (0.45 + 0.55 * bbHash(ix * 9.1))), body * 0.86);   // glass glowing with the light behind it
    col += vec3(1.0, 0.86, 0.62) * smoothstep(0.13, 0.0, length(vec2(fx + w * 0.42, (up - h * 0.42) * 0.3))) * body * 0.30;
    col = mix(col, vec3(0.012, 0.010, 0.009), smoothstep(0.03, -0.02, up) * smoothstep(-0.20, -0.13, up));      // the shelf board
    col += vec3(1.0, 0.60, 0.26) * smoothstep(0.04, 0.0, abs(up + 0.015)) * 0.20;                                 // a line of light on its edge
  }
  return col;
}`;
export const WALL_FS = `
uniform float uFade; uniform float uGlow;
varying vec3 vW;
${BACKBAR}
void main(){
  vec3 c = backbar(vW.xy);
  if (uGlow > 0.5) { gl_FragColor = vec4(max(c - 0.22, 0.0) * 0.5 * uFade, 1.0); return; }
  gl_FragColor = vec4(c * uFade, 1.0);
}`;
/* The counter: the table shader's lit surface as a long slab running away from the guest, plus what makes it a bar:
   the back-bar far ahead, and its light lying on the stone as a soft, stretched reflection that grows as the eye comes down. */
export const COUNTER_FS = `
uniform sampler2D map; uniform sampler2D hmap; uniform float uSize; uniform float uSpec; uniform float uShin; uniform float uBump;
uniform float uGlow; uniform float uFade; uniform vec3 uLamp; uniform vec3 uCam; uniform vec3 uLampPos; uniform vec3 uPool; uniform float uDim; uniform vec2 uFar;
uniform float uBack; uniform float uGloss;
varying vec3 vW;
${LANE}
${BACKBAR}
void main(){
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float j; float edge = laneEdge(vW, j);
  vec2 uv = (vW.xz + vec2(j * 1.731, j * 0.413)) / uSize;
  vec3 alb = texture2D(map, uv).rgb; alb *= alb;
  float e = 1.0 / 512.0;
  vec2 g = vec2(texture2D(hmap, uv + vec2(e, 0.0)).r - texture2D(hmap, uv - vec2(e, 0.0)).r,
                texture2D(hmap, uv + vec2(0.0, e)).r - texture2D(hmap, uv - vec2(0.0, e)).r) * uBump;
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 l = normalize(uLampPos - vW);
  float d = length(vW.xz - uPool.xy);
  float pool = uDim / pow(1.0 + d * d / uPool.z, 1.5);
  float dif = max(dot(n, l), 0.0) * pool;
  vec3 v = normalize(uCam - vW);
  float sp = pow(max(dot(n, normalize(l + v)), 0.0), uShin) * uSpec * pool;
  vec3 amb = vec3(0.085, 0.08, 0.08) * (0.45 + 0.55 * uDim);
  vec3 col = sqrt(alb * (amb + uLamp * dif * 1.25) + uLamp * sp);
  col *= 1.0 - 0.55 * smoothstep(uFar.x, uFar.y, abs(vW.z - uPool.y));
  vec3 r = reflect(-v, normalize(vec3(n.x * 0.35, 1.0, n.z * 0.35)));
  if (r.z < -0.001) {
    float t = (uBack - vW.z) / r.z; vec2 hp = vec2(vW.x + r.x * t, r.y * t);
    vec3 rf = (backbar(hp) + backbar(vec2(hp.x, hp.y * 1.14)) + backbar(vec2(hp.x, hp.y * 0.88))) / 3.0;       // a honed surface smears the light upward
    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(v, n), 0.0), 4.0);
    col += rf * fres * uGloss * smoothstep(9.0, 1.0, hp.y) * (0.3 + 0.7 * uDim);
  }
  col *= 0.75 + 0.25 * smoothstep(0.0, 0.3, edge);
  col += vec3(1.0, 0.72, 0.42) * 0.05 * pool * smoothstep(0.05, 0.0, abs(edge - 0.035));       // the edge of the counter catches a little light
  col *= smoothstep(0.0, 0.02, edge) * smoothstep(0.0, 1.2, vW.z - uBack);
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

/* What glass and liquid reflect: a small made-up room, no image. A soft lamp above and in front, a tall strip to one side
   (the long highlight down a bottle), the back-bar's warm glow behind, a little of the counter from below. */
export const ENV = `
vec3 env(vec3 d){
  vec3 c = vec3(0.022, 0.019, 0.017);
  c += vec3(1.0, 0.60, 0.26) * smoothstep(0.15, -0.85, d.z) * smoothstep(-0.30, 0.10, d.y) * smoothstep(0.80, 0.25, d.y) * 0.50;
  c += vec3(1.0, 0.96, 0.90) * smoothstep(0.90, 0.985, dot(d, normalize(vec3(-0.45, 0.72, 0.52)))) * 1.9;
  float az = atan(d.x, d.z);
  c += vec3(0.92, 0.96, 1.0) * smoothstep(0.085, 0.03, abs(az - 0.95)) * smoothstep(-0.15, 0.15, d.y) * smoothstep(0.92, 0.62, d.y) * 1.1;
  c += vec3(1.0, 0.94, 0.86) * smoothstep(0.05, 0.015, abs(az + 1.25)) * smoothstep(-0.05, 0.2, d.y) * smoothstep(0.8, 0.5, d.y) * 0.5;
  c += vec3(0.10, 0.09, 0.085) * smoothstep(0.0, -0.7, d.y);
  return c;
}`;
export const DRINK_VS = `
varying vec3 vN; varying vec3 vW; varying vec3 vL; varying vec2 vUv;
void main(){
  vUv = uv; vL = position;
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const DRINK_COMMON = `
uniform vec3 uCam; uniform float uReveal; uniform float uLight; uniform float uSat; uniform float uGlow; uniform float uMirror; uniform float uRefl;
varying vec3 vN; varying vec3 vW; varying vec3 vL; varying vec2 vUv;
${ENV}
vec3 grey(vec3 c){ return mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, uSat); }
float mirrorFade(){ return uMirror > 0.5 ? uRefl * exp(vW.y * 1.5) * 0.9 : 1.0; }      // below the counter: the reflection, fading with depth
`;
/* Glass. uDark 0 = clear (you see through it; edges and highlights carry it), 1 = bottle glass (dark, coloured, opaque).
   A bottle can show what is in it: below the fill plane the inside colour takes over. */
export const GLASS_FS = `
uniform vec3 uTint; uniform float uDark; uniform vec3 uInside; uniform float uHasFill; uniform vec3 uUp; uniform float uFillD;
${DRINK_COMMON}
void main(){
  vec3 N = normalize(vN), V = normalize(uCam - vW);
  if (dot(N, V) < 0.0) N = -N;
  float nv = max(dot(N, V), 0.0), F = pow(1.0 - nv, 3.0);
  vec3 e = env(reflect(-V, N));
  vec3 clear = e * (0.22 + 0.95 * F) + uTint * 0.035;
  float aClear = clamp(0.045 + 0.72 * F + dot(e, vec3(0.34)) * 0.95, 0.0, 0.96);
  vec3 body = uTint * (0.30 + 0.70 * nv) * (0.35 + 0.65 * uLight) + uTint * 1.6 * F * 0.35 + e * (0.26 + 0.80 * F);
  vec3 col = mix(clear, body, uDark); float a = mix(aClear, 1.0, uDark);
  if (uHasFill > 0.5 && dot(vL, uUp) < uFillD) {                    // wine seen through a clear bottle
    col = mix(uInside * 1.25, uInside * 0.62, pow(nv, 1.6)) * (0.34 + 0.66 * uLight) * (1.0 - 0.5 * F) + e * (0.30 + 1.0 * F) + uTint * 0.03; a = 1.0;
  }
  col = grey(col);
  if (uGlow > 0.5) { gl_FragColor = vec4(max(e - 0.8, 0.0) * 0.10 * uReveal, a * uReveal); return; }
  gl_FragColor = vec4(col, a * uReveal * mirrorFade());
}`;
/* Paper, foil, tin, chrome: something solid, lit by the lamp. uMetal 0 = paper (takes a printed map), 1 = polished metal. */
export const SOLID_FS = `
uniform sampler2D map; uniform float uUseMap; uniform vec3 uTint; uniform float uMetal; uniform vec3 uLampPos;
${DRINK_COMMON}
void main(){
  vec3 N = normalize(vN), V = normalize(uCam - vW);
  if (dot(N, V) < 0.0) N = -N;
  float nv = max(dot(N, V), 0.0), F = pow(1.0 - nv, 3.0);
  vec3 base = uUseMap > 0.5 ? texture2D(map, vUv).rgb : uTint;
  vec3 e = env(reflect(-V, N));
  float dif = 0.42 + 0.58 * max(dot(N, normalize(uLampPos - vW)), 0.0);
  vec3 paper = base * dif * (0.30 + 0.70 * uLight) * vec3(1.0, 0.97, 0.92) + e * F * 0.10;
  vec3 metal = base * (0.16 * uLight + e * 1.7 + 0.10);
  vec3 col = grey(mix(paper, metal, uMetal));
  if (uGlow > 0.5) { gl_FragColor = vec4(max(e - 0.8, 0.0) * 0.12 * uMetal * uReveal, uReveal); return; }
  gl_FragColor = vec4(col, uReveal * mirrorFade());
}`;
/* What is in the glass. The mesh is the whole inside of the glass; everything above the surface is thrown away, so "rising"
   is one number. Colour deepens where you look through more of it, a thin bright line marks the meniscus, light from the room
   comes through bent. Beer keeps a head above the line: the same mesh, another colour. */
export const LIQUID_FS = `
uniform vec3 uDeep; uniform vec3 uEdge; uniform vec3 uFoamCol; uniform float uLevel; uniform float uFoam; uniform vec2 uWob; uniform vec3 uAt; uniform float uAlpha; uniform float uTime;
${DRINK_COMMON}
float fh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float fn(vec3 p){                                               // smooth noise: a foam of small bubbles, not squares
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fh(i), fh(i + vec3(1, 0, 0)), f.x), mix(fh(i + vec3(0, 1, 0)), fh(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(fh(i + vec3(0, 0, 1)), fh(i + vec3(1, 0, 1)), f.x), mix(fh(i + vec3(0, 1, 1)), fh(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
void main(){
  float y = uMirror > 0.5 ? -vW.y : vW.y;
  float lvl = uLevel + dot(vW.xz - uAt.xz, uWob);
  if (y > lvl + uFoam) discard;
  vec3 N = normalize(vN), V = normalize(uCam - vW);
  if (dot(N, V) < 0.0) N = -N;
  float nv = max(dot(N, V), 0.0);
  vec3 col;
  if (y > lvl) {                                                   // the head
    float b = fn(vL * 150.0) * 0.55 + fn(vL * 60.0) * 0.45;
    col = uFoamCol * (0.82 + 0.18 * b) * (0.45 + 0.55 * uLight) * (0.82 + 0.18 * nv);
    col = mix(col, uEdge * 0.9, smoothstep(0.05, 0.0, y - lvl) * 0.45);
  } else {
    float thick = pow(nv, 2.2) * (0.72 + 0.28 * smoothstep(0.0, 0.6, lvl - y));
    col = mix(uEdge, uDeep, thick);
    vec3 through = env(refract(-V, N, 0.76));
    col += uEdge * dot(through, vec3(0.42)) * (1.0 - 0.6 * thick);          // the room, seen through the wine
    col *= 0.50 + 0.50 * uLight;
    col = mix(col, uEdge * 1.15, smoothstep(0.035, 0.0, lvl - y) * 0.55);   // meniscus
    col += env(reflect(-V, N)) * pow(1.0 - nv, 3.0) * 0.25;
  }
  col = grey(col);
  float a = uReveal * uAlpha;
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, a); return; }
  gl_FragColor = vec4(col, a * mirrorFade() * (uMirror > 0.5 ? 0.4 : 1.0));      // in the counter the drink is a hint of colour, no more
}`;
/* The surface of the drink, seen from just above: a disc that is mostly reflection. uFoamy 1 = the top of a beer head. */
export const SURFACE_FS = `
uniform vec3 uDeep; uniform vec3 uEdge; uniform vec3 uFoamCol; uniform float uFoamy; uniform float uAlpha;
${DRINK_COMMON}
float fh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float fn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec3 N = vec3(0.0, 1.0, 0.0), V = normalize(uCam - vW);
  float nv = max(dot(N, V), 0.0), F = pow(1.0 - nv, 3.0), r = length(vUv - 0.5) * 2.0;
  vec3 liquid = mix(uDeep, uEdge, 0.35 + 0.65 * smoothstep(0.55, 1.0, r)) * (0.5 + 0.5 * uLight) + env(reflect(-V, N)) * (0.10 + 0.7 * F);
  vec3 foam = uFoamCol * (0.86 + 0.14 * fn(vUv * 60.0)) * (0.5 + 0.5 * uLight);
  vec3 col = grey(mix(liquid, foam, uFoamy));
  float a = uReveal * uAlpha * smoothstep(1.0, 0.97, r);
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, a); return; }
  gl_FragColor = vec4(col, a);
}`;
/* The stream: a thin tube bent along the fall, from the spout (uA) to the surface (uB); head and tail say how much of it exists. */
export const STREAM_VS = `
uniform vec3 uA; uniform vec3 uB; uniform float uR;
varying float vU; varying float vS;
void main(){
  float u = position.y + 0.5; vU = u; vS = position.x;
  vec3 c = vec3(mix(uA.x, uB.x, sqrt(u)), mix(uA.y, uB.y, u), mix(uA.z, uB.z, sqrt(u)));       // sideways speed constant, falling faster
  float r = uR * mix(1.0, 0.5, u);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(c + vec3(position.x, 0.0, position.z) * r, 1.0);
}`;
export const STREAM_FS = `
uniform vec3 uEdge; uniform vec3 uDeep; uniform float uHead; uniform float uTail; uniform float uReveal; uniform float uLight; uniform float uGlow; uniform float uTime;
varying float vU; varying float vS;
void main(){
  if (vU > uHead || vU < uTail) discard;
  float core = 1.0 - abs(vS);
  vec3 col = mix(uDeep, uEdge, 0.55 + 0.45 * core) * (0.55 + 0.45 * uLight) + vec3(1.0, 0.97, 0.9) * smoothstep(0.55, 0.9, core) * (0.20 + 0.10 * sin(vU * 40.0 - uTime * 30.0));
  float a = 0.9 * uReveal * smoothstep(uTail, uTail + 0.04, vU);
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, a); return; }
  gl_FragColor = vec4(col, a);
}`;
/* Bubbles: a handful of points that rise and fade. Their number is fixed and small; uOn 0 draws nothing. */
export const BUBBLE_VS = `
attribute float aSeed; uniform float uTime; uniform float uPx; uniform float uOn; uniform float uBase; uniform float uTop; uniform float uR; uniform float uSize;
varying float vA;
void main(){
  float t = fract(aSeed * 7.13 + uTime * (0.22 + 0.30 * fract(aSeed * 3.7)));
  float k = 0.30 + 0.70 * t;
  vec3 p = vec3(position.x * uR * k + sin(uTime * 3.0 + aSeed * 40.0) * 0.006, mix(uBase, uTop, t), position.z * uR * k);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (0.8 + 1.4 * fract(aSeed * 5.3)) * uPx * uSize / max(-mv.z, 0.5);
  vA = sin(t * 3.14159) * (0.35 + 0.65 * fract(aSeed * 9.1)) * uOn;
  gl_Position = projectionMatrix * mv;
}`;
export const BUBBLE_FS = 'uniform vec3 uCol; uniform float uGlow; varying float vA; void main(){ if (vA < 0.004) discard; float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.2, d) * vA; gl_FragColor = vec4(uCol * a * (uGlow > 0.5 ? 0.0 : 1.0), 0.0); }';
/* Light that has come through the glass and lies on the counter. Kept faint. */
export const CAUSTIC_FS = `
uniform vec3 uCol; uniform float uK; uniform float uGlow; varying vec2 vUv;
void main(){
  vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
  float a = smoothstep(1.0, 0.1, r) * (0.55 + 0.45 * smoothstep(0.9, 0.2, abs(r - 0.45) * 2.2)) * uK * (uGlow > 0.5 ? 0.0 : 1.0);
  gl_FragColor = vec4(uCol * a, 0.0);
}`;
