// Sandwich: two halves of a white-bread sandwich stacked, cut sides to the camera: lettuce, tomato, cheese, egg salad.
const float PT = .46, TH = 4.1;
const vec2 A = vec2(-7., 2.6), B = vec2(7., 2.6), C = vec2(0., -4.4);
vec3 half1(vec3 p) { vec3 q = p - vec3(-.9, PT, -.9); q.xz = rot(.22) * q.xz; return q; }
vec3 half2(vec3 p) { vec3 q = p - vec3(.9, PT + TH + .1, .8); q.xz = rot(-.3) * q.xz; q.yz = rot(.05) * q.yz; return q; }
float halfD(vec3 q) {
  float t = sdTri2(q.xz, A, B, C);
  float bread = min(max(t, abs(q.y - .6) - .6), max(t, abs(q.y - TH + .6) - .6)) - .1;
  float lett = max(t - .42 - .16 * sin(q.x * 3.1 + q.z * 1.7), abs(q.y - 1.42 - .11 * sin(q.x * 4.3) * cos(q.z * 3.7)) - .13) * .7;
  float tom = max(t + .18, abs(q.y - 1.95) - .26) - .06;
  float cheese = max(t - .16, abs(q.y - 2.42 + .1 * smoothstep(-.3, .25, t)) - .1);
  float egg = max(t + .1 - .08 * fbm2(q * 2.), abs(q.y - 2.95) - .32) - .08;
  return min(min(min(bread, lett), min(tom, cheese)), egg);
}
vec2 mapM(vec3 p) {
  return U(U(vec2(sdPlate(p, 12.4, 1.1, 7.6), 1.), vec2(halfD(half1(p)), 2.)), vec2(halfD(half2(p)), 3.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  vec3 q = id == 2 ? half1(p) : half2(p);
  float t = sdTri2(q.xz, A, B, C), y = q.y;
  if (y < 1.24 || y > TH - 1.24) {                                      // bread: brown crust on the two outer edges, crumb on the cut and on top
    float legs = min(sdSeg2(q.xz, A, C), sdSeg2(q.xz, B, C));
    float holes = smoothstep(.12, .3, cells(q * 2.4).x);
    vec3 crumb = mix(RGB(206, 176, 126), RGB(246, 232, 202), holes) * (.94 + .1 * vnoise(q * 9.));
    crumb = mix(crumb, RGB(226, 190, 128), smoothstep(.35, .7, fbm(vec3(q.xz * .5, 3.))) * step(.5, abs(n.y)) * .55);   // lightly toasted faces
    m.alb = mix(RGB(168, 106, 50), crumb, smoothstep(.16, .3, legs)); m.rough = .9; m.sss = .5;
  }
  else if (y < 1.66) { m.alb = mix(RGB(84, 150, 44), RGB(170, 208, 96), fbm(q * 1.7)); m.rough = .4; m.sss = .7; }
  else if (y < 2.27) { float seeds = smoothstep(.2, .1, cells(q * 2.6).x); m.alb = mix(RGB(214, 44, 32), RGB(246, 150, 96), seeds * .7); m.rough = .2; m.f0 = .05; m.sss = .7; }
  else if (y < 2.58) { m.alb = RGB(250, 196, 60); m.rough = .35; m.sss = .7; }
  else { m.alb = mix(RGB(250, 238, 196), RGB(244, 206, 96), smoothstep(.3, .15, cells(q * 2.1).x)); m.rough = .7; m.sss = .6; }
}
