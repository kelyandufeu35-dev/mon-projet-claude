/* Banc d'essai : une animation, une caméra fixe, N instants — pour inspecter les poses. */
import { Showcase } from "./showcase.js";
const cv = document.getElementById("gl");
const cfg = window.TEST_VIEW || {};
const show = new Showcase({ canvas: cv, width: cfg.w || 960, height: cfg.h || 540, storyMode: false, name: "LÉO" });
show.crew.play(cfg.anim || "idle", { at: 0, blend: 0.01, opts: cfg.opts || {}, station: { x: 0, z: 0, yaw: 0 } });
show.crew.setYaw(cfg.rot ?? 0.785);
window.renderAt = (t) => {
  show.stage.setCamera({ target: cfg.target || [0, 0.95, 0], half: cfg.half || 1.3, yaw: cfg.yaw ?? 45 });
  show.update(t).render();
};
window.addEventListener("hf-seek", (e) => window.renderAt(e.detail.time));
window.renderAt(0);
