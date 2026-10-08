// Nigiri: salmon, tuna, salmon on pressed rice, with ginger and wasabi, on a long plate.
const float PT = .92;
vec3 piece(vec3 p, int i) { vec3 q = p - vec3(-7.0 + 5.3 * float(i), PT, .2 - .5 * float(i % 2)); q.xz = rot(-.62) * q.xz; return q; }
float fishY(vec3 q) { return 2.22 - .075 * q.x * q.x - .16 * q.z * q.z; }
vec2 mapM(vec3 p) {
  float plate = sdRBox(p - vec3(0., .46, 0.), vec3(12.4, .46, 5.6), .4);
  plate = smax(plate, -(sdRBox(p - vec3(0., 1.1, 0.), vec3(11.6, .28, 4.8), .25)), .2);
  vec2 res = vec2(plate, 1.);
  float rice = 1e3, fish = 1e3; float which = 0.;
  for (int i = 0; i < 3; i++) {
    vec3 q = piece(p, i);
    rice = min(rice, sdRBox(q - vec3(0., 1.0, 0.), vec3(2.7, 1.0, 1.2), .8));
    float f = sdRBox(vec3(q.x, q.y - fishY(q), q.z), vec3(3.5, .27, 1.5), .26) * .62;
    if (f < fish) { fish = f; which = float(i); }
  }
  if (rice < .2) rice -= .05 * (1. - smoothstep(.05, .3, cells(p * 3.2).x));
  res = U(res, vec2(rice, 2.));
  res = U(res, vec2(fish, 3. + mod(which, 2.)));
  vec3 g = p - vec3(9.0, PT + .55, -1.6); float a = atan(g.z, g.x);
  res = U(res, vec2((sdEllipsoid(g, vec3(1.8, .85, 1.45)) - .22 * sin(a * 5. + g.y * 6.) * sin(g.x * 3. + g.z * 2.)) * .55, 5.));
  return U(res, vec2(sdEllipsoid(p - vec3(9.3, PT + .55, 2.0), vec3(1.0, .75, .95)) - .05 * fbm(p * 3.), 6.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  if (id == 2) { vec3 c = cells(p * 3.2); m.alb = mix(RGB(250, 248, 240), RGB(224, 220, 208), smoothstep(.05, .32, c.x)); m.rough = .45; m.sss = .8; return; }
  if (id == 5) { m.alb = mix(RGB(250, 190, 180), RGB(240, 150, 150), fbm2(p * 2.)); m.rough = .25; m.sss = .9; return; }
  if (id == 6) { m.alb = RGB(150, 186, 84) * (.9 + .15 * fbm(p * 4.)); m.rough = .8; m.sss = .4; return; }
  int k = 0; float best = 1e3; vec3 q;
  for (int i = 0; i < 3; i++) { vec3 t = piece(p, i); float l = length(t.xz); if (l < best) { best = l; k = i; q = t; } }
  if (id == 3) {                                                         // salmon: pale lines of fat run across it
    float st = smoothstep(.36, .47, abs(fract(q.x * .62 + .28 * q.z * q.z + .1) - .5));
    m.alb = mix(RGB(246, 122, 70), RGB(254, 206, 172), st * .85);
  } else {                                                               // tuna
    float st = smoothstep(.40, .5, abs(fract(q.x * .8 - .2 * q.z * q.z) - .5));
    m.alb = mix(RGB(168, 26, 46), RGB(206, 72, 84), st * .5);
  }
  m.rough = .16; m.f0 = .05; m.sss = .7;
}
