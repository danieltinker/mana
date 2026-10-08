// Bagel with cream cheese and smoked salmon, the top half pushed back so the filling shows.
const float PT = .46, RB = 3.85;
float ring(vec3 p, float rt, float ys) { vec2 q = vec2(length(p.xz) - RB, p.y / ys); return (length(q) - rt) * ys; }
vec3 topQ(vec3 p) { vec3 q = p - vec3(.5, PT + 2.5, -1.5); q.yz = rot(-.20) * q.yz; q.xy = rot(-.05) * q.xy; return q; }
vec2 mapM(vec3 p) {
  vec2 res = vec2(sdPlate(p, 10.4, 1.0, 6.4), 1.);
  float a = atan(p.z, p.x), r = length(p.xz);
  vec3 b = p - vec3(0., PT + 1.28, 0.);
  float bottom = smax(ring(b, 2.15, .6), b.y, .12) - .04 * fbm(p * 1.6);
  float cheese = max(abs(b.y - .32 - .07 * sin(a * 5. + r)) - .3, abs(r - RB) - 2.28 - .16 * sin(a * 6. + 1.)) - .08;
  float sy = b.y - .95 - .2 * sin(a * 7. + r * 2.), salmon = max(abs(sy) - .2, abs(r - RB - .12 * sin(a * 9.)) - 1.95) - .1;
  vec3 t = topQ(p);
  float top = smax(ring(t, 2.15, .66), -t.y, .12) - .04 * fbm(p * 1.6);
  res = U(res, vec2(bottom, 2.));
  res = U(res, vec2(cheese * .7, 3.));
  res = U(res, vec2(salmon * .6, 4.));
  return U(res, vec2(top, 5.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  if (id == 3) { m.alb = RGB(248, 244, 234); m.rough = .45; m.sss = .7; return; }
  if (id == 4) { float st = smoothstep(.34, .5, abs(fract((length(p.xz) * 1.6 + atan(p.z, p.x) * 1.2)) - .5)); m.alb = mix(RGB(242, 128, 84), RGB(252, 196, 160), st * .75); m.rough = .25; m.f0 = .05; m.sss = .7; return; }
  vec3 q = id == 5 ? topQ(p) : p - vec3(0., PT + 1.28, 0.);
  float cut = id == 5 ? smoothstep(.12, .0, q.y) : smoothstep(-.12, .0, q.y);              // the cut face is pale crumb
  float up = id == 5 ? clamp(q.y / 1.4, 0., 1.) : clamp(-q.y / 1.2, 0., 1.);
  vec3 crust = mix(RGB(226, 170, 96), RGB(172, 104, 44), smoothstep(.2, 1., up) * (.7 + .3 * fbm(p * 1.2)));
  if (id == 5) { vec3 c = cells(q * vec3(2.6, 2.6, 2.6)); crust = mix(RGB(246, 232, 196), crust, smoothstep(.2, .27, c.x + .25 * step(.55, c.z)) ); }   // sesame
  m.alb = mix(crust, RGB(244, 228, 196) * (.9 + .1 * vnoise(p * 6.)), cut);
  m.rough = mix(.3, .8, cut); m.f0 = .05; m.sss = .45; m.gloss = .8;
}
