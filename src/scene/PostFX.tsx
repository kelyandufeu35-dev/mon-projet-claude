import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { TierSettings } from '../lib/quality';
import { frame } from '../lib/store';
import { shared } from './materials';

/** Bloom computed at a fraction of the canvas resolution. */
class ScaledBloomPass extends UnrealBloomPass {
  scale = 0.5;
  setSize(width: number, height: number) {
    // UnrealBloomPass already halves internally; `scale` is relative to that.
    super.setSize(Math.max(2, Math.round(width * this.scale * 2)), Math.max(2, Math.round(height * this.scale * 2)));
  }
}

/** Lens finish after tone mapping: vignette, faint edge aberration, grain. */
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.035 },
    uAberration: { value: 0.004 },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uAberration;
varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec2 c = vUv - 0.5;
  float d = dot(c, c);
  vec2 off = c * d * uAberration * 4.0;
  vec3 col;
  col.r = texture2D(tDiffuse, vUv - off).r;
  col.g = texture2D(tDiffuse, vUv).g;
  col.b = texture2D(tDiffuse, vUv + off).b;
  col *= mix(1.0, 0.32, smoothstep(0.08, 0.62, d));
  col += (hash(vUv * 1024.0 + fract(uTime) * 61.0) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`,
};

export function PostFX({ settings }: { settings: TierSettings }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const { composer, bloom, finish } = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      samples: settings.msaa,
    });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new ScaledBloomPass(new THREE.Vector2(256, 256), 0.4, 0.42, 0.92);
    bloom.scale = settings.bloomScale;
    bloom.enabled = settings.bloom;
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const finish = new ShaderPass(FinishShader);
    finish.uniforms.uGrain.value = settings.grain ? 0.032 : 0;
    composer.addPass(finish);
    return { composer, bloom, finish };
  }, [gl, scene, camera, settings]);

  useEffect(() => {
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);
  }, [composer, dpr, size.width, size.height]);

  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
      composer.dispose();
    };
  }, [gl, composer]);

  useFrame((_, delta) => {
    finish.uniforms.uTime.value = shared.uTime.value;
    // Bloom follows the core energy but never washes out the metal.
    bloom.strength = 0.18 + Math.min(1.5, shared.uGlow.value) * 0.16;
    gl.info.reset();
    const t0 = performance.now();
    composer.render(delta);
    frame.renderMs += (performance.now() - t0 - frame.renderMs) * 0.05;
    frame.calls = gl.info.render.calls;
    frame.triangles = gl.info.render.triangles;
  }, 1);

  return null;
}
