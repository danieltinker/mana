/* GLSL shared by the dish material (the dissolve) and the particles: the same "burn key" in both, so a particle is born
   exactly where and when the surface under it burns away, and lands exactly where and when the next dish condenses.
   key(p, h) in [0,1]: soft simplex noise mixed with height (the top burns first, the base forms first). */
export const KEY_GLSL = /* glsl */`
vec3 hm_mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 hm_mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 hm_perm(vec4 x){return hm_mod289(((x*34.0)+1.0)*x);}
float hm_snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=hm_mod289(i);
  vec4 p=hm_perm(hm_perm(hm_perm(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw); vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0)); vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=1.79284291400159-0.85373472095314*vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float hm_key(vec3 p, float h){
  float n = 0.5 + 0.5 * (0.68 * hm_snoise(p * 2.1) + 0.32 * hm_snoise(p * 5.3 + 7.1));
  float y = clamp(p.y / max(h, 1e-3), 0.0, 1.0);
  return clamp(0.52 * n + 0.48 * (1.0 - y), 0.0, 1.0);
}
`;

/* The particles: A's surface → swirl (a vortex around the vertical axis + a divergence-free ABC flow, peaking mid-way,
   with a slight lift) → B's surface. Each particle's own clock runs from its birth (A's key) to its landing (B's key). */
export const POINTS_VERT = /* glsl */`
uniform float uU, uW, uHA, uHB, uTime, uScale, uSize, uSwirl;
attribute vec3 aB;
attribute vec3 aCA;
attribute vec3 aCB;
attribute vec4 aRnd;
varying vec3 vColor;
varying float vAlpha;
varying float vGlow;
${KEY_GLSL}
vec3 abc(vec3 p){
  return vec3(sin(p.z) + 0.8 * cos(p.y), 0.9 * sin(p.x) + cos(p.z), 0.8 * sin(p.y) + 0.9 * cos(p.x));
}
void main(){
  float kA = hm_key(position, uHA);
  float kB = hm_key(aB, uHB);
  float s = 1.0 + 2.0 * uW;
  float ub = 0.42 * (kA + uW) / s;
  float ua = 0.58 + 0.42 * (1.0 - (kB + uW) / s);
  float lt = clamp((uU - ub) / max(ua - ub, 1e-3), 0.0, 1.0);
  float e = lt < 0.5 ? 4.0 * lt * lt * lt : 1.0 - pow(-2.0 * lt + 2.0, 3.0) / 2.0;
  float arc = sin(3.14159265 * lt);
  vec3 p = mix(position, aB, e);
  // mid-way the matter gathers into a turning ring of light (a torus around the dish's axis), then lets go
  float ang = atan(p.z, p.x);
  float tube = 0.03 + 0.15 * aRnd.y * aRnd.y;
  float psi = aRnd.x * 6.2831853 + uTime * (0.8 + 1.2 * aRnd.z);
  float rr = 0.66 + tube * cos(psi);
  vec3 ring = vec3(cos(ang) * rr, 0.5 * mix(uHA, uHB, e) - 0.1 + tube * sin(psi) * 0.75, sin(ang) * rr);
  p = mix(p, ring, 0.86 * pow(arc, 1.4));
  float r = length(p.xz);
  float th = uSwirl * arc * (0.55 + 0.45 * aRnd.x) / (0.38 + r);
  float c = cos(th), sn = sin(th);
  p.xz = mat2(c, -sn, sn, c) * p.xz;
  p.y += arc * (0.06 + 0.12 * aRnd.y);
  p += abc(p * 2.6 + vec3(uTime * 0.35, 0.0, uTime * 0.27)) * (0.04 * arc * (0.6 + 0.8 * aRnd.z));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.z += 0.012;
  gl_Position = projectionMatrix * mv;
  float born = smoothstep(ub, ub + 0.035, uU);
  float gone = 1.0 - smoothstep(ua, ua + 0.05, uU);
  float spark = step(0.78, aRnd.z);
  vAlpha = born * gone * (1.0 - (0.7 - 0.5 * spark) * arc);
  vGlow = arc;
  vec3 base = mix(aCA, aCB, smoothstep(0.35, 0.85, lt));
  base = min(pow(base, vec3(0.8)) * 1.12, vec3(1.0));
  float hue = aRnd.w;
  vec3 energy = hue < 0.85 ? mix(vec3(0.99, 0.76, 0.2), vec3(1.0, 0.56, 0.24), hue / 0.85)
                           : mix(vec3(1.0, 0.5, 0.32), vec3(0.9, 0.4, 0.5), (hue - 0.85) / 0.15);
  float birth = (1.0 - smoothstep(0.0, 0.2, lt)) * born;
  float flash = birth + (1.0 - smoothstep(0.0, 0.1, 1.0 - lt)) * 0.35;
  vColor = mix(base, energy, clamp(0.92 * smoothstep(0.0, 0.6, arc) + 0.9 * birth + 0.3 * flash, 0.0, 1.0));
  vColor = mix(vColor, vec3(1.0, 0.95, 0.82), 0.12 * flash + (0.34 - 0.3 * spark) * arc);
  float size = uSize * (0.75 + 0.5 * aRnd.z) * (1.0 + (0.5 + 1.6 * spark) * arc + 0.6 * flash);
  gl_PointSize = max(size * uScale / -mv.z, 1.0);
}
`;

export const POINTS_FRAG = /* glsl */`
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
varying float vGlow;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = 1.0 - smoothstep(mix(0.62, 0.3, vGlow), mix(0.95, 0.46, vGlow), d);
  float halo = exp(-d * d * 4.0) * 0.32 * vGlow;
  float a = max(core, halo) * vAlpha * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

/* The motes: a few hundred tiny golden specks drifting on slow orbits around the dish. */
export const MOTES_VERT = /* glsl */`
uniform float uPhase, uTime, uScale, uSize, uEnergy;
attribute vec4 aRnd;
varying float vAlpha;
varying float vWarm;
void main(){
  float ang = aRnd.x * 6.2831853 + uPhase * (0.06 + 0.1 * aRnd.y) * (aRnd.z > 0.5 ? 1.0 : -0.7);
  float r = position.x * (1.0 + 0.06 * sin(uTime * 0.4 + aRnd.w * 9.0));
  float y = position.y + 0.07 * sin(uTime * (0.35 + 0.3 * aRnd.w) + aRnd.x * 12.0);
  vec4 mv = modelViewMatrix * vec4(cos(ang) * r, y, sin(ang) * r, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.55 + 0.45 * sin(uTime * (0.8 + 1.4 * aRnd.y) + aRnd.z * 20.0);
  vAlpha = tw * (0.55 + 0.45 * uEnergy) * smoothstep(1.7, 1.25, length(vec2(r, y * 0.8)));
  vWarm = aRnd.w;
  gl_PointSize = max(uSize * (0.6 + 0.8 * aRnd.y) * (1.0 + 0.35 * uEnergy) * uScale / -mv.z, 1.0);
}
`;

export const MOTES_FRAG = /* glsl */`
uniform float uOpacity;
varying float vAlpha;
varying float vWarm;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a * vAlpha * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(vec3(0.961, 0.694, 0.125), vec3(1.0, 0.82, 0.45), vWarm), a);
}
`;
