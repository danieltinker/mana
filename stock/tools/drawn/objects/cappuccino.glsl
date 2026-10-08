// Cappuccino: a white cup on its saucer, milk foam with a heart poured into it. Sizes in cm.
const float H = 6.4, Y0 = .44, LEVEL = 5.95;
float cupR(float y) { float k = clamp((y - Y0) / (H - Y0), 0., 1.); return 2.45 + 2.3 * pow(k, .5); }
float sdHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.) return length(p - vec2(.25, .75)) - .35355;
  vec2 a = p - vec2(0., 1.), b = p - .5 * max(p.x + p.y, 0.);
  return sqrt(min(dot(a, a), dot(b, b))) * sign(p.x - p.y);
}
vec2 mapM(vec3 p) {
  float r = length(p.xz), y = p.y;
  float saucer = sdPlate(p, 7.7, .8, 3.2);
  float sd = PROF(cupR, r, y);
  float wall = shell(sd, y, Y0, H, .34);
  float foot = sdRCyl(p - vec3(0., Y0 + .22, 0.), 2.5, .22, .08);
  float cup = smin(wall, foot, .2) - .035;
  vec3 q = p - vec3(0., 3.55, 0.); q.xz = rot(.5) * q.xz; q.x -= 4.35;
  float hd = length(vec2(length(vec2(q.x * .92, q.y * .78)) - 1.5, q.z)) - .40;
  cup = smin(cup, max(hd, -(sd + .12)), .28);
  float coffee = max(max(sd + .36, y - LEVEL), Y0 + .5 - y);
  return U(U(vec2(saucer, 1.), vec2(cup, 1.)), vec2(coffee, 2.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { m.alb = RGB(238, 236, 231); m.rough = .08; m.f0 = .06; m.sss = .25; return; }
  vec2 u = p.xz / 3.95; float r = length(u);
  vec2 w = u + .06 * vec2(fbm2(p * 1.1), fbm2(p * 1.1 + 9.)) - .03;
  float heart = sdHeart(vec2(w.x, -w.y) * 1.25 + vec2(0., .55));
  float a = atan(w.x, -w.y), rr = length(w);
  float ring = abs(rr - .80 - .03 * cos(a * 2.)) - .03;
  float leafs = abs(fract((rr + .18 * cos(a)) * 4.2) - .5) - .16;          // the ripples a pour leaves behind the heart
  float foam = smoothstep(.07, -.05, heart);
  foam = max(foam, .5 * smoothstep(.035, -.03, ring));
  foam = max(foam, .38 * smoothstep(.05, -.05, leafs) * smoothstep(.05, .2, heart) * smoothstep(.74, .6, rr) * smoothstep(.3, -.2, w.y));
  vec3 crema = mix(RGB(150, 88, 42), RGB(196, 132, 74), fbm(vec3(u * 3.5, 1.)));
  crema = mix(crema, RGB(110, 60, 26), smoothstep(.84, 1., r) * .85);
  m.alb = mix(crema, RGB(250, 242, 228), foam * .97);
  m.alb *= .94 + .06 * smoothstep(.1, .4, cells(vec3(p.xz * 9., 0.)).x);
  m.rough = .45; m.f0 = .035; m.sss = .5;
}
