// Yogurt and granola: a bowl of yogurt, granola on one side, strawberries and blueberries, a thread of honey.
const float R0 = 7.8, H = 5.0, YS = 4.05;
vec3 bq(vec3 p, int i) {
  vec3 c = i == 0 ? vec3(-3.4, YS + .55, 1.2) : i == 1 ? vec3(-1.6, YS + .6, 3.4) : vec3(-4.1, YS + .5, -1.6);
  vec3 q = p - c; q.xy = rot(1.25) * q.xy; q.xz = rot(float(i) * 1.9 + .4) * q.xz; return q;
}
vec2 mapM(vec3 p) {
  float r = length(p.xz), y = p.y, a = atan(p.z, p.x);
  vec2 res = vec2(sdBowl(p, R0, H, .36), 1.);
  float prof = R0 * (.36 + .64 * pow(clamp(y / H, 0., 1.), .5)) - .42;
  float ys = YS + .12 * sin(r * 1.5 - a * 2.) * smoothstep(6.5, 3., r);
  float yog = max(max((r - prof) * .7, y - ys), .5 - y);
  res = U(res, vec2(yog * .8, 2.));
  float side = p.x - .25 - .9 * sin(p.z * .45);                           // granola lies on the right half
  float slab = max(max(abs(y - YS - .2) - 1.1, -side - .6), r - 6.8);
  if (slab < .4) {                                                        // clusters: two sizes of crumb, heaped a little
    vec3 g = vec3(p.x, (y - YS - .12 * sin(p.x * 1.3 + p.z)) * 1.25, p.z);
    float keep = smoothstep(-.2, .7, side) * smoothstep(6.1, 5.3, r); keep = keep < .45 ? 0. : keep;      // crumbs stop short of the yogurt and of the bowl's wall: no dust
    float gr = keep > 0. ? min((cells(g * .9).x - .44 * keep) / .9, (cells(g * 1.7 + 4.).x - .42 * keep) / 1.7) - .05 * fbm(p * 4.) : .3;
    gr = max(gr, abs(y - YS - .15) - .8 - .25 * sin(p.x * 2.1) * sin(p.z * 1.7));
    res = U(res, vec2(gr * .6, 3.));
  } else res = U(res, vec2(slab, 3.));
  for (int i = 0; i < 3; i++) res = U(res, vec2(sdBerry(bq(p, i), 1.1), 4.));
  float bb = 1e3;
  for (int i = 0; i < 7; i++) { float f = float(i); vec3 c = vec3(-2.2 - 1.9 * cos(f * 2.2) - .4 * f * .3, YS + .42, -.6 + 3.4 * sin(f * 1.7 + .5)); if (length(c.xz) < 6.2) bb = min(bb, sdSphere(p - c, .58)); }
  return U(res, vec2(bb, 5.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  if (id == 2) {
    float honey = smoothstep(.16, .08, abs(p.z - 1.2 * sin(p.x * .7) - .3 * p.x + .5)) * step(YS - .3, p.y) * smoothstep(6.4, 5.6, length(p.xz));
    m.alb = mix(RGB(250, 248, 240), RGB(226, 150, 30), honey * .9); m.rough = mix(.3, .12, honey); m.f0 = .05; m.sss = .9; return;
  }
  if (id == 3) { vec3 c = cells(p * 1.3); m.alb = mix(RGB(160, 104, 48), RGB(226, 182, 110), c.z) * (.82 + .3 * fbm(p * 4.)); m.alb = mix(m.alb, RGB(104, 46, 34), step(.88, c.z)); m.rough = .85; m.sss = .3; return; }
  if (id == 4) { vec3 c = cells(p * 3.4); m.alb = mix(RGB(240, 210, 110), mix(RGB(206, 22, 30), RGB(236, 60, 44), fbm2(p * 1.5)), smoothstep(.1, .2, c.x)); m.rough = .12; m.f0 = .07; m.sss = .5; return; }
  m.alb = mix(RGB(40, 40, 96), RGB(88, 86, 146), smoothstep(.3, .9, n.y) * .6); m.rough = .35; m.f0 = .05;
}
