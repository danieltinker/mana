// Espresso: a small thick cup on a small saucer, dark coffee under a tiger-striped crema.
const float H = 5.5, Y0 = .42, LEVEL = 4.75;
float cupR(float y) { float k = clamp((y - Y0) / (H - Y0), 0., 1.); return 2.05 + 1.2 * pow(k, .72); }
vec2 mapM(vec3 p) {
  float r = length(p.xz), y = p.y;
  float saucer = sdPlate(p, 6.1, .7, 2.6);
  float sd = PROF(cupR, r, y);
  float cup = smin(shell(sd, y, Y0, H, .42), sdRCyl(p - vec3(0., Y0 + .25, 0.), 2.1, .25, .08), .2) - .04;
  vec3 q = p - vec3(0., 3.05, 0.); q.xz = rot(.55) * q.xz; q.x -= 3.05;
  float hd = length(vec2(length(vec2(q.x * .95, q.y * .8)) - 1.12, q.z)) - .33;
  cup = smin(cup, max(hd, -(sd + .1)), .22);
  float coffee = max(max(sd + .44, y - LEVEL), Y0 + .5 - y);
  vec3 s = p - vec3(-3.6, .98, 3.1); s.xz = rot(-.7) * s.xz;                 // a small spoon on the saucer
  float spoon = min(sdEllipsoid(s - vec3(2.2, .12, 0.), vec3(.95, .2, .62)), sdCapsule(s, vec3(-2.6, .18, 0.), vec3(1.5, .1, 0.), .13));
  return U(U(U(vec2(saucer, 1.), vec2(cup, 1.)), vec2(coffee, 2.)), vec2(spoon, 3.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { m.alb = RGB(238, 236, 231); m.rough = .08; m.f0 = .06; m.sss = .25; return; }
  if (id == 3) { m.alb = RGB(205, 205, 208); m.rough = .22; m.f0 = .55; return; }
  vec2 u = p.xz / 2.72; float r = length(u);
  float tiger = fbm(vec3(u * vec2(2.2, 5.5) + 1.5 * fbm2(vec3(u * 1.6, 3.)), 2.));
  vec3 c = mix(RGB(86, 44, 18), RGB(188, 122, 52), smoothstep(.25, .72, tiger));
  c = mix(c, RGB(214, 158, 88), smoothstep(.62, .95, r) * .7);              // crema is palest where it meets the cup
  c = mix(c, RGB(60, 28, 12), smoothstep(.5, .0, r) * .35 * smoothstep(.6, .3, tiger));
  m.alb = c * (.92 + .08 * smoothstep(.1, .35, cells(vec3(p.xz * 12., 0.)).x));
  m.rough = .3; m.f0 = .04; m.sss = .35;
}
