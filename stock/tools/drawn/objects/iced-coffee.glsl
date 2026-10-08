// Iced coffee: a tall glass, milk coffee that is darker at the bottom, ice at the top, a straw.
const float H = 15.2, LEVEL = 13.3, BASE = 1.0;
float glR(float y) { return 3.05 + .8 * clamp(y / H, 0., 1.); }
float ice(vec3 p) {
  float d = 1e3;
  for (int i = 0; i < 7; i++) {
    float f = float(i); vec3 c = vec3(1.7 * cos(f * 2.4 + .4), LEVEL - .1 - 1.45 * floor(f / 3.) - .5 * hash11(f), 1.7 * sin(f * 2.4 + .4));
    vec3 q = p - c; q.xz = rot(f * 1.3) * q.xz; q.xy = rot(.5 * sin(f * 3.1)) * q.xy;
    d = min(d, sdRBox(q, vec3(1.02), .34));
  }
  return d;
}
vec2 mapM(vec3 p) {
  float r = length(p.xz), y = p.y, sd = PROF(glR, r, y);
  float ic = max(ice(p), sd + .2);
  float straw = sdCapsule(p, vec3(-.9, 1.4, -.5), vec3(2.9, 20.5, -1.9), .34);
  float liq = max(max(max(sd + .2, y - LEVEL), BASE - y), -(ic - .02));
  liq = max(liq, -(straw - .02));
  vec2 res = U(U(vec2(liq, 2.), vec2(ic, 3.)), vec2(straw, 4.));
  if (gPass == 0) res = U(res, vec2(min(shell(sd, y, 0., H, .18), max(sd, y - BASE)), 1.));
  return res;
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { m.type = 1; m.alb = vec3(.96, .975, .97); return; }
  float k = clamp(p.y / LEVEL, 0., 1.);
  float swirl = fbm(vec3(p.x * .35, p.y * .22 + .6 * fbm2(p * .3), p.z * .35) + 2.);
  vec3 coffee = mix(RGB(96, 52, 24), RGB(214, 172, 128), clamp(smoothstep(.05, .95, k) * .8 + (swirl - .5) * .9, 0., 1.));
  if (id == 2) { m.alb = coffee; m.rough = .35; m.sss = .6; m.f0 = .03; if (p.y > LEVEL - .02) m.alb = mix(m.alb, RGB(232, 206, 172), .6); }
  else if (id == 3) { m.type = 2; m.alb = vec3(.80, .78, .74); m.absorb = vec3(.30, .32, .36); }
  else { m.alb = fract(p.y * .42 - atan(p.z + 1.2, p.x - 1.) * .32) < .5 ? RGB(240, 238, 232) : RGB(40, 38, 38); m.rough = .5; }
}
