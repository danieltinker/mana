// Fruit salad: a white bowl heaped with strawberry, kiwi, melon, banana, grapes and blueberries.
const float G = 1.72;
vec2 fruit(vec3 p) {
  vec2 best = vec2(1e3, 0.);
  vec2 cell = floor(p.xz / G);
  for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) {
    vec2 id = cell + vec2(a, b); float h = hash21(id + 7.3), h2 = hash21(id + 31.7), h3 = hash21(id + 3.9);
    vec2 c = (id + .5 + (vec2(h2, h3) - .5) * .7) * G; float rc = length(c);
    if (rc > 6.7) continue;
    float y0 = 3.4 + 2.5 * (1. - rc * rc / 47.) + .7 * h3;
    vec3 q = p - vec3(c.x, y0, c.y); q.xz = rot(h * 6.3) * q.xz; q.xy = rot((h2 - .5) * 1.6) * q.xy;
    float t = floor(h * 5.99), d;
    if (t < 1.) d = sdBerry(q.yxz, 1.05);
    else if (t < 2.) d = sdRCyl(q, 1.15, .36, .12);                       // a slice of kiwi
    else if (t < 3.) d = sdRBox(q, vec3(.9), .22);                        // melon
    else if (t < 4.) d = sdRCyl(q, 1.02, .38, .14);                       // banana
    else if (t < 5.) d = sdEllipsoid(q, vec3(1.0, .76, .76));             // a grape
    else d = min(sdSphere(q - vec3(.52, 0., 0.), .58), sdSphere(q + vec3(.52, .1, .3), .56));   // blueberries
    if (d < best.x) best = vec2(d, 3. + t);
  }
  return best;
}
vec2 mapM(vec3 p) {
  vec2 res = vec2(sdBowl(p, 8.2, 5.2, .36), 1.);
  float r = length(p.xz);
  float inside = (r - 8.2 * (.36 + .64 * sqrt(clamp(p.y / 5.2, 0., 1.))) + .5) * .7;       // nothing pokes through the bowl
  float bed = max(max(sdEllipsoid(p - vec3(0., 2.4, 0.), vec3(7.1, 2.9, 7.1)) - .12 * sin(p.x * 2.3) * sin(p.z * 2.1), inside), .5 - p.y);
  res = U(res, vec2(bed, 2.));
  float bound = sdEllipsoid(p - vec3(0., 4.4, 0.), vec3(8.0, 4.2, 8.0));
  if (bound > 1.2) return U(res, vec2(max(bound - .8, inside), 3.));
  vec2 f = fruit(p); f.x = max(f.x, inside);
  return U(res, f);
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  m.rough = .22; m.f0 = .05; m.sss = .7;
  if (id == 2) {                                                          // what lies underneath: more of the same, in shadow
    vec3 c = cells(p * .75); float k = c.z;
    m.alb = (k < .3 ? RGB(232, 150, 60) : k < .55 ? RGB(150, 190, 70) : k < .8 ? RGB(236, 214, 140) : RGB(206, 40, 40)) * (.55 + .3 * smoothstep(.1, .5, c.y - c.x)); return;
  }
  if (id == 3) { vec3 c = cells(p * 3.4); m.alb = mix(RGB(240, 210, 110), mix(RGB(206, 22, 30), RGB(236, 60, 44), fbm2(p * 1.5)), smoothstep(.1, .2, c.x)); m.rough = .12; }
  else if (id == 4) {                                                     // kiwi: green flesh and a ring of seeds
    m.alb = mix(RGB(120, 176, 56), RGB(182, 216, 100), vnoise(p * 2.));
    m.alb = mix(m.alb, RGB(40, 34, 20), smoothstep(.17, .09, cells(p * 4.5).x) * .8);
  }
  else if (id == 5) m.alb = mix(RGB(250, 162, 66), RGB(255, 198, 110), fbm2(p * 1.5));
  else if (id == 6) m.alb = mix(RGB(250, 236, 176), RGB(238, 214, 136), fbm2(p * 2.));
  else if (id == 7) { m.alb = mix(RGB(104, 26, 58), RGB(150, 50, 84), fbm2(p * 1.5)); m.rough = .1; m.f0 = .06; }
  else { m.alb = mix(RGB(40, 40, 96), RGB(88, 86, 146), smoothstep(.3, .9, n.y) * .6); m.rough = .35; }
}
