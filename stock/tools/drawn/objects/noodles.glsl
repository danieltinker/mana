// Noodles: a bowl of stir-fried noodles with vegetables, chopsticks resting on the rim.
const float R0 = 8.4, H = 5.6;
float heap(vec3 p) { float r = length(p.xz); return 4.7 + 1.9 * (1. - r * r / 44.) + .25 * sin(p.x * 1.1) * sin(p.z * 1.3); }
float strands(vec3 p) {                                     // ridges that wander across the heap and cross each other: three families of noodles
  vec2 u = p.xz + 5.5 * (vec2(fbm2(p * .16 + 1.), fbm2(p * .16 + 9.)) - .5);
  vec2 v = p.xz + 5.5 * (vec2(fbm2(p * .19 + 21.), fbm2(p * .19 + 33.)) - .5);
  float a = abs(fract(u.x * .95) - .5) * 2., b = abs(fract(v.y * .9 + .25) - .5) * 2., c = abs(fract((v.x + u.y) * .62) - .5) * 2.;
  return max(max(smoothstep(.55, .1, a) * .75, smoothstep(.55, .1, b)), smoothstep(.5, .1, c) * .9);
}
vec2 veg(vec3 p) {
  vec2 best = vec2(1e3, 0.); vec2 cell = floor(p.xz / 2.6);
  for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) {
    vec2 id = cell + vec2(a, b); float h = hash21(id + 3.1), h2 = hash21(id + 17.7);
    vec2 c = (id + .5 + (vec2(h, h2) - .5) * .8) * 2.6; if (length(c) > 6.2 || h2 < .25) continue;
    vec3 q = p - vec3(c.x, heap(vec3(c.x, 0., c.y)) + .28, c.y); q.xz = rot(h * 6.3) * q.xz; q.xy = rot((h2 - .6) * .7) * q.xy;
    float t = floor(h * 3.99), d;
    if (t < 1.) d = sdRBox(q, vec3(1.25, .12, .3), .1);                   // a strip of carrot
    else if (t < 2.) d = max(abs(length(q.xz) - .5) - .16, abs(q.y) - .2) - .04;   // a ring of scallion
    else if (t < 3.) d = sdRBox(q, vec3(1.1, .14, .38), .12);             // red pepper
    else d = sdEllipsoid(q, vec3(.95, .3, .6));                           // a snow pea
    if (d < best.x) best = vec2(d, 4. + t);
  }
  return best;
}
vec2 mapM(vec3 p) {
  vec2 res = vec2(sdBowl(p, R0, H, .38), 1.);
  float r = length(p.xz), inside = (r - R0 * (.36 + .64 * sqrt(clamp(p.y / H, 0., 1.))) + .55) * .7;
  float d = max(max(p.y - heap(p), inside), .6 - p.y);
  if (d < .5) d -= .22 * strands(p);
  res = U(res, vec2(d * .5, 2.));
  if (p.y > 3.5 && r < 7.6) { vec2 v = veg(p); v.x = max(v.x, inside); res = U(res, v); }
  float st = min(sdCapsule(p, vec3(-9.8, 6.2, 3.2), vec3(9.4, 6.5, -1.6), .24), sdCapsule(p, vec3(-9.6, 6.2, 4.0), vec3(9.6, 6.5, -.6), .24));
  return U(res, vec2(st, 3.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { m.alb = RGB(36, 40, 48); m.rough = .25; m.f0 = .05; return; }          // a dark bowl, as noodle bars use
  if (id == 3) { m.alb = mix(RGB(206, 164, 108), RGB(178, 132, 80), fbm(vec3(p.x * .4, p.y * 6., p.z * 6.))); m.rough = .5; return; }
  m.rough = .28; m.f0 = .05; m.sss = .6;
  if (id == 2) { float s = strands(p); m.alb = mix(RGB(150, 100, 44), RGB(240, 202, 128), smoothstep(.15, .8, s)) * (.9 + .15 * fbm(p * 2.)); m.alb = mix(m.alb, RGB(120, 64, 24), smoothstep(.6, .85, fbm(p * .9 + 3.)) * .35); }
  else if (id == 4) m.alb = RGB(240, 132, 36);
  else if (id == 5) m.alb = mix(RGB(96, 160, 60), RGB(206, 226, 150), smoothstep(.3, .6, length(fract(p.xz) - .5)));
  else if (id == 6) m.alb = RGB(206, 40, 34);
  else m.alb = mix(RGB(70, 140, 50), RGB(130, 186, 80), fbm2(p * 2.));
}
