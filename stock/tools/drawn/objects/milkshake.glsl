// Milkshake: a tall footed glass, strawberry shake, whipped cream, a cherry, a striped straw.
const float H = 15.4, F0 = 2.3;
float glR(float y) { float k = clamp((y - F0) / (H - F0), 0., 1.); return 1.75 + 2.5 * pow(k, .62); }
float cream(vec3 p) {
  vec3 q = p - vec3(0., H - .3, 0.); float a = atan(q.z, q.x), r = length(q.xz);
  float R = 4.15 * pow(max(1. - q.y / 4.3, 0.), .62) * (1. + .07 * sin(a * 7. + q.y * 2.6));
  return max(max((r - R) * .6, -q.y), q.y - 4.25);
}
vec2 mapM(vec3 p) {
  float r = length(p.xz), y = p.y, sd = PROF(glR, r, y);
  float shake = max(max(sd + .18, y - (H - .25)), F0 + .25 - y);
  float cr = cream(p);
  float cherry = sdSphere(p - vec3(.3, H + 4.15, .2), .95);
  float stem = sdCapsule(p, vec3(.3, H + 5., .2), vec3(1.5, H + 7.1, -.3), .07);
  float straw = sdCapsule(p, vec3(-1.0, 3.5, 0.), vec3(-3.3, H + 5.6, -1.2), .33);
  vec2 res = U(U(U(U(vec2(shake, 2.), vec2(cr, 3.)), vec2(cherry, 4.)), vec2(stem, 6.)), vec2(straw, 5.));
  if (gPass == 0) {
    float cup = shell(sd, y, F0, H, .17);
    float knob = sdEllipsoid(p - vec3(0., 1.55, 0.), vec3(1.25, .95, 1.25));
    float foot = max(y - (.2 + .75 * smoothstep(3.4, .6, r)), max(r - 3.45, -y)) * .8;
    res = U(res, vec2(smin(smin(cup, knob, .5), foot, .4), 1.));
  }
  return res;
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { m.type = 1; m.alb = vec3(.96, .975, .97); }
  else if (id == 2) { float v = fbm(p * .5 + 3.); m.alb = mix(RGB(238, 150, 164), RGB(250, 196, 202), v); m.rough = .4; m.sss = .7; }
  else if (id == 3) { m.alb = RGB(250, 246, 236); m.rough = .5; m.sss = .9; }
  else if (id == 4) { m.alb = RGB(176, 14, 30); m.rough = .06; m.f0 = .08; m.sss = .3; }
  else if (id == 6) { m.alb = RGB(96, 120, 44); m.rough = .5; }
  else { vec3 a = vec3(-1.0, 3.5, 0.), b = vec3(-3.3, H + 5.6, -1.2); float t = dot(p - a, normalize(b - a)); m.alb = fract(t * .55) < .5 ? RGB(244, 242, 236) : RGB(210, 44, 52); m.rough = .5; }
}
