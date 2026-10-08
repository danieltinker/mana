// Red wine: a stemmed glass, about a third full.
const float B0 = 8.6, H = 20.2, LEVEL = 13.4, RM = 4.5;
float bowlR(float y) {
  float k = clamp((y - B0) / (H - B0), 0., 1.), k0 = .34;
  return k < k0 ? RM * sqrt(max(1. - (1. - k / k0) * (1. - k / k0), 0.)) : RM * (1. - .27 * pow((k - k0) / (1. - k0), 1.55));
}
vec2 mapM(vec3 p) {
  float r = length(p.xz), y = p.y, sd = PROF(bowlR, r, y);
  float wine = max(max(sd + .13, y - LEVEL), B0 + .1 - y);
  vec2 res = vec2(wine, 2.);
  if (gPass == 0) {
    float bowl = max(max(abs(sd + .06) - .06, y - H), B0 - .05 - y);
    float stem = sdCapsule(p, vec3(0., .5, 0.), vec3(0., B0 + .2, 0.), .34);
    float foot = max(length(vec2(max(r - 3.2, 0.), y - .12)) - .12, -y) ;
    foot = min(foot, max(y - (.14 + .55 * smoothstep(3.2, .3, r)), max(r - 3.25, -y)) * .8);
    res = U(res, vec2(smin(smin(bowl, stem, .9), foot, .5), 1.));
  }
  return res;
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { m.type = 1; m.alb = vec3(.965, .975, .975); }
  else { m.type = 2; m.alb = vec3(.30, .008, .026); m.absorb = vec3(.55, 2.2, 1.7); }
}
