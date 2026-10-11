// Entrée de développement : la vidéo verticale complète, image fixe à l'instant t.
import { createTikTokWorld } from '../../tiktok/src/world.js';

const W = window.__W || 540;
const H = window.__H || 960;
const canvas = document.getElementById('gl');
canvas.width = W;
canvas.height = H;
const ex = window.__extra || {};
const world = createTikTokWorld({ canvas, width: W, height: H, samples: 4, shadowType: 'basic' });

window.__shot = async (t, samples) => {
  const t0 = performance.now();
  const base = ex.base || 5;
  const fps = 24;
  world.pipe.renderFrame({
    time: t,
    frameIndex: Math.round(t * fps),
    shutter: ex.shutter ?? world.shutterFor(t, fps, base),
    samples: samples || world.samplesFor(t, base, fps),
    evaluate: (tt) => world.evaluate(tt),
  });
  const gl = world.pipe.renderer.getContext();
  world.pipe.renderer.setRenderTarget(null);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  return { ms: Math.round(performance.now() - t0), t, n: samples || world.samplesFor(t, base, fps) };
};
window.__speed = async (t, base = 5, fps = 24) => {
  const sh = world.shutterFor(t, fps, base);
  return { t, shutter: sh * fps, px: world.motionPx(t, sh), n: world.samplesFor(t, base, fps), manual: 0 };
};
