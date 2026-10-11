// Entrée de développement : le monde complet de la scène pilote, image fixe à l'instant t.
import * as THREE from 'three';
import { createWorld } from '../../pilot/src/world.js';
import { configureCamera } from '../../engine/camera.js';

const W = window.__W || 1280;
const H = window.__H || 720;
const canvas = document.getElementById('gl');
canvas.width = W;
canvas.height = H;
const world = createWorld({ canvas, width: W, height: H, samples: 4, shadowType: (window.__extra && window.__extra.shadowType) || 'pcfsoft' });
if (window.__extra && window.__extra.noPrepass) world.pipe.prepass = false;
if (window.__extra && window.__extra.prepass) world.pipe.prepass = true;
// Crochet de débogage : code JS arbitraire exécuté une fois la scène créée (développement uniquement).
if (window.__extra && window.__extra.js) new Function('world', 'THREE', window.__extra.js)(world, THREE);

window.__shot = async (t, samples) => {
  const ex = window.__extra || {};
  const tt0 = () => t;
  if (ex.grade) Object.assign(world.pipe.grade, ex.grade);
  const t0 = performance.now();
  world.pipe.renderFrame({
    time: t,
    frameIndex: Math.round(t * 24),
    shutter: ex.shutter ?? 0,
    samples: ex.exactSamples ? samples : world.samplesFor(tt0(), samples),
    evaluate: (tt) => {
      const r = world.evaluate(tt);
      if (ex.grade) Object.assign(world.pipe.grade, ex.grade);
      if (window.__cam) {
        const lens = configureCamera(world.camera, { focal: 28, fstop: 8, near: 0.03, far: 150, aspect: W / H, ...window.__cam });
        return { scene: r.scene, camera: world.camera, lens };
      }
      return r;
    },
  });
  const gl = world.pipe.renderer.getContext();
  world.pipe.renderer.setRenderTarget(null);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  const bad = (world.pipe.renderer.info.programs || []).filter((p) => p.diagnostics && p.diagnostics.runnable === false).map((p) => ({ name: p.name, log: (p.diagnostics.programLog || '') + (p.diagnostics.fragmentShader ? p.diagnostics.fragmentShader.log : '') + (p.diagnostics.vertexShader ? p.diagnostics.vertexShader.log : '') }));
  const l = world.state.lens;
  return { ms: Math.round(performance.now() - t0), t, lens: l, cam: world.camera.position.toArray(), fov: world.camera.fov, P: world.P.toArray(), badPrograms: bad, nPrograms: (world.pipe.renderer.info.programs || []).length, calls: world.pipe.renderer.info.render.calls, tris: world.pipe.renderer.info.render.triangles };
};
