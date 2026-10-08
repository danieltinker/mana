// Fruit shake: a wide glass of thick berry smoothie, a strawberry on the rim, mint, a straw.
const float H = 13.4, LEVEL = 12.5, BASE = .9;
float glR(float y) { float k = clamp(y / H, 0., 1.); return 3.5 + .75 * k - .22 * sin(PI * k); }
vec3 berryAt(vec3 p) { vec3 q = p - vec3(3.5, H + .7, 1.9); q.xy = rot(.9) * q.xy; return q; }
vec2 mapM(vec3 p) {
  float r = length(p.xz), y = p.y, sd = PROF(glR, r, y);
  float straw = sdCapsule(p, vec3(.6, 1.6, .2), vec3(-2.9, 19.2, -1.6), .36);
  float liq = max(max(max(sd + .19, y - LEVEL - .22 * smoothstep(3.6, 0., r) * (.6 + .4 * fbm2(p * .9))), BASE - y), -(straw - .02));
  vec3 q = berryAt(p);
  float berry = sdBerry(q, 1.5);
  float cap = sdEllipsoid(q - vec3(0., -1.75, 0.), vec3(1.15, .22, 1.15)) - .03 * sin(atan(q.z, q.x) * 6.);
  vec3 l = p - vec3(.4, LEVEL + .15, .9); l.xz = rot(-.5) * l.xz; l.xy = rot(.5) * l.xy;
  vec3 l2 = p - vec3(.2, LEVEL + .15, .7); l2.xz = rot(-2.0) * l2.xz; l2.xy = rot(.6) * l2.xy;
  float leaf = min(sdLeaf(l.xzy, 2.8, .95), sdLeaf(l2.xzy, 2.3, .85));
  vec2 res = U(U(U(U(vec2(liq, 2.), vec2(straw, 4.)), vec2(berry, 3.)), vec2(cap, 5.)), vec2(leaf, 5.));
  if (gPass == 0) res = U(res, vec2(max(min(shell(sd, y, 0., H, .18), max(sd, y - BASE)), -(berry - .04)), 1.));
  return res;
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { m.type = 1; m.alb = vec3(.96, .975, .97); }
  else if (id == 2) {
    float v = fbm(p * .7 + 1.), k = clamp(p.y / LEVEL, 0., 1.);
    m.alb = mix(RGB(150, 40, 96), RGB(214, 96, 140), clamp(.25 + .5 * k + (v - .5) * .7, 0., 1.));
    if (p.y > LEVEL - .1) m.alb = mix(RGB(206, 96, 140), RGB(232, 140, 172), smoothstep(.3, .7, fbm(p * .9)));
    m.alb *= .95 + .05 * smoothstep(.05, .3, cells(p * 2.2).x); m.rough = .4; m.sss = .6;
  }
  else if (id == 3) {
    vec3 q = berryAt(p); vec3 c = cells(q * 3.4);
    m.alb = mix(RGB(206, 22, 30), RGB(236, 60, 44), fbm2(q * 1.5)); m.alb = mix(RGB(240, 210, 110), m.alb, smoothstep(.1, .2, c.x));
    m.rough = .12; m.f0 = .07; m.sss = .5;
  }
  else if (id == 5) { m.alb = mix(RGB(54, 116, 40), RGB(104, 164, 62), fbm2(p * 3.)); m.rough = .5; m.sss = .5; }
  else { m.alb = RGB(52, 50, 54); m.rough = .4; }
}
