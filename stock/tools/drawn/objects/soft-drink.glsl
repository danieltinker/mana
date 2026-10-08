// Soft drink: a tall glass of cola over ice, a slice of lemon on the rim, a straw.
const float H = 14.6, LEVEL = 12.9, BASE = 1.1;
float glR(float y) { return 3.3 + .42 * clamp(y / H, 0., 1.); }
float ice(vec3 p) {
  float d = 1e3;
  for (int i = 0; i < 8; i++) {
    float f = float(i); vec3 c = vec3(1.75 * cos(f * 2.4 + 1.1), LEVEL + .25 - 1.5 * floor(f / 3.) - .5 * hash11(f + 3.), 1.75 * sin(f * 2.4 + 1.1));
    vec3 q = p - c; q.xz = rot(f * 1.7) * q.xz; q.xy = rot(.5 * sin(f * 2.3)) * q.xy;
    d = min(d, sdRBox(q, vec3(1.05), .36));
  }
  return d;
}
float lemon(vec3 p) { vec3 q = p - vec3(-3.35, H + .35, 1.4); q.xz = rot(-.4) * q.xz; return max(max(length(q.xy) - 2.35, abs(q.z) - .2), -max(abs(q.x) - .11, q.y + .2)) - .04; }
vec2 mapM(vec3 p) {
  float r = length(p.xz), y = p.y, sd = PROF(glR, r, y);
  float ic = max(ice(p), sd + .2);
  float straw = sdCapsule(p, vec3(-.6, 1.5, .3), vec3(2.6, 19.6, -2.2), .3);
  float lm = lemon(p);
  float liq = max(max(max(sd + .2, y - LEVEL), BASE - y), -(min(ic, straw) - .02));
  vec2 res = U(U(U(vec2(liq, 2.), vec2(ic, 3.)), vec2(straw, 4.)), vec2(lm, 5.));
  if (gPass == 0) res = U(res, vec2(max(min(shell(sd, y, 0., H, .18), max(sd, y - BASE)), -(lm - .03)), 1.));
  return res;
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { m.type = 1; m.alb = vec3(.96, .975, .97); }
  else if (id == 2) { m.type = 2; m.alb = vec3(.115, .032, .009); m.absorb = vec3(.85, 1.5, 2.6); }
  else if (id == 3) { m.type = 2; m.alb = vec3(.62, .52, .44); m.absorb = vec3(.26, .32, .40); }
  else if (id == 4) { m.alb = RGB(196, 36, 34); m.rough = .35; }
  else {
    vec3 q = p - vec3(-3.35, H + .35, 1.4); q.xz = rot(-.4) * q.xz; float rr = length(q.xy) / 2.35, a = atan(q.y, q.x);
    vec3 pulp = mix(RGB(246, 222, 96), RGB(252, 238, 150), .5 + .5 * cos(a * 9.));
    pulp = mix(pulp, RGB(250, 244, 214), smoothstep(.38, .5, abs(fract(a * 9. / (2. * PI)) - .5)) * .8 + smoothstep(.12, .0, rr));
    m.alb = abs(q.z) > .17 && rr < .8 ? pulp : mix(pulp, rr > .92 ? RGB(240, 196, 40) : RGB(250, 244, 214), smoothstep(.78, .84, rr));
    m.rough = .3; m.sss = .7;
  }
}
