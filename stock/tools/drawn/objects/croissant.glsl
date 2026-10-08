// Croissant on a small plate: a crescent of seven turns of dough, glazed.
const float RA = 7.2, TMAX = 1.18, PT = .46, TURN = .29;
float croi(vec3 p, out float tc, out float w) {
  p.xz = rot(.42) * p.xz;
  vec2 v = p.xz - vec2(0., 3.6);                       // the arc is centred in front: the horns point at the camera
  tc = clamp(atan(v.x, -v.y), -TMAX, TMAX);
  vec2 s = vec2(0., 3.6) + RA * vec2(sin(tc), -cos(tc));
  float u = tc / TMAX;
  w = 3.15 * pow(max(1. - u * u, 0.), .6) + .22;
  float skew = tc + .05 * sign(tc) * (p.y - PT) / max(w, .5);              // each turn of dough leans toward the tips
  w *= .9 + .12 * pow(abs(sin(PI * (skew / TURN + .5))), .42);
  vec3 q = vec3(p.x - s.x, (p.y - PT - .76 * w) / .8, p.z - s.y);
  return (length(q) - w) * .66;
}
vec2 mapM(vec3 p) {
  float tc, w;
  return U(vec2(sdPlate(p, 11.4, 1.0, 7.), 1.), vec2(croi(p, tc, w), 2.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  float tc, w; croi(p, tc, w);
  float ridge = pow(abs(sin(PI * (tc / TURN + .5))), .42);               // 1 on the back of a turn, 0 in the groove between two
  float up = clamp(n.y, 0., 1.);
  float flake = fbm(vec3(tc * 2.2, p.y * 5., length(p.xz) * 5.));
  vec3 c = mix(RGB(234, 184, 108), RGB(196, 122, 48), smoothstep(.1, .85, up) * (.55 + .45 * ridge));
  c = mix(c, RGB(158, 88, 30), smoothstep(.5, 1., up) * smoothstep(.35, .9, flake) * .7);
  c = mix(c, RGB(246, 216, 156), smoothstep(.5, .0, ridge) * .55);
  m.alb = c * (.9 + .2 * flake); m.rough = .32; m.f0 = .05; m.sss = .5; m.gloss = .8;
}
