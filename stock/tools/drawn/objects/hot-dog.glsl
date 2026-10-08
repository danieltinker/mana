// Hot dog: a sausage in a split bun, mustard and ketchup in two wavy lines.
const float PT = .46, YS = 3.15;
vec3 loc(vec3 p) { vec3 q = p - vec3(0., PT, 0.); q.xz = rot(.36) * q.xz; return q; }
float line(vec3 q, float ph) {
  float z = .62 * sin(q.x * 1.75 + ph), zz = clamp(z, -1.2, 1.2), y = YS + sqrt(max(1.69 - zz * zz, 0.)) + .08;
  return max(length(vec2(q.z - z, q.y - y)) * .55 - .15, abs(q.x) - 6.9);
}
vec2 mapM(vec3 p) {
  vec2 res = vec2(sdPlate(p, 11.2, 1.0, 7.), 1.);
  vec3 q = loc(p);
  float bun = sdRBox(q - vec3(0., 1.95, 0.), vec3(7.5, 1.95, 2.65), 1.85) - .05 * fbm(q * 1.2);
  float split = max(abs(q.z) - .5 - max(q.y - 1.3, 0.) * .62, 1.25 - q.y);
  bun = smax(bun, -split, .3);
  float sausage = sdCapsule(q, vec3(-7.9, YS - .12, 0.), vec3(7.9, YS - .12, 0.), 1.3) + .1 * (1. - smoothstep(6.6, 8.6, abs(q.x))) * 0.;
  res = U(res, vec2(bun * .85, 2.));
  res = U(res, vec2(sausage, 3.));
  res = U(res, vec2(line(q, 0.), 4.));
  return U(res, vec2(line(q, PI), 5.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  vec3 q = loc(p);
  if (id == 2) {
    float inside = smoothstep(.75, .2, abs(q.z) - max(q.y - 1.3, 0.) * .62) * step(1.2, q.y);
    vec3 crust = mix(RGB(238, 200, 142), RGB(196, 124, 54), smoothstep(1.4, 3.6, q.y + .5 * fbm(q * .8)));
    m.alb = mix(crust, RGB(250, 238, 208), inside); m.rough = mix(.35, .85, inside); m.f0 = .05; m.sss = .5; m.gloss = .7;
  }
  else if (id == 3) { float g = smoothstep(.36, .44, abs(fract(q.x * .55 + .2 * q.z) - .5)); m.alb = mix(RGB(176, 70, 40), RGB(104, 38, 22), g * .55) * (.9 + .15 * fbm(q * 2.)); m.rough = .2; m.f0 = .06; m.sss = .3; }
  else if (id == 4) { m.alb = RGB(244, 192, 30); m.rough = .25; m.f0 = .05; m.sss = .4; }
  else { m.alb = RGB(196, 30, 26); m.rough = .2; m.f0 = .05; m.sss = .4; }
}
