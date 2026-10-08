// Tacos: three folded corn tortillas with meat, lettuce, tomato and cheese, on a long plate.
const float PT = .92;
vec3 tq(vec3 p, int i) { vec3 q = p - vec3(-7.2 + 7.2 * float(i), PT + .25, .2); q.xz = rot(.35) * q.xz; q.yz = rot(-.16) * q.yz; return q; }
float wallAt(float y) { return .55 + .42 * y; }                                    // half the opening at height y
vec2 taco(vec3 q) {
  float disc = length(q.xy - vec2(0., .2)) - 5.2;                                  // the tortilla was a round: folded, its edge is an arc
  float w = wallAt(q.y), side = abs(abs(q.z) - w) / sqrt(1. + .42 * .42);
  float shell = max(max(min(side, length(vec2(q.y - .05, max(abs(q.z) - .5, 0.)))) - .16, disc), -q.y - .2);
  float fillTop = 2.9 + .5 * sin(q.x * 1.3) * cos(q.x * .7 + 1.) - .09 * q.x * q.x;
  float body = max(max(abs(q.z) - w + .2, q.y - fillTop), max(disc + .7, .2 - q.y));
  if (body < .6) body -= .22 * fbm(q * 1.6) + .1 * (1. - smoothstep(.05, .35, cells(q * 1.7).x));
  return U(vec2(shell * .8, 2.), vec2(body * .6, 3.));
}
vec2 mapM(vec3 p) {
  float plate = sdRBox(p - vec3(0., .46, 0.), vec3(13.2, .46, 5.8), .4);
  plate = smax(plate, -(sdRBox(p - vec3(0., 1.1, 0.), vec3(12.4, .28, 5.0), .25)), .2);
  vec2 res = vec2(plate, 1.);
  for (int i = 0; i < 3; i++) res = U(res, taco(tq(p, i)));
  vec3 l = p - vec3(10.6, PT + .9, 3.1); l.xz = rot(.5) * l.xz;                    // a wedge of lime
  float lime = max(sdEllipsoid(l, vec3(2.0, 1.4, 1.4)), max(dot(l.yz, vec2(-.5, .866)), dot(l.yz, vec2(-.5, -.866)))) - .06;
  return U(res, vec2(lime, 4.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  if (id == 4) { float cutf = smoothstep(.985, .95, length((p - vec3(10.6, PT + .9, 3.1)) / vec3(2.0, 1.4, 1.4))); m.alb = mix(RGB(70, 150, 40), RGB(206, 232, 130), cutf); m.rough = .3; m.sss = .6; return; }
  if (id == 2) {                                                                   // corn tortilla: pale gold, toasted in spots
    float v = fbm(p * 1.1); vec3 c = cells(p * 2.2);
    m.alb = mix(RGB(236, 196, 104), RGB(206, 150, 62), smoothstep(.35, .75, v));
    m.alb = mix(m.alb, RGB(140, 84, 30), smoothstep(.14, .05, c.x) * .6); m.rough = .8; m.sss = .5; return;
  }
  vec3 c = cells(p * 1.7); float k = c.z;                                          // the filling, in bits: meat below, greens, tomato and cheese on top
  int best = 0; float bd = 1e3; vec3 q = p;
  for (int i = 0; i < 3; i++) { vec3 t = tq(p, i); if (abs(t.x) < bd) { bd = abs(t.x); q = t; } }
  float top = smoothstep(1.6, 2.6, q.y + .5 * fbm(p * 1.3));
  vec3 meat = mix(RGB(112, 62, 32), RGB(70, 36, 20), fbm(p * 3.));
  vec3 fresh = k < .4 ? mix(RGB(96, 166, 52), RGB(170, 214, 100), fbm2(p * 2.)) : k < .7 ? RGB(214, 44, 34) : RGB(250, 204, 70);
  m.alb = mix(meat, fresh, top); m.rough = .45; m.sss = .5;
}
