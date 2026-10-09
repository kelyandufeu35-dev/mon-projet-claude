/* Point d'entrée Hyperframes : rend la scène 3D à l'instant demandé (événement hf-seek) – déterministe. */
import { Showcase } from "./showcase.js";
import { buildStory } from "./story.js";

const cv = document.getElementById("gl");
const show = new Showcase({ canvas: cv, width: 1920, height: 1080, storyMode: true, name: "LÉO" });
const story = buildStory(show);
window.STORY = story; window.SHOW = show;
let lastT = -1;
/* hf-seek et la timeline GSAP appellent tous deux renderAt : on ne rend qu'une fois par instant */
window.renderAt = (t) => { if (Math.abs(t - lastT) < 1e-4) return; lastT = t; show.update(t).render(); if (window.HUDUPDATE) window.HUDUPDATE(t); };
window.addEventListener("hf-seek", (e) => window.renderAt(e.detail.time));
window.renderAt(0);
