/* Showcase : assemble la scène (stage + personnage + accessoires) et rend l'état à l'instant t (fonction pure de t).
   Deux usages : « story » (vidéo scénarisée, Hyperframes) et « free » (démo interactive avec commandes). */
import * as THREE from "three";
import { createStage } from "../stage/stage.js";
import { Crew } from "../character/crew.js";
import { createMaterials } from "../character/materials.js";
import { makeTray, makeBurgerParts, makeFries, makeCup, PrepCounter, ServeCounter } from "../props/props.js";
import { ITEMS, itemState, HOLD, TOTAL, TRAY_HOME, TOP } from "../props/work.js";
import { sstep, prog, clamp, lerp } from "../core/util.js";

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

export class Showcase {
  constructor({ canvas, width = 1920, height = 1080, pixelRatio = 1, name = "LÉO", storyMode = false }) {
    this.storyMode = storyMode;
    this.stage = createStage({ canvas, width, height, pixelRatio });
    const M = (this.M = createMaterials());
    this.crew = new Crew({ name, materials: M });
    const scene = this.stage.scene; scene.add(this.crew.object);
    this.prep = new PrepCounter(M); this.crew.object.add(this.prep.group);          // le comptoir vit dans le repère du personnage
    this.serve = new ServeCounter(M); this.serve.group.visible = storyMode; scene.add(this.serve.group);
    this.tray = makeTray(M); this.prep.group.add(this.tray);
    const parts = makeBurgerParts(M);
    this.items = { bunB: parts.bunB.clone(), patty: parts.patty.clone(), cheese: parts.cheese.clone(), lettuce: parts.lettuce.clone(), topBun: parts.topBun.clone(), fries: makeFries(M), cup: makeCup(M) };
    Object.values(this.items).forEach((o) => this.prep.group.add(o));
    this.events = []; this.station = { x: 0, z: 0, yaw: 0 }; this.cameraFn = null; this.propVis = { prep: 1 };
    this.prep.group.visible = false; this.tray.visible = false;
    this.stage.world.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  }

  /* --- accessoires --- */
  placeStation(s) { this.station = s; this.prep.group.position.set(s.x, 0, s.z); this.prep.group.rotation.y = s.yaw; }
  setParent(obj, parent, x, y, z) { if (obj.parent !== parent) parent.add(obj); obj.position.set(x, y, z); }

  updateProps(t) {
    const c = this.crew, segs = c.segments, pose = c.lastPose;
    let wi = -1; for (let i = 0; i < segs.length; i++) if (segs[i].anim === "work" && segs[i].start <= t) wi = i;
    const ws = wi >= 0 ? segs[wi] : null, nextStart = ws && wi + 1 < segs.length ? segs[wi + 1].start : Infinity;
    // visibilité du comptoir
    let cw = 0;
    if (this.storyMode) cw = sstep(prog(t, 0.15, 0.9));
    else if (ws) { cw = sstep(prog(t, ws.start - 0.3, ws.start + 0.1)); if (t > nextStart) cw *= 1 - sstep(prog(t, nextStart + 0.4, nextStart + 0.9)); if (ws.station) this.placeStation(ws.station); }
    this.prep.group.visible = cw > 0.002; this.prep.group.scale.setScalar(Math.max(0.001, cw));
    this.serve.group.scale.setScalar(this.storyMode ? Math.max(0.001, sstep(prog(t, 0.3, 1.1))) : 1);
    // temps de travail
    let tau = this.storyMode && segs.some((x) => x.anim === "work") ? 0 : HOLD + 0.3, loop = false;
    if (ws) {
      const raw = Math.max(0, (t - ws.start) * ws.speed);
      if (t < nextStart && ws.opts.loop !== false && !this.storyMode) { tau = raw % TOTAL; loop = true; } else tau = Math.min(raw, HOLD + 0.3);
    }
    // plateau : maison / porté / posé
    const tray = this.tray, carryW = pose.prop.tray;
    let trayMode = "home", ev = null;
    if (this.storyMode) { trayMode = this.trayStory(t); } else if (carryW > 0.01) trayMode = "carry";
    if (trayMode === "home") { this.setParent(tray, this.prep.group, TRAY_HOME[0], TOP, TRAY_HOME[1]); tray.rotation.set(0, 0, 0); tray.scale.setScalar(1); tray.visible = this.prep.group.visible; }
    else if (trayMode === "carry") {
      c.trayWorld(_v, _q); _e.setFromQuaternion(_q, "YXZ"); _q.setFromEuler(new THREE.Euler(0, _e.y, 0));
      if (tray.parent !== this.stage.scene) this.stage.scene.add(tray);
      const k = c.scale; tray.position.copy(_v); tray.quaternion.copy(_q); tray.scale.setScalar(k * (this.storyMode ? 1 : Math.max(0.001, sstep(carryW)))); tray.visible = true;
    }
    // objets du plateau
    const list = Object.keys(ITEMS);
    list.forEach((n) => {
      const o = this.items[n], st = itemState(n, tau);
      const pop = loop ? sstep(prog(tau, 0, 0.3)) * (1 - sstep(prog(tau, TOTAL - 0.5, TOTAL))) : 1;
      let target, lp;
      if (st.onTray) { target = tray; lp = [st.pos[0] - TRAY_HOME[0], st.pos[1] - TOP, st.pos[2] - TRAY_HOME[1]]; } else { target = this.prep.group; lp = st.pos; }
      this.setParent(o, target, lp[0], lp[1], lp[2]);
      o.scale.set(1, st.squash * (n === "fries" || n === "cup" ? 1 : 1), 1).multiplyScalar(Math.max(0.001, pop));
      o.rotation.y = n === "cheese" ? 0.2 : n === "lettuce" ? 0.9 : n === "fries" ? 0.0 : n === "cup" ? 0.5 : 0;
      o.visible = true;
    });
  }

  /* événements scénarisés du plateau (mode story) : grab → porté → release → posé */
  trayStory(t) {
    const tray = this.tray, scene = this.stage.scene, c = this.crew;
    const g = this.events.find((e) => e.kind === "grab"), r = this.events.find((e) => e.kind === "release");
    if (!g || t < g.t) return "home";
    c.trayWorld(_v, _q); _e.setFromQuaternion(_q, "YXZ"); const qa = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, _e.y, 0)), pa = _v.clone();
    if (t < g.t + g.dur) { // du comptoir vers les mains
      const u = sstep((t - g.t) / g.dur); this.prep.group.updateMatrixWorld(true);
      const home = new THREE.Vector3(TRAY_HOME[0], TOP, TRAY_HOME[1]); this.prep.group.localToWorld(home);
      const ey = new THREE.Euler().setFromQuaternion(this.prep.group.getWorldQuaternion(new THREE.Quaternion()), "YXZ").y, qh = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ey, 0));
      if (tray.parent !== scene) scene.add(tray);
      tray.position.lerpVectors(home, pa, u); tray.position.y += 0.12 * Math.sin(Math.PI * u); tray.quaternion.slerpQuaternions(qh, qa, u); tray.scale.setScalar(1); tray.visible = true; return "free";
    }
    if (!r || t < r.t) { if (tray.parent !== scene) scene.add(tray); tray.position.copy(pa); tray.quaternion.copy(qa); tray.scale.setScalar(1); tray.visible = true; return "free"; }
    // dépose sur le comptoir de retrait
    const dest = new THREE.Vector3(r.to[0], r.to[1], r.to[2]), qd = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r.to[3] || 0, 0));
    if (tray.parent !== scene) scene.add(tray);
    if (t < r.t + r.dur) { const u = sstep((t - r.t) / r.dur); tray.position.lerpVectors(pa, dest, u); tray.quaternion.slerpQuaternions(qa, qd, u); } else { tray.position.copy(dest); tray.quaternion.copy(qd); }
    tray.scale.setScalar(1); tray.visible = true; return "free";
  }

  update(t) {
    this.crew.update(t);
    this.updateProps(t);
    if (this.cameraFn) this.stage.setCamera(this.cameraFn(t));
    return this;
  }
  render() { this.stage.render(); }
}
