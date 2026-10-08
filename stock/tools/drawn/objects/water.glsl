// Water: a clear bottle with a blue cap and a plain band for a label. No words, no brand.
const float H = 20.4, LEVEL = 16.2;
float botR(float y) {
  float r = mix(3.25, 1.38, smoothstep(13.0, 17.6, y));
  r -= .11 * (.5 + .5 * cos(y * 3.9)) * smoothstep(1.0, 1.8, y) * smoothstep(5.8, 5.0, y);                // grip rings near the foot
  return r * (1. - .22 * (1. - smoothstep(0., .9, y)));
}
vec2 mapM(vec3 p) {
  float r = length(p.xz), y = p.y, sd = PROF(botR, r, y);
  float water = max(max(sd + .12, y - LEVEL), .35 - y);
  float a = atan(p.z, p.x);
  float cap = sdRCyl(p - vec3(0., H + .25, 0.), 1.6 + .035 * cos(a * 30.), .85, .12);
  float label = max(max(abs(sd - .015) - .03, y - 12.2), 6.6 - y);
  vec2 res = U(U(vec2(water, 2.), vec2(cap, 3.)), vec2(label, 4.));
  if (gPass == 0) res = U(res, vec2(max(min(shell(sd, y, 0., H, .1), max(sd, y - .32)), -(label - .01)), 1.));
  return res;
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { m.type = 1; m.alb = vec3(.93, .975, 1.); m.gloss = 1.2; }
  else if (id == 2) { m.type = 2; m.alb = vec3(.22, .60, .80); m.absorb = vec3(.085, .04, .028); }
  else if (id == 3) { m.alb = RGB(36, 110, 196); m.rough = .35; m.f0 = .05; }
  else {
    float a = atan(p.z, p.x), wave = p.y - 9.3 - .7 * sin(a * 2. + .6);
    m.alb = mix(RGB(232, 240, 248), RGB(60, 140, 214), smoothstep(.0, .12, -wave) * smoothstep(1.6, 1.45, -wave)); m.rough = .4; m.sss = .5;
  }
}
