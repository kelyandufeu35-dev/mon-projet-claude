// Point d'entrée : construit le monde 3D, enregistre la timeline et rend l'image exacte à chaque « hf-seek ».
import { World, cameraPath } from "./core/world.js";
import { Hud, Subtitles, veil } from "./core/hud.js";
import { track, ease } from "./core/util.js";
import { SC, DURATION, seg, when } from "./timing.js";
import facts from "../data/facts.json";
import { buildGlobalHud, subtitleSegments } from "./hud-global.js";
import { buildHub } from "./scenes/hub.js";
import { buildTesla } from "./scenes/tesla.js";
import { buildSpacex } from "./scenes/spacex.js";
import { buildBourse } from "./scenes/bourse.js";
import { buildBank } from "./scenes/bank.js";
import { buildFinale } from "./scenes/finale.js";

async function boot() {
  await Promise.all([
    document.fonts.load('700 64px "Space Grotesk"'),
    document.fonts.load('500 40px "Space Grotesk"'),
    document.fonts.load('500 40px "JetBrains Mono"'),
    document.fonts.load('700 40px "JetBrains Mono"'),
    document.fonts.load('400 32px "Inter"'),
    document.fonts.load('600 32px "Inter"'),
    document.fonts.load('800 32px "Inter"'),
  ]);
  const world = new World(document.getElementById("stage"));
  const hud = new Hud(document.getElementById("hud"), world);
  const ctx = { world, hud, facts };

  buildGlobalHud(ctx);
  const modules = [buildHub(ctx), buildTesla(ctx), buildSpacex(ctx), buildBourse(ctx), buildBank(ctx), buildFinale(ctx)];

  const camKeys = modules.flatMap((m) => m.cam || []).sort((a, b) => a.t - b.t);
  const camPath = cameraPath(camKeys);
  const subs = new Subtitles(document.getElementById("sub"), subtitleSegments());
  const veilEl = document.getElementById("veil");
  const fadeEl = document.getElementById("fade");

  // ambiance lumineuse globale
  const L = 0.55;
  const hemi = track([[0, 0.1], [L, 0.1], [L + 1.6, 0.5, ease.out2], [DURATION, 0.5]]);
  const key = track([[0, 0.2], [L, 0.2], [L + 1.6, 2.6, ease.out2], [DURATION, 2.6]]);
  const rim = track([[0, 0.0], [L + 0.4, 0.0], [L + 2.4, 1.2, ease.out2], [DURATION, 1.2]]);
  const gold = track([[0, 0], [L + 0.4, 0], [L + 2.0, 260, ease.out2], [SC.s1.t1, 260], [SC.s1.t1 + 1, 0], [DURATION, 0]]);

  const veils = [
    { t: SC.s1.t1 + 0.1, up: 0.5, hold: 0.1, down: 0.8 },
    { t: SC.s6.t0 + 0.05, up: 0.22, hold: 0.04, down: 0.5 },
  ];

  const tl = gsap.timeline({ paused: true });

  function renderAt(t) {
    Object.assign(world.camState, camPath(t));
    Object.assign(world.mood, { hemi: hemi(t), key: key(t), rim: rim(t), fillGold: gold(t), fillBlue: 0 });
    world.render(t);
    hud.update(t);
    subs.update(t);
    veil(veilEl, veils, t);
    fadeEl.style.opacity = String(Math.max(1 - ease.io2(Math.min(1, t / 0.6)), ease.io2(Math.min(1, Math.max(0, (t - (DURATION - 0.7)) / 0.7)))));
  }
  window.addEventListener("hf-seek", (e) => {
    tl.totalTime(e.detail.time, true);
    renderAt(e.detail.time);
  });
  renderAt(window.__hfThreeTime || 0);
  window.MuskDoc.world = world;
  window.MuskDoc.renderAt = renderAt;
  window.MuskDoc.ready = true;
  return tl;
}

window.MuskDoc = { boot };
