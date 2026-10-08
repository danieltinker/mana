// Steak: seared, grill marks, slices cut from one end to show it is pink inside; rosemary and roast tomatoes.
const float PT = .46;
vec3 sq(vec3 p) { vec3 q = p - vec3(-2.4, PT + 1.3, -.8); q.xz = rot(.32) * q.xz; return q; }
vec3 slice(vec3 p, int i) { vec3 q = sq(p) - vec3(6.3 + 2.15 * float(i), -.25, .2 + .35 * float(i)); q.xy = rot(-.72) * q.xy; q.xz = rot(.1 * float(i) - .05) * q.xz; return q; }
float outline(vec3 q) { float a = atan(q.z, q.x); return 1. + .10 * sin(a * 2. + .9) + .07 * sin(a * 3. + .2) + .035 * sin(a * 5.); }
float body(vec3 q) {
  vec3 s = q; s.xz /= outline(q);
  float d = max(sdEllipsoid(s, vec3(6.6, 1.5, 4.3)), abs(q.y) - 1.25) - .2;
  d = max(d, q.x - 4.6);
  return d < .5 ? (d - .09 * fbm(q * .9)) * .8 : (d - .1) * .8;
}
float sliceD(vec3 q) {
  float prof = max(length(vec2(q.z / 3.75, q.y / 1.5)) - 1., abs(q.y) - 1.25) * 1.4 - .12;        // the same section as the steak
  return max(prof, abs(q.x) - .62) - .1;
}
vec2 mapM(vec3 p) {
  vec2 res = vec2(sdPlate(p, 13.4, 1.15, 8.2), 1.);
  res = U(res, vec2(body(sq(p)), 2.));
  for (int i = 0; i < 3; i++) res = U(res, vec2(sliceD(slice(p, i)) * .8, 3.));
  vec3 r = p - vec3(-3.9, PT + .5, 6.3); r.xz = rot(-.2) * r.xz;
  float sprig = sdCapsule(r, vec3(-4., 0., 0.), vec3(4., 0., .4), .1);
  if (sprig < 1.6) for (int i = 0; i < 12; i++) { float f = float(i), x = -3.6 + f * .64, sgn = mod(f, 2.) * 2. - 1.; sprig = min(sprig, sdCapsule(r, vec3(x, .05, .06 * x), vec3(x + .55, .35, .06 * x + sgn * .85), .09)); }
  res = U(res, vec2(sprig, 4.));
  float tom = min(min(sdSphere(p - vec3(7.2, PT + 1.25, -5.4), 1.3), sdSphere(p - vec3(9.5, PT + 1.2, -3.7), 1.25)), sdSphere(p - vec3(-8.8, PT + 1.2, -3.2), 1.2));
  return U(res, vec2(tom, 5.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  if (id == 4) { m.alb = mix(RGB(44, 84, 40), RGB(84, 124, 62), fbm2(p * 3.)); m.rough = .6; return; }
  if (id == 5) { m.alb = mix(RGB(206, 36, 26), RGB(150, 26, 18), smoothstep(.5, .8, fbm(p * 1.4))); m.rough = .12; m.f0 = .06; m.sss = .4; return; }
  vec3 q = sq(p);
  vec3 sear = mix(RGB(142, 78, 44), RGB(96, 48, 26), fbm(q * 1.2));
  float g1 = smoothstep(.37, .45, abs(fract((q.x + .6 * q.z) * .34) - .5));
  sear = mix(sear, RGB(34, 18, 11), g1 * step(.4, n.y) * .92);
  sear = mix(sear, RGB(226, 196, 150), smoothstep(-3.2, -3.9, q.z / outline(q)) * smoothstep(.35, .6, fbm(q * .6 + 4.)));      // the strip of fat along the back
  m.rough = .3; m.f0 = .05; m.sss = .3; m.gloss = 1.2;
  vec3 l = q; float isCut = step(4.52, q.x);
  if (id == 3) { float best = 1e3; for (int i = 0; i < 3; i++) { vec3 t = slice(p, i); float dd = abs(sliceD(t)); if (dd < best) { best = dd; l = t; } } isCut = smoothstep(.45, .6, abs(l.x)); }
  float rim = 1. - max(length(vec2(l.z / 3.75, l.y / 1.5)), abs(l.y) / 1.25);            // 0 at the crust, 1 at the heart
  vec3 pink = mix(RGB(214, 110, 104), RGB(186, 58, 66), smoothstep(.25, .7, rim)) * (.93 + .12 * fbm(l * 2.));
  vec3 cut = mix(RGB(126, 74, 48), pink, smoothstep(.04, .2, rim));
  m.alb = mix(sear, cut, isCut); m.rough = mix(.3, .2, isCut);
}
