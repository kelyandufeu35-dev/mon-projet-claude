/* Démo interactive : tester chaque animation, régler position / échelle / orientation / vitesse, tourner la caméra isométrique. */
import { Showcase } from "./showcase.js";
import { buildStory } from "./story.js";
import { walkParams } from "../character/anims.js";
import { sstep, lerp, clamp } from "../core/util.js";

const $ = (s) => document.querySelector(s);
const ICONS = {
  idle: '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="3.2"/><path d="M6 21v-5a6 6 0 0 1 12 0v5z"/></svg>',
  walk: '<svg viewBox="0 0 24 24"><path d="M7 3c2 0 3 2 2.6 4.6-.4 2.4-1.8 3.4-3.2 3.2C5 10.6 4.4 9 4.6 7 4.8 4.8 5.8 3 7 3zM6 13.5c1.6.3 3 1.5 3 3.2V18c0 1.6-.9 3-2.4 3S4 19.6 4.4 17.8z"/><path d="M16.5 8c2 0 3 2 2.6 4.6-.3 2.2-1.6 3.2-3 3-1.4-.2-2-1.7-1.8-3.8.2-2.2 1.2-3.8 2.2-3.8zM15.8 17c1.6.3 3 1.4 3 3.1V21c0 .6-.4 1-1 1-1.6 0-3.1-1.3-3.1-3z"/></svg>',
  wave: '<svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-5a1.5 1.5 0 0 1 3 0v5m0-3.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6.5 7S5 18 4.6 14.5L4 11.5a1.5 1.5 0 0 1 3-.5l1 2.5"/></svg>',
  carry: '<svg viewBox="0 0 24 24"><rect x="2.5" y="14" width="19" height="3.2" rx="1.4"/><path d="M6 13a6 5.2 0 0 1 12 0z"/><rect x="5" y="9.4" width="14" height="1.6" rx=".8"/></svg>',
  work: '<svg viewBox="0 0 24 24"><path d="M4 11a8 6.5 0 0 1 16 0z"/><rect x="3" y="12.2" width="18" height="2.4" rx="1.2"/><path d="M5 15.8h14l-.9 2.9a2 2 0 0 1-2 1.5H7.9a2 2 0 0 1-2-1.5z"/></svg>',
  happy: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16l-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/></svg>',
};
const LABEL = { idle: "Idle", walk: "Walk", wave: "Wave", carry: "Carry", work: "Work", happy: "Happy" };
const DESC = {
  idle: "Il respire, change d'appui, cligne des yeux et regarde autour de lui.",
  walk: "Marche en boucle, sans glissement des pieds (cinématique inverse des jambes).",
  wave: "Il salue de la main et lance un « Salut ! » — la bouche suit le mouvement.",
  carry: "Il porte un plateau (burger, frites, boisson) avec les deux mains.",
  work: "Il assemble une commande : pain, steak, fromage, salade, frites, boisson.",
  happy: "Saut de joie, poings levés, yeux plissés et petit déhanché.",
};

async function main() {
  try { await Promise.race([Promise.all([document.fonts.load("900 40px Montserrat"), document.fonts.load("800 20px Montserrat")]), new Promise((r) => setTimeout(r, 1800))]); } catch (e) {}
  const cv = $("#gl");
  const show = new Showcase({ canvas: cv, width: innerWidth, height: innerHeight, pixelRatio: Math.min(1.75, devicePixelRatio || 1), storyMode: false, name: "LÉO" });
  const crew = show.crew, view = { yaw: 45, half: 2.55, follow: true, auto: false };
  /* thème : suit le réglage du lecteur (data-theme) ou la préférence système */
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const applyTheme = () => { const t = document.documentElement.dataset.theme; show.stage.setTheme(t === "dark" || (t !== "light" && mq.matches) ? "dark" : "light"); };
  applyTheme(); mq.addEventListener && mq.addEventListener("change", applyTheme); new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  /* glisser pour tourner, molette pour zoomer */
  let drag = null;
  cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, yaw: view.yaw }; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; });
  cv.addEventListener("pointermove", (e) => { if (drag) view.yaw = drag.yaw - (e.clientX - drag.x) * 0.35; });
  const end = () => { drag = null; cv.style.cursor = "grab"; }; cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  cv.addEventListener("wheel", (e) => { e.preventDefault(); const z = $("#zm"); z.value = clamp(+z.value + (e.deltaY < 0 ? 0.1 : -0.1), +z.min, +z.max); z.dispatchEvent(new Event("input")); }, { passive: false });
  cv.style.cursor = "grab"; cv.style.touchAction = "none";
  const st = { anim: "idle", speed: 1, moving: true, story: false, t: 0, storyT: 0, ctrl: null };
  let motions = [{ start: -1, fn: () => ({ x: 0, z: 0, yaw: 0 }) }];
  const motionAt = (t) => { let m = motions[0]; for (const k of motions) if (k.start <= t) m = k; return m.fn(t); };
  crew.setMotion((t) => motionAt(t));
  crew.setPosition(0, 0, 0.3); crew.play("idle", { at: 0, blend: 0.01 });
  show.cameraFn = null;
  let camTarget = [0, 0.9, 0.3];

  /* ---- démarrage d'une animation à partir de l'état courant ---- */
  function startAnim(name) {
    if (st.story) exitStory();
    const now = st.t, cur = motionAt(now);
    crew.segments = crew.segments.filter((s) => s.start <= now);
    motions = motions.filter((m) => m.start <= now);
    const speed = 1;
    let fn;
    const walking = name === "walk" || (name === "carry" && st.moving);
    if (walking) {
      const W = name === "walk" ? walkParams() : walkParams({ zmax: 0.2, T: 0.8 }), v = W.speed, p0 = { x: cur.x, z: cur.z }, phi0 = cur.yaw;
      let best = null;
      [1, -1].forEach((s) => { const R = 1.5, cx = p0.x + s * Math.cos(phi0) * R, cz = p0.z - s * Math.sin(phi0) * R; const d = Math.hypot(cx + crew.object.position.x * 0, cz); if (!best || d < best.d) best = { s, cx, cz, R, d }; });
      const { s, cx, cz, R } = best, w = v / R;
      fn = (t) => { const ph = phi0 + s * w * (t - now); return { x: cx - s * R * Math.cos(ph), z: cz + s * R * Math.sin(ph), yaw: ph }; };
    } else fn = () => ({ x: cur.x, z: cur.z, yaw: cur.yaw });
    motions.push({ start: now, fn });
    const opts = name === "carry" ? { moving: st.moving } : name === "wave" ? { hand: "R" } : {};
    crew.play(name, { at: now, blend: 0.35, speed, opts, station: { x: cur.x, z: cur.z, yaw: cur.yaw } });
    if (name === "wave") crew.play("idle", { at: now + 3.0, blend: 0.4 });
    st.anim = name; ui();
  }

  /* ---- démo guidée ---- */
  function enterStory() {
    st.story = true; st.storyT = 0;
    crew.segments.length = 0; motions = [{ start: -1, fn: () => ({ x: 0, z: 0, yaw: 0 }) }];
    crew.setPosition(0, 0, 0); crew.setYaw(0); crew.setScale(1); st.speed = 1;
    show.storyMode = true; show.events = []; show.serve.group.visible = true;
    st.storyInfo = buildStory(show); crew.setMotion(null); crew.setMotion(show.crew.motion); st.anim = "story"; ui();
  }
  function exitStory() {
    st.story = false; show.storyMode = false; show.events = []; show.serve.group.visible = false; show.cameraFn = null;
    crew.segments.length = 0; motions = [{ start: -1, fn: () => ({ x: 0, z: 0, yaw: 0 }) }]; crew.setMotion((t) => motionAt(t));
    st.t = 0; crew.play("idle", { at: 0, blend: 0.01 }); st.anim = "idle"; syncTransform(); ui();
  }

  /* ---- interface ---- */
  const dock = $("#anims");
  Object.keys(LABEL).forEach((id) => {
    const b = document.createElement("button"); b.className = "ab"; b.dataset.id = id; b.innerHTML = ICONS[id] + "<span>" + LABEL[id] + "</span>"; b.title = DESC[id];
    b.addEventListener("click", () => startAnim(id)); dock.appendChild(b);
  });
  dock.appendChild($("#story")); $("#story").style.display = "";
  $("#story").addEventListener("click", () => { if (st.story) exitStory(); else enterStory(); });
  function ui() {
    document.querySelectorAll(".ab").forEach((b) => b.classList.toggle("on", b.dataset.id === st.anim));
    $("#story").classList.toggle("on", st.story); $("#story span").textContent = st.story ? "Quitter la démo" : "Démo guidée";
    $("#desc").textContent = st.story ? "Démo guidée : le personnage enchaîne marche, salut, préparation, portage et joie, pendant que la caméra suit." : DESC[st.anim] || "";
    $("#moving").parentElement.style.display = st.anim === "carry" ? "flex" : "none";
  }
  const sl = (id, fmt, on) => { const el = $("#" + id), out = $("#" + id + "v"); const f = () => { out.textContent = fmt(+el.value); on(+el.value); }; el.addEventListener("input", f); f(); return el; };
  function syncTransform() {
    crew.setPosition(+$("#px").value, 0, +$("#pz").value); crew.setScale(+$("#sc").value); crew.setYaw((+$("#ry").value * Math.PI) / 180);
  }
  sl("px", (v) => v.toFixed(2), () => { if (!st.story) syncTransform(); });
  sl("pz", (v) => v.toFixed(2), () => { if (!st.story) syncTransform(); });
  sl("sc", (v) => v.toFixed(2) + "×", () => { if (!st.story) syncTransform(); });
  sl("ry", (v) => Math.round(v) + "°", () => { if (!st.story) syncTransform(); });
  sl("sp", (v) => v.toFixed(2) + "×", (v) => { st.speed = v; });
  sl("zm", (v) => v.toFixed(1), (v) => { view.half = 4.6 - v; });
  $("#moving").addEventListener("change", (e) => { st.moving = e.target.checked; if (st.anim === "carry") startAnim("carry"); });
  $("#follow").addEventListener("change", (e) => { view.follow = e.target.checked; });
  $("#auto").addEventListener("change", (e) => { view.auto = e.target.checked; });
  $("#rotL").addEventListener("click", () => { view.yaw -= 45; });
  $("#rotR").addEventListener("click", () => { view.yaw += 45; });
  $("#more").addEventListener("click", () => { const d = $("#dock"); d.classList.toggle("open"); $("#more").setAttribute("aria-expanded", d.classList.contains("open")); });
  $("#reset").addEventListener("click", () => { ["px", "pz", "ry"].forEach((id) => { $("#" + id).value = id === "pz" ? 0.3 : id === "ry" ? 45 : 0; $("#" + id).dispatchEvent(new Event("input")); }); $("#sc").value = 1; $("#sc").dispatchEvent(new Event("input")); $("#sp").value = 1; $("#sp").dispatchEvent(new Event("input")); view.yaw = 45; });
  $("#px").value = 0; $("#pz").value = 0.3; $("#ry").value = 45; syncTransform(); ui();

  /* ---- boucle de rendu : le temps d'animation avance de dt × vitesse ---- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (st.story) {
      st.storyT += dt * st.speed;
      if (st.storyT > st.storyInfo.duration + 0.5) exitStory();
      show.update(st.storyT).render();
    } else {
      st.t += dt * st.speed;
      if (view.auto) view.yaw += dt * 22;
      const m = motionAt(st.t); const o = crew.object;
      const px = o.position.x + m.x * o.scale.x, pz = o.position.z + m.z * o.scale.x;
      if (view.follow) { camTarget[0] += (px - camTarget[0]) * 0.06; camTarget[2] += (pz - camTarget[2]) * 0.06; } else { camTarget[0] += (0 - camTarget[0]) * 0.06; camTarget[2] += (0.3 - camTarget[2]) * 0.06; }
      const asp = innerWidth / innerHeight;
      show.stage.setCamera({ target: [camTarget[0], 0.9, camTarget[2]], half: Math.max(view.half, asp < 1 ? 1.75 / asp : 0), yaw: view.yaw });
      show.update(st.t).render();
    }
    requestAnimationFrame(frame);
  }
  addEventListener("resize", () => show.stage.resize(innerWidth, innerHeight, Math.min(1.75, devicePixelRatio || 1)));
  requestAnimationFrame(frame);
  window.__show = show; window.__state = st; document.body.classList.add("ready");
}
main();
