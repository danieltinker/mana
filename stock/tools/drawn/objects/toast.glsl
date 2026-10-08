// Toast: a pressed cheese sandwich cut corner to corner, grill lines on the bread, cheese running out of the cut.
const float PT = .46, TH = 2.3;
const vec2 A = vec2(-7., 2.6), B = vec2(7., 2.6), C = vec2(0., -4.4);
vec3 half1(vec3 p) { vec3 q = p - vec3(-1.5, PT, -1.6); q.xz = rot(.28) * q.xz; return q; }
vec3 half2(vec3 p) { vec3 q = p - vec3(1.8, PT + 1.25, 2.3); q.xz = rot(-.5) * q.xz; q.yz = rot(-.31) * q.yz; return q; }
float halfD(vec3 q, out float cheese) {
  float t = sdTri2(q.xz, A, B, C);
  float press = .07 * smoothstep(.25, .1, abs(fract(q.x * .72) - .5));                 // the grooves the press leaves
  float bread = min(max(t, abs(q.y - .48) - .48), max(t, abs(q.y - TH + .48 + press * step(1.2, q.y)) - .48)) - .12;
  float drip = .5 * smoothstep(.55, 1., sin(q.x * 1.45 + 1.2)) * smoothstep(2.3, 2.75, q.z);
  cheese = max(t - .22 - drip, abs(q.y - TH * .5 + drip * .9) - .26 - drip * .5) - .1;
  return min(bread, cheese * .7);
}
vec2 mapM(vec3 p) {
  float c1, c2; float d1 = halfD(half1(p), c1), d2 = halfD(half2(p), c2);
  vec2 res = U(vec2(sdPlate(p, 12.4, 1.1, 7.6), 1.), vec2(d1, c1 * .7 <= d1 + 1e-4 ? 4. : 2.));
  res = U(res, vec2(d2, c2 * .7 <= d2 + 1e-4 ? 4. : 3.));
  vec3 o = p - vec3(6.6, PT + .8, -3.6);                                               // a few olives and a tomato beside it, as cafes serve it
  float ol = min(min(sdEllipsoid(o, vec3(.95, .8, .8)), sdEllipsoid(o - vec3(1.6, 0., 1.2), vec3(.8, .8, .95))), sdEllipsoid(o - vec3(-.2, 0., 1.8), vec3(.9, .8, .8)));
  res = U(res, vec2(ol, 5.));
  return U(res, vec2(sdSphere(p - vec3(-7.2, PT + 1.3, 3.2), 1.35), 6.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  if (id == 4) { m.alb = mix(RGB(250, 200, 64), RGB(255, 226, 120), fbm2(p * 1.5)); m.rough = .25; m.f0 = .05; m.sss = .8; return; }
  if (id == 5) { m.alb = mix(RGB(74, 96, 34), RGB(116, 132, 50), fbm2(p * 2.)); m.rough = .2; m.f0 = .06; return; }
  if (id == 6) { m.alb = RGB(206, 34, 28); m.rough = .12; m.f0 = .06; m.sss = .4; return; }
  vec3 q = id == 2 ? half1(p) : half2(p);
  float legs = min(sdSeg2(q.xz, A, C), sdSeg2(q.xz, B, C)), face = step(.6, abs(n.y)) ;
  float line = smoothstep(.3, .12, abs(fract(q.x * .72) - .5));
  vec3 toasted = mix(RGB(226, 172, 92), RGB(190, 124, 52), fbm(vec3(q.xz * .55, 1.)));
  toasted = mix(toasted, RGB(98, 54, 22), line * .85);
  vec3 crumb = RGB(246, 230, 196) * (.92 + .1 * vnoise(q * 8.));
  vec3 c = mix(crumb, toasted, face);
  m.alb = mix(RGB(160, 98, 44), c, smoothstep(.1, .26, legs)); m.rough = .75; m.sss = .4;
}
