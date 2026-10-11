// Pipeline de rendu cinématographique (WebGL2, rastérisation PBR).
//
// Ce que ce pipeline fait réellement (et rien de plus) :
//  - rendu HDR linéaire (HalfFloat) de la scène Three.js, N sous-échantillons par image ;
//  - chaque sous-échantillon décale : le temps dans l'obturateur (flou de mouvement réel),
//    la position sur la pupille de l'objectif (profondeur de champ réelle, bokeh en disque),
//    et la grille de pixels (anticrénelage) ;
//  - accumulation en float32, puis bloom (chaîne de mips), tonemapping neutre, étalonnage,
//    vignette, aberration chromatique légère, grain et dither.
// Ce n'est PAS du ray tracing ni du path tracing : l'éclairage est de l'IBL + lumières
// analytiques + ombres par shadow maps. L'image est une pure fonction du temps (déterministe).

import * as THREE from 'three';
import { applyShaderPatches } from './patches.js';

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Suite de Halton : échantillonnage quasi-aléatoire déterministe (pas de Math.random).
export function halton(index, base) {
  let f = 1, r = 0, i = index;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

function makeQuadScene(material) {
  const geo = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { scene, cam, mesh };
}

const ACCUM_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform float uWeight;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  // Écrêtage anti-"fireflies" : une valeur HDR aberrante ne doit pas polluer toute l'image.
  c = min(c, vec3(64.0));
  gl_FragColor = vec4(c * uWeight, 1.0);
}`;

// Bloom en chaîne de mips (filtre dual de type "Call of Duty: Advanced Warfare").
const BLOOM_DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;       // 1 / taille de la source
uniform float uFirst;      // 1.0 : moyenne de Karis + seuil
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 karis(vec3 c) { return c / (1.0 + luma(c)); }
vec3 prefilter(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float w = max(soft, br - uThreshold) / max(br, 1e-4);
  return c * w;
}

void main() {
  vec2 t = uTexel;
  vec3 a = texture2D(tSrc, vUv + t * vec2(-2.0, -2.0)).rgb;
  vec3 b = texture2D(tSrc, vUv + t * vec2( 0.0, -2.0)).rgb;
  vec3 c = texture2D(tSrc, vUv + t * vec2( 2.0, -2.0)).rgb;
  vec3 d = texture2D(tSrc, vUv + t * vec2(-2.0,  0.0)).rgb;
  vec3 e = texture2D(tSrc, vUv).rgb;
  vec3 f = texture2D(tSrc, vUv + t * vec2( 2.0,  0.0)).rgb;
  vec3 g = texture2D(tSrc, vUv + t * vec2(-2.0,  2.0)).rgb;
  vec3 h = texture2D(tSrc, vUv + t * vec2( 0.0,  2.0)).rgb;
  vec3 i = texture2D(tSrc, vUv + t * vec2( 2.0,  2.0)).rgb;
  vec3 j = texture2D(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb;
  vec3 k = texture2D(tSrc, vUv + t * vec2( 1.0, -1.0)).rgb;
  vec3 l = texture2D(tSrc, vUv + t * vec2(-1.0,  1.0)).rgb;
  vec3 m = texture2D(tSrc, vUv + t * vec2( 1.0,  1.0)).rgb;
  vec3 res;
  if (uFirst > 0.5) {
    a = prefilter(a); b = prefilter(b); c = prefilter(c); d = prefilter(d);
    e = prefilter(e); f = prefilter(f); g = prefilter(g); h = prefilter(h);
    i = prefilter(i); j = prefilter(j); k = prefilter(k); l = prefilter(l); m = prefilter(m);
    vec3 g0 = (a + b + d + e) * 0.25;
    vec3 g1 = (b + c + e + f) * 0.25;
    vec3 g2 = (d + e + g + h) * 0.25;
    vec3 g3 = (e + f + h + i) * 0.25;
    vec3 g4 = (j + k + l + m) * 0.25;
    res = karis(g0) * 0.125 + karis(g1) * 0.125 + karis(g2) * 0.125 + karis(g3) * 0.125 + karis(g4) * 0.5;
    res = res / (1.0 - luma(res) + 1e-4);
  } else {
    res = e * 0.125;
    res += (a + c + g + i) * 0.03125;
    res += (b + d + f + h) * 0.0625;
    res += (j + k + l + m) * 0.125;
  }
  gl_FragColor = vec4(res, 1.0);
}`;

const BLOOM_UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;       // 1 / taille de la source (niveau inférieur)
uniform float uRadius;
uniform float uWeight;
varying vec2 vUv;
void main() {
  vec2 t = uTexel * uRadius;
  vec3 s = vec3(0.0);
  s += texture2D(tSrc, vUv + t * vec2(-1.0,  1.0)).rgb * 0.0625;
  s += texture2D(tSrc, vUv + t * vec2( 0.0,  1.0)).rgb * 0.125;
  s += texture2D(tSrc, vUv + t * vec2( 1.0,  1.0)).rgb * 0.0625;
  s += texture2D(tSrc, vUv + t * vec2(-1.0,  0.0)).rgb * 0.125;
  s += texture2D(tSrc, vUv).rgb * 0.25;
  s += texture2D(tSrc, vUv + t * vec2( 1.0,  0.0)).rgb * 0.125;
  s += texture2D(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb * 0.0625;
  s += texture2D(tSrc, vUv + t * vec2( 0.0, -1.0)).rgb * 0.125;
  s += texture2D(tSrc, vUv + t * vec2( 1.0, -1.0)).rgb * 0.0625;
  gl_FragColor = vec4(s * uWeight, 1.0);
}`;

// Traînée horizontale (reflet d'anamorphique très discret) : flou 1D large sur les hautes lumières.
const STREAK_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 s = vec3(0.0);
  float wsum = 0.0;
  for (int i = -12; i <= 12; i++) {
    float x = float(i);
    float w = exp(-x * x / 60.0);
    s += texture2D(tSrc, vUv + vec2(x * uTexel.x * 3.0, 0.0)).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(s / wsum, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tStreak;
uniform vec2 uResolution;
uniform float uExposure;
uniform float uBloomStrength;
uniform float uStreakStrength;
uniform float uVignette;
uniform float uGrain;
uniform float uCA;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uLift;
uniform vec3 uGamma;
uniform vec3 uGain;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uFade;
uniform float uFlash;
uniform float uFrame;
varying vec2 vUv;

vec3 neutralTonemap(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, newPeak * vec3(1.0), g);
}

vec3 toSRGB(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 sampleHDR(vec2 uv) {
  vec3 c = texture2D(tScene, uv).rgb;
  c += texture2D(tBloom, uv).rgb * uBloomStrength;
  c += texture2D(tStreak, uv).rgb * uStreakStrength;
  return c;
}

void main() {
  vec2 uv = vUv;
  vec2 cc = uv - 0.5;
  float r2 = dot(cc, cc);

  // Aberration chromatique transversale, nulle au centre.
  vec2 off = cc * r2 * uCA;
  vec3 hdr;
  hdr.r = sampleHDR(uv + off).r;
  hdr.g = sampleHDR(uv).g;
  hdr.b = sampleHDR(uv - off).b;

  hdr += uFlash * vec3(1.0, 1.0, 1.0);
  hdr *= uExposure;
  vec3 mapped = neutralTonemap(hdr);
  vec3 col = toSRGB(clamp(mapped, 0.0, 1.0));

  // Teinte ombres / hautes lumières (split toning discret).
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col += uShadowTint * (1.0 - smoothstep(0.0, 0.45, lum)) * 0.06;
  col += uHighlightTint * smoothstep(0.55, 1.0, lum) * 0.05;

  // Lift / gamma / gain.
  col = col * uGain + uLift * (1.0 - col);
  col = pow(max(col, vec3(0.0)), 1.0 / max(uGamma, vec3(0.01)));

  // Courbe en S douce autour du gris moyen (contraste cinéma) + saturation.
  vec3 s = col * col * (3.0 - 2.0 * col);
  col = mix(col, s, uContrast);
  float l2 = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l2), col, uSaturation);

  // Vignette.
  float vig = smoothstep(0.85, 0.15, length(cc * vec2(1.0, 0.85)));
  col *= mix(1.0, vig, uVignette);

  // Grain (déterministe, indexé sur l'image) + dither triangulaire anti-banding.
  vec2 px = floor(uv * uResolution);
  float n1 = hash12(px + uFrame * 17.0);
  float n2 = hash12(px * 1.37 + uFrame * 31.0 + 7.0);
  float grain = (n1 + n2 - 1.0);
  float shade = 1.0 - abs(lum - 0.45);
  col += grain * uGrain * (0.35 + 0.65 * shade);
  col += (hash12(px + 91.7) + hash12(px + 13.1) - 1.0) * (1.0 + 2.5 * clamp(uFlash, 0.0, 1.0)) / 255.0;

  col *= uFade;
  gl_FragColor = vec4(col, 1.0);
}`;

export class CinePipeline {
  constructor({ canvas, width, height, samples = 8, bloomLevels = 6, msaa = 0, prepass = false, shadowType = 'pcfsoft' }) {
    applyShaderPatches();
    this.msaa = msaa;
    this.prepass = prepass;
    this.width = width;
    this.height = height;
    this.samples = samples;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = { basic: THREE.BasicShadowMap, pcf: THREE.PCFShadowMap, pcfsoft: THREE.PCFSoftShadowMap }[shadowType] ?? THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    // Les effacements sont explicites : un `render()` ne doit jamais effacer la profondeur du
    // pré-passage ni le tampon d'accumulation.
    renderer.autoClear = false;
    this.renderer = renderer;

    const gl = renderer.getContext();
    this.caps = {
      webgl2: renderer.capabilities.isWebGL2,
      floatRT: !!gl.getExtension('EXT_color_buffer_float'),
      halfFloatRT: !!gl.getExtension('EXT_color_buffer_half_float') || !!gl.getExtension('EXT_color_buffer_float'),
      maxTextureSize: renderer.capabilities.maxTextureSize,
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
      renderer: (() => {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'inconnu';
      })(),
    };

    const rtOpts = {
      depthBuffer: true,
      stencilBuffer: false,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      samples: 0,
    };
    this.sampleRT = new THREE.WebGLRenderTarget(width, height, { ...rtOpts, type: THREE.HalfFloatType, samples: msaa });
    this.depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    this.accumRT = new THREE.WebGLRenderTarget(width, height, {
      ...rtOpts,
      depthBuffer: false,
      type: this.caps.floatRT ? THREE.FloatType : THREE.HalfFloatType,
    });

    // Passes plein écran.
    this.accumQuad = makeQuadScene(
      new THREE.ShaderMaterial({
        uniforms: { tSrc: { value: null }, uWeight: { value: 1 } },
        vertexShader: FS_VERT,
        fragmentShader: ACCUM_FRAG,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
        depthTest: false,
        depthWrite: false,
      })
    );

    // Chaîne de bloom.
    this.bloomLevels = bloomLevels;
    this.bloomRTs = [];
    let bw = Math.max(1, width >> 1);
    let bh = Math.max(1, height >> 1);
    for (let i = 0; i < bloomLevels; i++) {
      this.bloomRTs.push(
        new THREE.WebGLRenderTarget(bw, bh, {
          depthBuffer: false,
          generateMipmaps: false,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          type: THREE.HalfFloatType,
        })
      );
      bw = Math.max(1, bw >> 1);
      bh = Math.max(1, bh >> 1);
    }
    this.bloomDownQuad = makeQuadScene(
      new THREE.ShaderMaterial({
        uniforms: {
          tSrc: { value: null },
          uTexel: { value: new THREE.Vector2() },
          uFirst: { value: 0 },
          uThreshold: { value: 1.0 },
          uKnee: { value: 0.5 },
        },
        vertexShader: FS_VERT,
        fragmentShader: BLOOM_DOWN_FRAG,
        depthTest: false,
        depthWrite: false,
      })
    );
    this.bloomUpQuad = makeQuadScene(
      new THREE.ShaderMaterial({
        uniforms: {
          tSrc: { value: null },
          uTexel: { value: new THREE.Vector2() },
          uRadius: { value: 1.0 },
          uWeight: { value: 1.0 },
        },
        vertexShader: FS_VERT,
        fragmentShader: BLOOM_UP_FRAG,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
        depthTest: false,
        depthWrite: false,
      })
    );

    this.streakRT = new THREE.WebGLRenderTarget(this.bloomRTs[1].width, this.bloomRTs[1].height, {
      depthBuffer: false,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
    });
    this.streakQuad = makeQuadScene(
      new THREE.ShaderMaterial({
        uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
        vertexShader: FS_VERT,
        fragmentShader: STREAK_FRAG,
        depthTest: false,
        depthWrite: false,
      })
    );

    this.grade = {
      exposure: 1.0,
      bloomStrength: 0.18,
      bloomThreshold: 2.5,
      bloomKnee: 1.0,
      bloomRadius: 1.0,
      streakStrength: 0.0,
      vignette: 0.55,
      grain: 0.008,
      chromaticAberration: 0.006,
      contrast: 0.35,
      saturation: 1.0,
      lift: [0.0, 0.0, 0.0],
      gamma: [1.0, 1.0, 1.0],
      gain: [1.0, 1.0, 1.0],
      shadowTint: [0.0, 0.1, 0.14],
      highlightTint: [0.04, 0.08, 0.1],
      fade: 1.0,
      flash: 0.0,
    };

    this.compositeQuad = makeQuadScene(
      new THREE.ShaderMaterial({
        uniforms: {
          tScene: { value: null },
          tBloom: { value: null },
          tStreak: { value: null },
          uResolution: { value: new THREE.Vector2(width, height) },
          uExposure: { value: 1 },
          uBloomStrength: { value: 0.2 },
          uStreakStrength: { value: 0 },
          uVignette: { value: 0.5 },
          uGrain: { value: 0.02 },
          uCA: { value: 0.01 },
          uContrast: { value: 0.3 },
          uSaturation: { value: 1 },
          uLift: { value: new THREE.Vector3() },
          uGamma: { value: new THREE.Vector3(1, 1, 1) },
          uGain: { value: new THREE.Vector3(1, 1, 1) },
          uShadowTint: { value: new THREE.Vector3() },
          uHighlightTint: { value: new THREE.Vector3() },
          uFade: { value: 1 },
          uFlash: { value: 0 },
          uFrame: { value: 0 },
        },
        vertexShader: FS_VERT,
        fragmentShader: COMPOSITE_FRAG,
        depthTest: false,
        depthWrite: false,
      })
    );
  }

  _fullscreen(q, target, clear = false) {
    const r = this.renderer;
    r.setRenderTarget(target);
    if (clear) {
      r.setClearColor(0x000000, 1);
      r.clear(true, false, false);
    }
    r.render(q.scene, q.cam);
  }

  // Pré-passage de profondeur : chaque pixel opaque n'est ombré qu'une seule fois.
  // Convention : les objets opaques sont sur le calque 0 ; verre, alpha-test et autres
  // objets transparents sont sur le calque 1 (rendus uniquement dans le passage couleur).
  _renderScene(scene, camera, updateShadows = false) {
    const r = this.renderer;
    if (!this.prepass) {
      camera.layers.enableAll();
      if (updateShadows) r.shadowMap.needsUpdate = true;
      r.render(scene, camera);
      return;
    }
    if (!scene.userData.__prepassReady) {
      scene.traverse((o) => {
        if (!o.material || !o.layers.isEnabled(0)) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          m.depthFunc = THREE.LessEqualDepth;
          m.depthWrite = false;
        }
      });
      scene.userData.__prepassReady = true;
    }
    camera.layers.set(0);
    scene.overrideMaterial = this.depthMat;
    r.render(scene, camera);
    scene.overrideMaterial = null;
    camera.layers.enableAll();
    // Les ombres sont calculées avec tous les calques visibles (la puce, calque 1, doit en projeter).
    if (updateShadows) r.shadowMap.needsUpdate = true;
    r.render(scene, camera);
  }

  _bloom() {
    const g = this.grade;
    const r = this.renderer;
    const down = this.bloomDownQuad.mesh.material;
    const up = this.bloomUpQuad.mesh.material;
    let src = this.accumRT.texture;
    let sw = this.width;
    let sh = this.height;
    for (let i = 0; i < this.bloomLevels; i++) {
      const rt = this.bloomRTs[i];
      down.uniforms.tSrc.value = src;
      down.uniforms.uTexel.value.set(1 / sw, 1 / sh);
      down.uniforms.uFirst.value = i === 0 ? 1 : 0;
      down.uniforms.uThreshold.value = g.bloomThreshold;
      down.uniforms.uKnee.value = g.bloomKnee;
      this._fullscreen(this.bloomDownQuad, rt);
      src = rt.texture;
      sw = rt.width;
      sh = rt.height;
    }
    for (let i = this.bloomLevels - 1; i > 0; i--) {
      const lower = this.bloomRTs[i];
      const upper = this.bloomRTs[i - 1];
      up.uniforms.tSrc.value = lower.texture;
      up.uniforms.uTexel.value.set(1 / lower.width, 1 / lower.height);
      up.uniforms.uRadius.value = g.bloomRadius;
      up.uniforms.uWeight.value = 1.0;
      this._fullscreen(this.bloomUpQuad, upper);
    }
    if (g.streakStrength > 0) {
      const st = this.streakQuad.mesh.material;
      st.uniforms.tSrc.value = this.bloomRTs[1].texture;
      st.uniforms.uTexel.value.set(1 / this.streakRT.width, 1 / this.streakRT.height);
      this._fullscreen(this.streakQuad, this.streakRT);
    }
    r.setRenderTarget(null);
  }

  /**
   * Rend une image.
   * @param {object} p
   * @param {number} p.time        instant de l'image (secondes)
   * @param {number} p.frameIndex  indice d'image (graine du grain)
   * @param {number} p.shutter     ouverture d'obturateur en secondes (ex. 0.5/fps pour 180°)
   * @param {(t:number)=>{scene:THREE.Scene, camera:THREE.PerspectiveCamera, lens:{aperture:number, focusDistance:number}}} p.evaluate
   *        met la scène à l'instant t et renvoie scène/caméra/objectif.
   */
  renderFrame({ time, frameIndex = 0, shutter = 0, evaluate, samples = this.samples }) {
    const r = this.renderer;
    const N = Math.max(1, samples | 0);
    this.accumQuad.mesh.material.uniforms.uWeight.value = 1 / N;

    r.setRenderTarget(this.accumRT);
    r.setClearColor(0x000000, 1);
    r.clear(true, false, false);

    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N;
      const tt = time + shutter * (u - 0.5);
      const { scene, camera, lens } = evaluate(tt, i, N);

      // Sous-pixel (anticrénelage).
      const jx = halton(i + 1, 2) - 0.5;
      const jy = halton(i + 1, 3) - 0.5;
      camera.setViewOffset(this.width, this.height, jx, jy, this.width, this.height);

      // Pupille (profondeur de champ) : on décale la caméra dans son plan et on la
      // re-vise vers le point de mise au point, ce qui conserve le plan net.
      if (lens && lens.aperture > 0) {
        camera.updateMatrixWorld(true);
        const e = camera.matrixWorld.elements;
        const right = new THREE.Vector3(e[0], e[1], e[2]);
        const up = new THREE.Vector3(e[4], e[5], e[6]);
        const fwd = new THREE.Vector3(-e[8], -e[9], -e[10]);
        const focusPoint = camera.position.clone().addScaledVector(fwd, lens.focusDistance);
        // Disque de Vogel/Halton : bokeh circulaire régulier.
        const rr = Math.sqrt(halton(i + 1, 5));
        const th = 2 * Math.PI * halton(i + 1, 7);
        const q0 = camera.quaternion.clone();
        camera.position.addScaledVector(right, Math.cos(th) * rr * lens.aperture);
        camera.position.addScaledVector(up, Math.sin(th) * rr * lens.aperture);
        // Re-pointage par rotation minimale (sans recalculer le roulis : `lookAt` est instable quand la
        // visée est presque parallèle au vecteur « haut »).
        const fwdNew = focusPoint.clone().sub(camera.position).normalize();
        const dq = new THREE.Quaternion().setFromUnitVectors(fwd, fwdNew);
        camera.quaternion.copy(dq.multiply(q0));
        camera.updateMatrixWorld(true);
      }

      r.setRenderTarget(this.sampleRT);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      this._renderScene(scene, camera, i === 0);

      this.accumQuad.mesh.material.uniforms.tSrc.value = this.sampleRT.texture;
      this._fullscreen(this.accumQuad, this.accumRT);
      camera.clearViewOffset();
    }

    this._bloom();

    const g = this.grade;
    const u = this.compositeQuad.mesh.material.uniforms;
    u.tScene.value = this.accumRT.texture;
    u.tBloom.value = this.bloomRTs[0].texture;
    u.tStreak.value = this.streakRT.texture;
    u.uExposure.value = g.exposure;
    u.uBloomStrength.value = g.bloomStrength;
    u.uStreakStrength.value = g.streakStrength;
    u.uVignette.value = g.vignette;
    u.uGrain.value = g.grain;
    u.uCA.value = g.chromaticAberration;
    u.uContrast.value = g.contrast;
    u.uSaturation.value = g.saturation;
    u.uLift.value.fromArray(g.lift);
    u.uGamma.value.fromArray(g.gamma);
    u.uGain.value.fromArray(g.gain);
    u.uShadowTint.value.fromArray(g.shadowTint);
    u.uHighlightTint.value.fromArray(g.highlightTint);
    u.uFade.value = g.fade;
    u.uFlash.value = g.flash;
    u.uFrame.value = frameIndex % 4096;
    r.setRenderTarget(null);
    r.render(this.compositeQuad.scene, this.compositeQuad.cam);
  }
}
