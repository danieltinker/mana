// Belgian waffle with a scoop of vanilla ice cream, strawberries and chocolate sauce.
const float PT = .46;
vec3 wq(vec3 p) { vec3 q = p - vec3(0., PT, 0.); q.xz = rot(.42) * q.xz; return q; }
vec3 bq(vec3 p, int i) {
  vec3 c = i == 0 ? vec3(-4.2, 3.05, 2.6) : i == 1 ? vec3(3.9, 3.0, 3.4) : vec3(4.4, 3.05, -2.4);
  vec3 q = wq(p) - c; q.xy = rot(1.2 + .5 * float(i)) * q.xy; q.xz = rot(float(i) * 2.1) * q.xz; return q;
}
vec2 mapM(vec3 p) {
  vec2 res = vec2(sdPlate(p, 12.6, 1.1, 7.8), 1.);
  vec3 q = wq(p);
  float body = sdRBox(q - vec3(0., 1.15, 0.), vec3(6.0, 1.15, 6.0), .55); if (body < .3) body -= .03 * fbm(q * 1.5);
  vec2 c = mod(q.xz + 6.05, 2.42) - 1.21;
  float pocket = sdBox(vec3(c.x, q.y - 2.3, c.y), vec3(.74, .95, .74)) - .16;
  body = smax(body, -max(pocket, max(abs(q.x), abs(q.z)) - 5.75), .14);
  res = U(res, vec2(body, 2.));
  vec3 s = q - vec3(-.3, 4.05, -.5);
  float scoop = sdSphere(s, 2.55); if (scoop < .6) scoop += -.16 * fbm(q * 1.3) - .05 * fbm(q * 4.); else scoop -= .22;
  scoop = smin(scoop, sdEllipsoid(q - vec3(-.3, 2.35, -.5), vec3(3.3, .35, 3.3)), .5);
  res = U(res, vec2(scoop * .8, 3.));
  for (int i = 0; i < 3; i++) res = U(res, vec2(sdBerry(bq(p, i), 1.15), 4.));
  return res;
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  vec3 q = wq(p);
  float sauce = smoothstep(.13, .07, abs(fract(q.x * .33 + .22 * sin(q.z * .9) + .1) - .5)) * step(.3, n.y);
  if (id == 2) {
    float top = smoothstep(1.9, 2.3, q.y);
    m.alb = mix(RGB(226, 170, 84), RGB(190, 122, 46), clamp(top * .7 + (fbm(q * 1.2) - .5), 0., 1.));
    m.alb = mix(m.alb, RGB(250, 236, 200), smoothstep(.6, .8, vnoise(q * 7.)) * top * .35);       // a dusting of sugar
    m.alb = mix(m.alb, RGB(52, 26, 14), sauce * top); m.rough = mix(.7, .2, sauce * top); m.sss = .4;
  }
  else if (id == 3) { m.alb = mix(RGB(250, 240, 214), RGB(238, 222, 186), fbm(q * 2.)); m.alb = mix(m.alb, RGB(52, 26, 14), sauce * smoothstep(3.6, 4.6, q.y) * .95); m.rough = .5; m.sss = .9; }
  else {
    vec3 c = cells(p * 3.4);
    m.alb = mix(RGB(206, 22, 30), RGB(236, 60, 44), fbm2(p * 1.5)); m.alb = mix(RGB(240, 210, 110), m.alb, smoothstep(.1, .2, c.x)); m.rough = .12; m.f0 = .07; m.sss = .5;
  }
}
