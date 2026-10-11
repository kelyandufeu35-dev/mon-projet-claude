// Entrée de développement : la page complète de la scène pilote (canevas + interface), image fixe à t.
import { createWorld, DURATION } from '../../pilot/src/world.js';
import { createHud } from '../../pilot/src/hud.js';

const W = window.__W || 1280;
const H = window.__H || 720;
document.body.style.cssText = 'margin:0;background:#000';
const root = document.createElement('div');
root.id = 'root';
root.style.cssText = 'position:relative;width:1920px;height:1080px;overflow:hidden;background:#020304;transform-origin:0 0;';
root.style.transform = `scale(${W / 1920})`;
const wrap = document.createElement('div');
wrap.id = 'gl'; // l'outil de capture cible #gl
wrap.style.cssText = `position:relative;width:${W}px;height:${H}px;overflow:hidden`;
const canvas = document.createElement('canvas');
canvas.width = W;
canvas.height = H;
canvas.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px';
const hudEl = document.createElement('div');
hudEl.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px;pointer-events:none';
root.append(canvas, hudEl);
wrap.append(root);
document.body.append(wrap);

const world = createWorld({ canvas, width: W, height: H, samples: 4, shadowType: 'basic' });
const hud = createHud({ root: hudEl, world, width: 1920, height: 1080 });

window.__shot = async (t, samples) => {
  const ex = window.__extra || {};
  const t0 = performance.now();
  world.pipe.renderFrame({ time: t, frameIndex: Math.round(t * 24), shutter: ex.shutter ?? 0, samples: samples || world.samplesFor(t, (window.__extra && window.__extra.base) || 5), evaluate: world.evaluate });
  world.evaluate(t);
  hud.update(t);
  const gl = world.pipe.renderer.getContext();
  world.pipe.renderer.setRenderTarget(null);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  return { ms: Math.round(performance.now() - t0), t };
};
