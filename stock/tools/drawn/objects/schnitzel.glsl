// Schnitzel: two breaded cutlets, a wedge of lemon, a little parsley.
const float PT = .46;
vec3 c1(vec3 p) { vec3 q = p - vec3(-2.0, PT + .9, -1.6); q.xz = rot(.25) * q.xz; return q; }
vec3 c2(vec3 p) { vec3 q = p - vec3(2.2, PT + 1.75, 1.7); q.xz = rot(-.5) * q.xz; q.xy = rot(-.1) * q.xy; q.yz = rot(-.1) * q.yz; return q; }
float cutlet(vec3 q, float seed) {
  float a = atan(q.z, q.x), R = 1. + .12 * sin(a * 2. + seed) + .07 * sin(a * 3. + seed * 2.3) + .04 * sin(a * 5. + seed * 4.);
  vec3 s = q; s.xz /= R;
  float d = sdEllipsoid(s, vec3(7.0, .82, 4.5));
  if (d > .9) return (d - .4) * .55;
  d += -.2 * fbm(q * .45 + seed) - .1 * fbm(q * 1.6 + seed);
  return (d - .06 * (1. - smoothstep(.0, .35, cells(q * 2.2 + seed).x))) * .55;
}
vec3 lemQ(vec3 p) { vec3 q = p - vec3(-6.4, PT + .75, 5.0); q.xz = rot(.6) * q.xz; return q; }
float lemon(vec3 q) { q.yz = rot(-.5) * q.yz; return max(sdEllipsoid(q, vec3(3.1, 2.15, 2.15)), max(dot(q.yz, vec2(-.6, .8)), dot(q.yz, vec2(-.6, -.8)))) - .07; }
vec2 mapM(vec3 p) {
  vec2 res = vec2(sdPlate(p, 13.4, 1.15, 8.2), 1.);
  res = U(res, vec2(cutlet(c1(p), 1.), 2.));
  res = U(res, vec2(cutlet(c2(p), 4.), 2.));
  res = U(res, vec2(lemon(lemQ(p)), 3.));
  vec3 h = p - vec3(6.9, PT + .7, -4.4);
  return U(res, vec2((sdEllipsoid(h, vec3(1.9, .8, 1.5)) - .5 * (fbm(p * 1.6) - .4)) * .5, 4.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  if (id == 3) {
    vec3 q = lemQ(p); q.yz = rot(-.5) * q.yz; float rr = length(q.yz);
    float cutf = smoothstep(.985, .95, length(q / vec3(3.1, 2.15, 2.15)));        // the two cut faces show the flesh
    vec3 pulp = mix(RGB(250, 232, 120), RGB(254, 246, 190), smoothstep(.3, .5, abs(fract(q.x * 1.3 + rr * .4) - .5)));
    pulp = mix(pulp, RGB(252, 248, 226), smoothstep(.5, .25, rr));
    m.alb = mix(RGB(242, 196, 36), pulp, cutf); m.rough = mix(.35, .25, cutf); m.f0 = .05; m.sss = .7; return;
  }
  if (id == 4) { m.alb = mix(RGB(40, 104, 30), RGB(96, 160, 52), fbm(p * 2.5)); m.rough = .5; m.sss = .5; return; }
  vec3 c = cells(p * 2.2);
  float v = fbm(p * .6 + 2.);
  m.alb = mix(RGB(226, 162, 68), RGB(176, 104, 36), smoothstep(.3, .75, v));
  m.alb = mix(m.alb, RGB(242, 200, 120), smoothstep(.3, .05, c.x) * .6);          // crumbs catch the light
  m.alb = mix(m.alb, RGB(136, 74, 24), smoothstep(.62, .85, fbm(p * 1.3)) * .5);
  m.rough = .85; m.sss = .35;
}
