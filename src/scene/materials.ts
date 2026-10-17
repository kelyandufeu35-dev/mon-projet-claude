import * as THREE from 'three';
import type { PartId } from '../lib/content';

/** Uniforms shared by every NEXUS shader (one object, one update per frame). */
export const shared = {
  uTime: { value: 0 },
  /** Activation wave progress, 0..1 (visible only strictly inside). */
  uWave: { value: 0 },
  /** Periodic calibration pulse after activation, 0..1 + amplitude. */
  uPulse: { value: 0 },
  uPulseAmp: { value: 0 },
  uGlow: { value: 0.5 },
  uReveal: { value: 0 },
};

export const CYAN = new THREE.Color('#58f0ff');
export const ORANGE = new THREE.Color('#ff7a2f');

const NOISE = /* glsl */ `
vec3 nx_mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 nx_mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 nx_perm(vec4 x){return nx_mod289(((x*34.0)+10.0)*x);}
vec4 nx_tis(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=nx_mod289(i);
  vec4 p=nx_perm(nx_perm(nx_perm(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=nx_tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/** World-space energy band travelling bottom → top. */
const BAND = /* glsl */ `
uniform float uWave;
uniform float uPulse;
uniform float uPulseAmp;
float nxBand(float y, float w, float width){
  float c = mix(-2.6, 2.6, w);
  float live = step(0.0005, w) * step(w, 0.9995);
  float d = (y - c) * width;
  return live * exp(-d * d);
}
/** Crisp scan line for hard surfaces. */
float nxEnergy(float y){
  return nxBand(y, uWave, 7.0) + uPulseAmp * nxBand(y, uPulse, 6.0);
}
/** Softer, wider swell for the plasma. */
float nxSwell(float y){
  return nxBand(y, uWave, 2.2) + uPulseAmp * nxBand(y, uPulse, 3.0);
}`;

export interface PartMaterial {
  material: THREE.MeshStandardMaterial;
  highlight: { value: number };
}

/**
 * Dark machined metal with the activation wave, a hover/selection rim and
 * (for the shell) engraved panel details, injected into the standard PBR
 * shader so it keeps env reflections and lights.
 */
export function createMetal(params: THREE.MeshStandardMaterialParameters, opts: { panel?: boolean } = {}): PartMaterial {
  const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...params });
  const highlight = { value: 0 };
  const panel = !!opts.panel;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWave = shared.uWave;
    shader.uniforms.uPulse = shared.uPulse;
    shader.uniforms.uPulseAmp = shared.uPulseAmp;
    shader.uniforms.uGlow = shared.uGlow;
    shader.uniforms.uHighlight = highlight;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vNxWorld;
${panel ? 'attribute vec3 aPanel; varying vec3 vNxPanel;' : ''}`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vec4 nxW = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
nxW = instanceMatrix * nxW;
#endif
vNxWorld = (modelMatrix * nxW).xyz;
${panel ? 'vNxPanel = aPanel;' : ''}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vNxWorld;
uniform float uGlow;
uniform float uHighlight;
${panel ? 'varying vec3 vNxPanel;' : ''}
${BAND}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  vec3 nxCyan = vec3(0.34, 0.92, 1.0);
  float e = nxEnergy(vNxWorld.y);
  totalEmissiveRadiance += nxCyan * e * 1.3;
  vec3 V = normalize(vViewPosition);
  float rim = pow(1.0 - abs(dot(normal, V)), 3.0);
  // A faint cyan rim keeps dark silhouettes readable against the void.
  totalEmissiveRadiance += nxCyan * rim * (0.06 + uHighlight * 0.9);
  ${
    panel
      ? `if (vNxPanel.z > 0.5) {
    float u = vNxPanel.x; float v = vNxPanel.y;
    // Engraved seam across the petal.
    float seam = 1.0 - smoothstep(0.0, 0.006, abs(v - 0.46));
    diffuseColor.rgb *= 1.0 - seam * 0.8;
    // Cyan vent slit near the equator edge; brightens with the core.
    float slit = step(0.18, u) * step(u, 0.82) * smoothstep(0.86, 0.87, v) * (1.0 - smoothstep(0.89, 0.9, v));
    totalEmissiveRadiance += nxCyan * slit * (0.3 + uGlow * 0.95);
    // A single orange status mark per petal.
    float mark = step(0.46, u) * step(u, 0.54) * step(0.1, v) * step(v, 0.16);
    totalEmissiveRadiance += vec3(1.0, 0.42, 0.12) * mark * 2.2;
    roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.55, step(0.5, v));
  }`
      : ''
  }
}`,
      );
  };
  material.customProgramCacheKey = () => (panel ? 'nx-metal-panel' : 'nx-metal');
  return { material, highlight };
}

/** The plasma core: displaced icosphere, veins, fresnel and the wave. */
export function createCoreMaterial() {
  const highlight = { value: 0 };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uGlow: shared.uGlow,
      uWave: shared.uWave,
      uPulse: shared.uPulse,
      uPulseAmp: shared.uPulseAmp,
      uReveal: shared.uReveal,
      uHighlight: highlight,
    },
    vertexShader: /* glsl */ `
uniform float uTime;
uniform float uGlow;
${BAND}
${NOISE}
varying vec3 vN;
varying vec3 vView;
varying float vVein;
varying float vEnergy;
varying vec3 vLocal;
void main(){
  vec3 p = position;
  vec3 n = normalize(p);
  vec4 world = modelMatrix * vec4(p, 1.0);
  float e = nxSwell(world.y);
  float slow = snoise(n * 1.6 + vec3(0.0, uTime * 0.18, 0.0));
  float fine = snoise(n * 4.2 - vec3(uTime * 0.35));
  float disp = slow * 0.028 + fine * 0.005 * (0.6 + uGlow) + e * 0.06;
  p += n * disp;
  vVein = fine;
  vEnergy = e;
  vLocal = n;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = -mv.xyz;
  vN = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uGlow;
uniform float uReveal;
uniform float uHighlight;
varying vec3 vN;
varying vec3 vView;
varying float vVein;
varying float vEnergy;
varying vec3 vLocal;
void main(){
  vec3 V = normalize(vView);
  float facing = clamp(dot(normalize(vN), V), 0.0, 1.0);
  float fres = pow(1.0 - facing, 2.2);
  vec3 deep = vec3(0.01, 0.12, 0.2);
  vec3 cyan = vec3(0.3, 0.9, 1.0);
  vec3 hot = vec3(0.85, 1.0, 1.0);
  // Thin bright filaments where the fine noise crosses zero.
  float vein = 1.0 - smoothstep(0.0, 0.09, abs(vVein));
  // Latitude bands give the plasma a sense of rotation.
  float bands = 0.5 + 0.5 * sin(vLocal.y * 18.0 + uTime * 1.4 + vVein * 2.0);
  vec3 col = mix(deep, cyan, 0.35 + 0.35 * bands);
  col += cyan * vein * (0.6 + uGlow * 1.4);
  col = mix(col, hot, pow(facing, 4.0) * 0.35 * min(uGlow, 1.0));
  col += cyan * fres * (0.8 + uHighlight * 0.8);
  col += hot * vEnergy * 1.2;
  float intensity = (0.28 + uGlow * 0.72) * uReveal;
  gl_FragColor = vec4(col * intensity, 1.0);
}`,
  });
  return { material, highlight };
}

/** Thin glass containment sphere: fresnel only, hexagonal etching. */
export function createGlassMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uGlow: shared.uGlow, uReveal: shared.uReveal, uWave: shared.uWave, uPulse: shared.uPulse, uPulseAmp: shared.uPulseAmp },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
varying vec3 vN; varying vec3 vView; varying vec3 vLocal; varying float vY;
void main(){
  vLocal = normalize(position);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vY = world.y;
  vec4 mv = viewMatrix * world;
  vView = -mv.xyz;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform float uGlow; uniform float uReveal;
${BAND}
varying vec3 vN; varying vec3 vView; varying vec3 vLocal; varying float vY;
float hexEdge(vec2 p){
  p = abs(p);
  vec2 r = vec2(1.0, 1.732);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 q = abs(g);
  return 0.5 - max(dot(q, normalize(r)), q.x);
}
void main(){
  vec3 V = normalize(vView);
  float f = pow(1.0 - abs(dot(normalize(vN), V)), 2.6);
  vec2 uv = vec2(atan(vLocal.z, vLocal.x) * 4.0, asin(clamp(vLocal.y, -1.0, 1.0)) * 4.0);
  float edge = 1.0 - smoothstep(0.0, 0.035, hexEdge(uv * 1.6));
  float e = nxEnergy(vY);
  vec3 col = vec3(0.45, 0.9, 1.0) * (f * 0.3 + edge * 0.035 * (0.4 + uGlow) + e * (0.05 + edge * 0.45));
  gl_FragColor = vec4(col * uReveal, 1.0);
}`,
  });
}

/** Particle field: slow orbital drift, soft discs, energised by the wave. */
export function createParticleMaterial(pixelRatio: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uGlow: shared.uGlow,
      uReveal: shared.uReveal,
      uWave: shared.uWave,
      uPulse: shared.uPulse,
      uPulseAmp: shared.uPulseAmp,
      uPixelRatio: { value: pixelRatio },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
uniform float uTime; uniform float uGlow; uniform float uPixelRatio;
${BAND}
attribute vec4 aSeed;
varying float vAlpha; varying float vWarm;
void main(){
  vec3 p = position;
  float ang = uTime * (0.02 + aSeed.x * 0.05) * (aSeed.y > 0.5 ? 1.0 : -1.0);
  float c = cos(ang), s = sin(ang);
  p.xz = mat2(c, -s, s, c) * p.xz;
  p.y += sin(uTime * 0.3 + aSeed.z * 6.283) * 0.12;
  vec4 world = modelMatrix * vec4(p, 1.0);
  float e = nxEnergy(world.y);
  vec4 mv = viewMatrix * world;
  float size = (0.6 + aSeed.w * 1.6) * (1.0 + e * 1.5);
  gl_PointSize = size * uPixelRatio * (9.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
  float twinkle = 0.65 + 0.35 * sin(uTime * (0.6 + aSeed.x) + aSeed.z * 40.0);
  vAlpha = twinkle * (0.25 + 0.25 * uGlow + e * 0.9) * smoothstep(14.0, 4.0, -mv.z);
  vWarm = step(0.93, aSeed.y);
}`,
    fragmentShader: /* glsl */ `
uniform float uReveal;
varying float vAlpha; varying float vWarm;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  float a = smoothstep(0.25, 0.0, r);
  vec3 col = mix(vec3(0.45, 0.92, 1.0), vec3(1.0, 0.5, 0.2), vWarm);
  gl_FragColor = vec4(col * a * vAlpha * uReveal, 1.0);
}`,
  });
}

/** Floor: barely-there grid, a light pool under the core, the wave ring. */
export function createFloorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uGlow: shared.uGlow, uReveal: shared.uReveal, uWave: shared.uWave, uTime: shared.uTime },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
uniform float uGlow; uniform float uReveal; uniform float uWave;
varying vec3 vW;
float grid(vec2 p, float s){
  vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s);
  return 1.0 - min(min(g.x, g.y), 1.0);
}
void main(){
  float d = length(vW.xz);
  float fade = smoothstep(16.0, 2.0, d);
  float g = grid(vW.xz, 1.0) * 0.06 + grid(vW.xz, 4.0) * 0.08;
  vec3 col = vec3(0.35, 0.85, 1.0) * g * fade;
  col += vec3(0.2, 0.75, 1.0) * exp(-d * d * 0.18) * 0.22 * uGlow;
  float live = step(0.001, uWave) * step(uWave, 0.999);
  float ringR = uWave * 11.0;
  col += vec3(0.5, 0.95, 1.0) * live * exp(-pow((d - ringR) * 3.0, 2.0)) * (1.0 - uWave) * 0.55;
  float a = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);
  gl_FragColor = vec4(col * uReveal, a * uReveal);
}`,
  });
}

export function createHaloMaterial(color: THREE.Color) {
  return new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
}

export interface MaterialSet {
  core: THREE.ShaderMaterial;
  glass: THREE.ShaderMaterial;
  shell: THREE.MeshStandardMaterial;
  rings: THREE.MeshStandardMaterial;
  injectors: THREE.MeshStandardMaterial;
  crown: THREE.MeshStandardMaterial;
  highlights: Record<PartId, { value: number }>;
  coreLight: THREE.MeshBasicMaterial;
  orangeLight: THREE.MeshBasicMaterial;
  cage: THREE.LineBasicMaterial;
}

let materials: MaterialSet | null = null;

export function getMaterials(): MaterialSet {
  if (materials) return materials;
  const core = createCoreMaterial();
  const shell = createMetal({ color: '#23272d', metalness: 1, roughness: 0.34 }, { panel: true });
  const rings = createMetal({ color: '#7d858f', metalness: 1, roughness: 0.22 });
  const injectors = createMetal({ color: '#3a3f46', metalness: 1, roughness: 0.4 });
  const crown = createMetal({ color: '#2b2f35', metalness: 1, roughness: 0.3 });
  materials = {
    core: core.material,
    glass: createGlassMaterial(),
    shell: shell.material,
    rings: rings.material,
    injectors: injectors.material,
    crown: crown.material,
    highlights: {
      core: core.highlight,
      shell: shell.highlight,
      rings: rings.highlight,
      injectors: injectors.highlight,
      crown: crown.highlight,
    },
    coreLight: new THREE.MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(3) }),
    orangeLight: new THREE.MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(2.4) }),
    cage: new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  return materials;
}
