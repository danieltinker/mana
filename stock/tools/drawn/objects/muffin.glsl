// Blueberry muffin in a pleated paper case.
const float PT = .46, LH = 4.4;
float berries(vec3 p) {
  float d = 1e3;
  for (int i = 0; i < 9; i++) {
    float f = float(i), a = f * 2.39996 + .5, rr = .9 + 3.1 * sqrt((f + .6) / 9.5);
    vec3 c = vec3(rr * cos(a), 0., rr * sin(a)); c.y = PT + LH - .5 + 3.05 * sqrt(max(1. - dot(c.xz, c.xz) / 19.5, 0.));
    d = min(d, sdSphere(p - c, .62));
  }
  return d;
}
vec2 mapM(vec3 p) {
  float r = length(p.xz), y = p.y, a = atan(p.z, p.x);
  float k = clamp((y - PT) / LH, 0., 1.);
  float liner = max(max((r - (2.55 + 1.05 * k) * (1. + .03 * cos(a * 26.))) * .8, y - PT - LH), PT - y) - .03;
  vec3 q = p - vec3(0., PT + LH - .55, 0.);
  float dome = sdEllipsoid(q, vec3(4.42, 3.2, 4.42));
  if (dome > 1.2) return U(U(vec2(sdPlate(p, 8.6, .95, 5.), 1.), vec2(liner, 2.)), vec2((dome - .9) * .75, 3.));
  dome += -.3 * fbm(p * .75) - .08 * fbm(p * 2.6);
  dome = smax(dome * .75, -(q.y + .55), .5);
  float bd = berries(p);
  vec2 res = U(U(vec2(sdPlate(p, 8.6, .95, 5.), 1.), vec2(liner, 2.)), vec2(smin(dome, bd + .25, .3), 3.));
  return U(res, vec2(max(bd, dome - .45), 4.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  float a = atan(p.z, p.x);
  if (id == 2) { m.alb = mix(RGB(112, 70, 42), RGB(160, 110, 70), .5 + .5 * cos(a * 26.)) * (.8 + .2 * clamp((p.y - PT) / LH, 0., 1.)); m.rough = .75; return; }
  if (id == 4) { m.alb = mix(RGB(40, 38, 92), RGB(86, 82, 140), smoothstep(.3, .9, n.y) * .6); m.rough = .35; m.f0 = .05; return; }
  float v = fbm(p * 1.4), top = smoothstep(PT + LH - .2, PT + LH + 2.6, p.y);
  m.alb = mix(RGB(232, 186, 112), RGB(186, 122, 58), clamp(top * .8 + (v - .5) * .9, 0., 1.));
  m.alb = mix(m.alb, RGB(96, 60, 110), smoothstep(.5, .1, berries(p)) * .55);        // juice around each berry
  m.alb *= .92 + .14 * vnoise(p * 8.); m.rough = .85; m.sss = .5;
}
