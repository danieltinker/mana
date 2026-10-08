#version 300 es
// Mana placeholder library: the shared part of every object drawn in code.
// One fragment shader per object = this file + objects/<id>.glsl. The object supplies
//   vec2 mapM(vec3 p)                                   distance in cm and a material number (y is up, the table is y = 0)
//   void material(int id, vec3 p, inout vec3 n, inout Mat m)
// and this file does the rest: an orthographic camera at the elevation a relief is photographed from, soft studio light,
// glass and liquids, and the two outputs a relief needs (colour · height along the view axis + coverage).
precision highp float;
precision highp int;
out vec4 frag;
uniform vec2 uRes;      // render size in px
uniform vec3 uWin;      // centre x, centre y, half side of the square window, in cm on the picture plane
uniform float uE;       // camera elevation in radians
uniform int uMode;      // 0 colour · 1 data (R,G = 16-bit height along the view axis, B = coverage)

const float PI = 3.14159265;
const float LMAX = 70.0;        // the rays start this far above the table, along the view axis
const float HENC = 64.0;        // heights are written as a fraction of this many cm
int gPass = 0;                  // 0 = what the camera sees · 1 = shadow and occlusion rays (objects may leave glass out)

struct Mat { vec3 alb; float rough; float f0; float sss; int type; vec3 absorb; vec3 emit; float gloss; };
// type: 0 opaque · 1 glass (thin, see-through) · 2 liquid (a volume that absorbs light; alb = its colour where it is deep)

// ---------- hashes and noise ----------
float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash31(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 hash33(vec3 p) { return vec3(hash31(p), hash31(p + 19.19), hash31(p + 47.77)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 7.1; a *= .5; } return s; }
float fbm2(vec3 p) { return .62 * vnoise(p) + .38 * vnoise(p * 2.1 + 3.7); }
// cellular noise: x = distance to the nearest cell point, y = distance to the second, z = a random number of the nearest cell
vec3 cells(vec3 x) {
  vec3 i = floor(x), f = fract(x); float d1 = 9., d2 = 9., id = 0.;
  for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) for (int c = -1; c <= 1; c++) {
    vec3 g = vec3(a, b, c), o = hash33(i + g), r = g + o - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = o.x + o.y * .37; } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2), fract(id * 7.31));
}

// ---------- shapes ----------
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.) / k; return min(a, b) - h * h * k * .25; }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
vec2 U(vec2 a, vec2 b) { return a.x < b.x ? a : b; }
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.) / max(k1, 1e-5); }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
float sdRBox(vec3 p, vec3 b, float r) { return sdBox(p, b - r) - r; }
float sdCyl(vec3 p, float r, float h) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.) + length(max(d, 0.)); }
float sdRCyl(vec3 p, float r, float h, float rr) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r - rr, h - rr); return min(max(d.x, d.y), 0.) + length(max(d, 0.)) - rr; }
float sdTorus(vec3 p, float R, float r) { return length(vec2(length(p.xz) - R, p.y)) - r; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h) - r; }
float sdSeg2(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
float sdTri2(vec2 p, vec2 a, vec2 b, vec2 c) {      // a filled triangle in 2D
  vec2 e0 = b - a, e1 = c - b, e2 = a - c, v0 = p - a, v1 = p - b, v2 = p - c;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0., 1.), pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0., 1.), pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0., 1.);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)), vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))), vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
// a white ceramic plate of radius R (cm) standing on the table; rim = how high the edge stands, well = radius of the flat middle
float sdPlate(vec3 p, float R, float rim, float well) {
  float r = length(p.xz);
  float top = .32 + rim * smoothstep(well, R * .97, r) * (1. - .12 * smoothstep(R * .9, R, r));
  float d = max(abs(p.y - top + .17) - .17, r - R);
  return max(d * .8, -p.y) - .06;
}
// a round bowl: outer radius R at the rim, height H, wall th; the inside is hollow
float sdBowl(vec3 p, float R, float H, float th) {
  float r = length(p.xz), y = p.y;
  float prof = R * (.36 + .64 * pow(clamp(y / H, 0., 1.), .5)), dp = R * .64 * .5 * pow(max(y / H, .02), -.5) / H;
  float sd = (r - prof) / sqrt(1. + dp * dp);
  float wall = max(abs(sd + th * .5) - th * .5, y - H);
  float floor_ = max(abs(y - th * .6) - th * .6, r - R * .40);
  return max(min(wall, floor_), -y) - .04;
}


// signed distance to a surface of revolution whose radius at height y is f(y): negative inside. f is a function name.
#define PROF(f, r, y) (((r) - f(y)) / sqrt(1. + ((f((y) + .02) - f((y) - .02)) / .04) * ((f((y) + .02) - f((y) - .02)) / .04)))
// a thin wall (th) just inside that surface, between heights y0 and y1
float shell(float sd, float y, float y0, float y1, float th) { return max(max(abs(sd + th * .5) - th * .5, y - y1), y0 - y); }
// a leaf lying in the local x-y plane, tip along +x, length L
float sdLeaf(vec3 p, float L, float w) {
  float t = clamp(p.x / L, 0., 1.), half_w = w * sin(PI * pow(t, .7)) + .01;
  p.z -= .25 * w * sin(PI * t) + .12 * abs(p.y);                       // cupped, folded along the midrib
  return max(max(length(vec2(max(abs(p.y) - half_w, 0.), p.z)) - .035, -p.x), p.x - L) * .8;
}
// half a strawberry standing on its cut face would be too fine: a whole berry, tip along +y, height about 1.25 * r
float sdBerry(vec3 p, float r) { p.y /= 1.25; float k = 1. - .32 * clamp(p.y / r, -1., 1.); return (length(vec3(p.x / k, p.y, p.z / k)) - r) * .72; }

void ceramic(inout Mat m) { m.alb = RGB(238, 236, 231); m.rough = .14; m.f0 = .05; m.sss = .25; }

// ---------- the object ----------
vec2 mapM(vec3 p);
void material(int id, vec3 p, inout vec3 n, inout Mat m);
float map(vec3 p) { return mapM(p).x; }
vec3 normalAt(vec3 p) {
  const vec2 k = vec2(1, -1); const float e = .008;
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) + k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

// ---------- the studio ----------
const vec3 KEY = vec3(-0.5145, 0.8027, -0.3009);      // large soft light above, left and a little behind: how the dish photos are lit
const vec3 KEYC = vec3(1.00, 0.965, 0.91) * 0.52;
const vec3 FILL = vec3(0.6608, 0.4130, 0.6267);
const vec3 FILLC = vec3(0.84, 0.90, 1.00) * 0.24;
const vec3 SKYC = vec3(0.93, 0.95, 1.00) * 0.44;
const vec3 GNDC = vec3(0.55, 0.50, 0.45) * 0.30;
const vec3 BACK = vec3(0.040, 0.039, 0.038);           // the dark backdrop that shows through empty glass, as in the dish photos
vec3 env(vec3 d) {                                     // what glossy things mirror
  float box = smoothstep(.80, .96, dot(d, vec3(-0.4767, 0.7945, -0.3761)));
  float strip = smoothstep(.90, .985, dot(d, vec3(0.7926, 0.4458, 0.4161)));
  float win = smoothstep(.93, .99, dot(d, vec3(-0.7071, 0.25, 0.6614)));
  return BACK * .8 + vec3(1., .98, .95) * (box * 1.9 + strip * .55 + win * .8) + vec3(.16, .17, .19) * smoothstep(-.3, 1., d.y);
}
#ifndef SHMAX
#define SHMAX 1.5      // the longest step of a shadow ray, in cm, and how many steps it may take
#define SHN 56
#endif
#ifndef AON
#define AON 6          // occlusion samples; an object with a deep overhang (the muffin) asks for more, or the plate under it shows rings
#endif
float shadow(vec3 ro, vec3 rd, float k) {
  gPass = 1; float res = 1., t = .22;
  for (int i = 0; i < SHN; i++) { float h = map(ro + rd * t); res = min(res, k * h / t); t += clamp(h, .06, SHMAX); if (res < .003 || t > 50.) break; }
  gPass = 0; return smoothstep(0., 1., clamp(res, 0., 1.));
}
float occl(vec3 p, vec3 n) {
  gPass = 1; float o = 0., w = 1.;
  float q = 6. / float(AON);                             // AON samples along the normal (6 unless the object asks for more): the same reach, finer steps
  for (int i = 1; i <= AON; i++) { float f = float(i) * q, h = .06 + .11 * f * f; o += (h - map(p + n * h)) * w / h; w *= pow(.72, q); }
  gPass = 0; return clamp(1. - .42 * q * o, 0., 1.);
}
float fres(float c, float f0) { return f0 + (1. - f0) * pow(1. - clamp(c, 0., 1.), 5.); }

vec3 shadeOpaque(vec3 p, vec3 n, vec3 rd, Mat m) {
  vec3 V = -rd;
  float sh = shadow(p + n * .07, KEY, 8.), ao = occl(p, n);
  float ndl = dot(n, KEY), dif = clamp((ndl + m.sss) / (1. + m.sss), 0., 1.);
  float lit = dif * mix(1., mix(sh, 1., .35 * m.sss), smoothstep(-.05, .22, ndl));        // no cast shadow where the surface already turns away: that edge is the wrap's
  vec3 amb = mix(GNDC, SKYC, n.y * .5 + .5) * (.35 + .65 * ao);
  vec3 lin = KEYC * lit + amb + FILLC * clamp(dot(n, FILL) * .5 + .5, 0., 1.) * ao;
  lin += m.sss * vec3(1., .82, .6) * .10 * (1. - ao) ;                    // light that travels a little inside soft food
  vec3 col = m.alb * lin;
  float shin = mix(6., 520., pow(1. - m.rough, 2.2));
  vec3 H = normalize(KEY + V);
  float F = fres(dot(n, V), m.f0);
  col += KEYC * pow(max(dot(n, H), 0.), shin) * (shin + 6.) / 28. * F * sh * step(0., ndl) * m.gloss * 2.4;
  col += env(reflect(rd, n)) * F * (.25 + .75 * ao) * pow(1. - m.rough, 2.) * m.gloss;
  return col + m.emit;
}

bool march(vec3 ro, vec3 rd, inout float t, out int id) {
  id = -1;
  for (int i = 0; i < 260; i++) {
    vec3 p = ro + rd * t; vec2 h = mapM(p);
    if (h.x < .0035) { id = int(h.y + .5); return true; }
    t += h.x * STEP; if (p.y < -1. || t > 2. * LMAX) break;
  }
  return false;
}

void main() {
  vec2 q = uWin.xy + (gl_FragCoord.xy / uRes - .5) * 2. * uWin.z;
  float se = sin(uE), ce = cos(uE); vec3 ax = vec3(0., se, ce);
  vec3 ro = vec3(q.x, 0., -q.y / se) + ax * LMAX, rd = -ax;
  float t = 0.; int id; vec3 col = vec3(0.), w = vec3(1.); float first = -1.;
  for (int layer = 0; layer < 7; layer++) {
    if (!march(ro, rd, t, id)) { if (first >= 0.) col += w * BACK; break; }
    vec3 p = ro + rd * t; if (first < 0.) first = t;
    if (uMode == 1) break;
    vec3 n = normalAt(p);
    Mat m = Mat(vec3(.8), .6, .04, 0., 0, vec3(0.), vec3(0.), 1.);
    material(id, p, n, m);
    if (m.type == 0) { col += w * shadeOpaque(p, n, rd, m); break; }
    vec3 nn = dot(n, rd) < 0. ? n : -n; float c = dot(-rd, nn);
    if (m.type == 1) {                                     // glass: mirror the lights, a bright line where it turns away, then look through
      float F = fres(c, .06);
      col += w * (env(reflect(rd, nn)) * F * 1.5 + vec3(.86, .92, 1.) * (pow(1. - c, 5.) * .7 + smoothstep(.75, .98, n.y) * .30) * m.gloss);
      w *= (1. - F) * m.alb * (1. - .3 * pow(1. - c, 3.));
      t += .02;
      for (int i = 0; i < 48; i++) { vec2 h = mapM(ro + rd * t); if (h.x > .004 || int(h.y + .5) != id) break; t += max(-h.x, .02); }
      continue;
    }
    // liquid: the surface mirrors a little, then light is absorbed along the way through
    float F = fres(c, .03);
    col += w * env(reflect(rd, nn)) * F;
    w *= 1. - F;
    float t0 = t; t += .04;
    float dl = 0.; for (int i = 0; i < 110; i++) { dl = map(ro + rd * t); if (dl > 0.) break; t += max(-dl, .04); }
    t -= clamp(dl, 0., .04); float len = max(t - t0, 0.); vec3 T = exp(-m.absorb * len);
    float up = clamp(.55 + .45 * nn.y, 0., 1.);
    col += w * (1. - T) * m.alb * (.55 + .6 * up);
    w *= T; t += .012;
    if (max(w.x, max(w.y, w.z)) < .02) break;
  }
  if (uMode == 1) {
    float h = first < 0. ? 0. : clamp((LMAX - first) / HENC, 0., 1.), v = h * 255.;
    frag = vec4(floor(v) / 255., fract(v), first < 0. ? 0. : 1., 1.); return;
  }
  col = mix(col, .8 + .2 * tanh((col - .8) / .2), step(.8, col));      // highlights roll off, everything below stays as lit
  frag = vec4(pow(clamp(col, 0., 1.), vec3(1. / 2.2)), first < 0. ? 0. : 1.);
}
