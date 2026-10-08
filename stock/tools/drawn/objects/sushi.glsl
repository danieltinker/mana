// Sushi: six pieces of maki on a long plate, pickled ginger and wasabi beside them, chopsticks in front.
const float PT = .92;
vec3 piece(vec3 p, int i) {
  float f = float(i);
  vec2 c = i < 3 ? vec2(-7.2 + 4.1 * f, -2.3) : vec2(-5.2 + 4.1 * (f - 3.), 1.9);
  vec3 q = p - vec3(c.x, PT, c.y); q.xz = rot(f * 1.9 + .4) * q.xz; return q;
}
float ginger(vec3 p) {
  vec3 q = p - vec3(8.4, PT + .55, -2.0); float a = atan(q.z, q.x);
  return (sdEllipsoid(q, vec3(1.9, .85, 1.5)) - .22 * sin(a * 5. + q.y * 6.) * sin(q.x * 3. + q.z * 2.)) * .55;
}
vec2 mapM(vec3 p) {
  float plate = sdRBox(p - vec3(0., .46, 0.), vec3(12.4, .46, 6.4), .4);
  plate = smax(plate, -(sdRBox(p - vec3(0., 1.1, 0.), vec3(11.6, .28, 5.6), .25)), .2);
  vec2 res = vec2(plate, 1.);
  float d = 1e3;
  for (int i = 0; i < 6; i++) { vec3 q = piece(p, i); float a = atan(q.z, q.x); d = min(d, sdRCyl(q - vec3(0., 1.28, 0.), 1.86 + .05 * sin(a * 4. + float(i)), 1.28, .14)); }
  float top = smoothstep(PT + 2.3, PT + 2.5, p.y);
  if (d < .2) d -= .05 * top * (1. - smoothstep(.05, .3, cells(p * 3.2).x));
  res = U(res, vec2(d, 2.));
  res = U(res, vec2(ginger(p), 3.));
  res = U(res, vec2(sdEllipsoid(p - vec3(8.9, PT + .55, 2.0), vec3(1.05, .75, 1.0)) - .05 * fbm(p * 3.), 4.));
  float st = min(sdCapsule(p, vec3(-10.6, PT + .34, 4.55), vec3(10.4, PT + .30, 4.9), .27), sdCapsule(p, vec3(-10.6, PT + .34, 5.3), vec3(10.4, PT + .30, 5.45), .27));
  return U(res, vec2(st, 5.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  if (id == 3) { m.alb = mix(RGB(250, 190, 180), RGB(240, 150, 150), fbm2(p * 2.)); m.rough = .25; m.sss = .9; return; }
  if (id == 4) { m.alb = RGB(150, 186, 84) * (.9 + .15 * fbm(p * 4.)); m.rough = .8; m.sss = .4; return; }
  if (id == 5) { m.alb = mix(RGB(206, 164, 108), RGB(182, 136, 82), fbm(vec3(p.x * .4, p.y * 6., p.z * 6.))); m.rough = .5; return; }
  int k = 0; float best = 1e3; vec3 q;
  for (int i = 0; i < 6; i++) { vec3 t = piece(p, i); float l = length(t.xz); if (l < best) { best = l; k = i; q = t; } }
  float rr = length(q.xz), a = atan(q.z, q.x);
  if (q.y < 2.5 || rr > 1.70) {                                         // the sheet of nori around it
    m.alb = mix(RGB(16, 26, 20), RGB(34, 50, 36), fbm(vec3(a * 3., q.y * 2., float(k)))); m.rough = .45; m.f0 = .05; return;
  }
  if (rr > .78 + .06 * sin(a * 5.)) {                                   // rice
    vec3 c = cells(p * 3.2);
    m.alb = mix(RGB(250, 248, 240), RGB(226, 222, 210), smoothstep(.05, .32, c.x)); m.rough = .45; m.sss = .8; return;
  }
  float s = sin(a + float(k) * 1.3);                                    // the filling: salmon, with avocado or cucumber beside it
  m.alb = s > .2 ? mix(RGB(246, 126, 78), RGB(252, 176, 140), smoothstep(.3, .5, abs(fract(q.x * 2.2 + q.z) - .5)))
        : (k % 2 == 0 ? mix(RGB(176, 204, 96), RGB(226, 232, 150), smoothstep(.2, .7, rr)) : mix(RGB(206, 232, 170), RGB(90, 150, 70), smoothstep(.45, .75, rr)));
  m.rough = .3; m.sss = .7;
}
