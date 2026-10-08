// Chocolate chip cookies: three on a small plate, one leaning on the others.
const float PT = .46;
vec2 cookie(vec3 q, float seed) {
  float a = atan(q.z, q.x);
  float d = sdRCyl(q, 3.5 + .16 * sin(a * 3. + seed * 5.) + .08 * sin(a * 7. + seed), .5, .44);
  if (d > .7) return vec2((d - .3) * .8, 2.);
  d += -.2 * fbm(q * 1.0 + seed * 7.) + .05;
  vec3 c = cells(q * vec3(.6, .9, .6) + seed * 3.1);
  float chip = max((c.x - .27) / .9, d - .13);
  return U(vec2(d * .8, 2.), vec2(chip * .8, 3.));
}
vec2 mapM(vec3 p) {
  vec2 res = vec2(sdPlate(p, 9.8, 1.0, 6.), 1.);
  vec3 a = p - vec3(-2.7, PT + .52, -1.3);
  vec3 b = p - vec3(3.3, PT + .52, .2); b.xz = rot(1.1) * b.xz;
  vec3 c = p - vec3(.1, PT + 1.62, 2.1); c.xz = rot(2.3) * c.xz; c.yz = rot(-.24) * c.yz; c.xy = rot(.05) * c.xy;
  return U(U(U(res, cookie(a, 1.)), cookie(b, 2.)), cookie(c, 3.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  if (id == 3) { m.alb = RGB(58, 32, 20); m.rough = .22; m.f0 = .05; return; }
  float v = fbm(p * 1.6), crack = cells(p * 1.1).y - cells(p * 1.1).x;
  m.alb = mix(RGB(214, 160, 92), RGB(170, 110, 52), smoothstep(.3, .75, v));
  m.alb = mix(m.alb, RGB(150, 94, 44), smoothstep(.07, .0, crack) * .28 * smoothstep(.35, .6, fbm(p * .8)));
  m.alb *= .93 + .12 * vnoise(p * 9.); m.rough = .8; m.sss = .4;
}
