// Tea with mint: a clear glass with a handle on a saucer, amber tea, a sprig of mint.
const float H = 9.2, Y0 = .44, LEVEL = 7.9;
float cupR(float y) { float k = clamp((y - Y0) / (H - Y0), 0., 1.); return 3.3 + .55 * k * k; }
float leaves(vec3 p) {
  float d = 1e3;
  vec3 a = p - vec3(-.4, LEVEL - .3, .3); a.xy = rot(-1.0) * a.xy; a.xz = rot(.3) * a.xz; d = min(d, sdLeaf(a.xzy, 3.3, 1.1));
  vec3 b = p - vec3(.3, LEVEL - .4, -.2); b.xy = rot(-1.25) * b.xy; b.xz = rot(-1.0) * b.xz; d = min(d, sdLeaf(b.xzy, 3.0, 1.0));
  vec3 c = p - vec3(-.2, LEVEL - .2, -.5); c.xy = rot(-.75) * c.xy; c.xz = rot(2.3) * c.xz; d = min(d, sdLeaf(c.xzy, 2.7, .95));
  vec3 e = p - vec3(.2, LEVEL + .1, .6); e.xy = rot(-.55) * e.xy; e.xz = rot(-2.6) * e.xz; d = min(d, sdLeaf(e.xzy, 2.3, .85));
  return min(d, sdCapsule(p, vec3(0., LEVEL - 3.5, 0.), vec3(-.1, LEVEL + .6, .1), .1));
}
vec2 mapM(vec3 p) {
  float r = length(p.xz), y = p.y;
  vec2 res = vec2(sdPlate(p, 7.3, .75, 3.6), 1.);
  float sd = PROF(cupR, r, y);
  float lf = leaves(p);
  float tea = max(max(max(sd + .2, y - LEVEL), Y0 + .75 - y), -(lf - .03));
  res = U(res, vec2(tea, 3.));
  res = U(res, vec2(lf, 4.));
  if (gPass == 0) {
    float glass = min(shell(sd, y, Y0, H, .17), sdRCyl(p - vec3(0., Y0 + .36, 0.), 3.3, .36, .1));
    vec3 q = p - vec3(0., 5., 0.); q.xz = rot(.45) * q.xz; q.x -= 3.75;
    float hd = length(vec2(length(vec2(q.x, q.y * .62)) - 1.75, q.z)) - .3;
    glass = min(glass, max(hd, -(sd + .05)));
    res = U(res, vec2(glass, 2.));
  }
  return res;
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { m.alb = RGB(238, 236, 231); m.rough = .16; m.f0 = .05; m.sss = .25; }
  else if (id == 2) { m.type = 1; m.alb = vec3(.95, .97, .96); }
  else if (id == 3) { m.type = 2; m.alb = vec3(.62, .22, .03); m.absorb = vec3(.07, .22, .75); }
  else { float v = fbm2(p * 3.); m.alb = mix(RGB(58, 118, 40), RGB(104, 160, 62), v); m.rough = .5; m.sss = .5; }
}
