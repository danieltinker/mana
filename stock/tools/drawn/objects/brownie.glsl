// Brownies: two squares stacked, a cracked glossy top, walnuts in the cut sides.
const float PT = .46;
vec3 q1(vec3 p) { vec3 q = p - vec3(-.6, PT + 1.3, -.4); q.xz = rot(.3) * q.xz; return q; }
vec3 q2(vec3 p) { vec3 q = p - vec3(.9, PT + 3.85, .6); q.xz = rot(-.42) * q.xz; q.yz = rot(.06) * q.yz; return q; }
float block(vec3 q) {
  float top = smoothstep(.7, 1.25, q.y), d = sdRBox(q, vec3(2.9, 1.28, 2.9), .14);
  if (d > .4) return (d - .1) * .85;
  return (d - .07 * top * fbm(q * 2.2) - .03 * (1. - top) * vnoise(q * 7.)) * .85;
}
vec2 mapM(vec3 p) {
  return U(U(vec2(sdPlate(p, 9.6, 1.0, 6.), 1.), vec2(block(q1(p)), 2.)), vec2(block(q2(p)), 3.));
}
void material(int id, vec3 p, inout vec3 n, inout Mat m) {
  if (id == 1) { ceramic(m); return; }
  vec3 q = id == 2 ? q1(p) : q2(p);
  if (q.y > 1.12) {                                                    // the crust: thin, shiny, cracked like dry earth
    vec2 wq = q.xz + .5 * vec2(fbm2(q * .9), fbm2(q * .9 + 5.));
    vec3 c = cells(vec3(wq * .62, float(id)));
    float crack = smoothstep(.07, .0, c.y - c.x) * smoothstep(.3, .55, fbm(q * .7 + 2.));
    m.alb = mix(mix(RGB(112, 64, 38), RGB(140, 86, 52), fbm(q * 1.3)), RGB(46, 22, 12), crack * .85);
    m.rough = mix(.28, .7, crack); m.f0 = .05; m.gloss = 1.1;
  } else {                                                             // the cut side: dark and moist, with pieces of walnut
    vec3 c = cells(q * 1.25 + 3.);
    m.alb = mix(RGB(60, 30, 16), RGB(84, 46, 24), fbm(q * 3.));
    m.alb = mix(RGB(206, 168, 116), m.alb, smoothstep(.17, .24, c.x + .12 * step(.45, c.z)));
    m.rough = .6; m.sss = .3;
  }
}
