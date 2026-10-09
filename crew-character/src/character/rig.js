/* Construction du personnage « Équipier » : hiérarchie d'articulations + maillages 100 % procéduraux.
   Axes : +y haut, +z devant, +x côté gauche du personnage. Pieds au sol (y = 0). */
import * as THREE from "three";
import { createMaterials, nameTagTexture, COLORS } from "./materials.js";
import { mesh, sphere, rbox, cyl, limb, lathe, tube, archesMark, V3 } from "./builders.js";
import { Hand } from "./hand.js";
import { Face, HEAD, surfaceZ } from "./face.js";

export const DIM = {
  hipY: 0.76, hipX: 0.105, hipDrop: 0.02, thigh: 0.34, shin: 0.32, ankleH: 0.08,
  spineY: 0.03, torsoH: 0.5, shoulderX: 0.235, shoulderY: 0.43, upperArm: 0.29, foreArm: 0.27,
  neckY: 0.5, headY: 0.06, headC: 0.235,
};

export function buildCrew(opts = {}) {
  const M = opts.materials || createMaterials();
  const root = new THREE.Group(); root.name = "crew";
  const motion = new THREE.Group(); motion.name = "motion"; root.add(motion);   // transformation de déplacement (espace « scène »)
  const body = new THREE.Group(); body.name = "body"; motion.add(body);          // + décalages de pose (saut, pas en avant…)
  const J = { root, motion, body };

  /* ---------- bassin & jambes ---------- */
  const hips = new THREE.Group(); hips.position.y = DIM.hipY; body.add(hips); J.hips = hips;
  hips.add(sphere(0.158, M.pants, { pos: [0, -0.015, 0], scale: [1.12, 0.74, 0.86] }));
  J.leg = [1, -1].map((s) => {
    const hip = new THREE.Group(); hip.position.set(s * DIM.hipX, -DIM.hipDrop, 0); hips.add(hip);
    hip.add(limb(0.09, 0.076, DIM.thigh, M.pants));
    const knee = new THREE.Group(); knee.position.y = -DIM.thigh; hip.add(knee);
    knee.add(limb(0.074, 0.059, DIM.shin, M.pants));
    const ankle = new THREE.Group(); ankle.position.y = -DIM.shin; knee.add(ankle);
    ankle.add(limb(0.052, 0.048, 0.05, M.white, { pos: [0, 0.02, 0] })); // chaussette
    ankle.add(buildShoe(M));
    return { hip, knee, ankle, side: s };
  });

  /* ---------- tronc ---------- */
  const spine = new THREE.Group(); spine.position.y = DIM.spineY; hips.add(spine); J.spine = spine;
  const torso = lathe([[0.001, -0.025], [0.15, -0.025], [0.164, 0.0], [0.172, 0.08], [0.187, 0.18], [0.202, 0.3], [0.203, 0.38], [0.184, 0.44], [0.125, 0.472], [0.078, 0.488], [0.001, 0.495]], M.red, { scale: [1.12, 1, 0.8] }, 56);
  spine.add(torso);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.168, 0.015, 12, 56), M.ink); belt.rotation.x = Math.PI / 2; belt.scale.set(1.12, 0.8, 1); belt.position.y = 0.002; belt.castShadow = true; spine.add(belt);
  spine.add(rbox(0.05, 0.034, 0.014, 0.006, M.yellowShiny, { pos: [0, 0.002, 0.139] })); // boucle
  // col polo + patte de boutonnage
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.019, 12, 40), M.yellow); collar.rotation.x = Math.PI / 2; collar.scale.set(1.15, 0.95, 1); collar.position.y = 0.486; collar.castShadow = true; spine.add(collar);
  [1, -1].forEach((s) => { const f = rbox(0.062, 0.013, 0.05, 0.005, M.yellow, { pos: [s * 0.046, 0.489, 0.074], rot: [-0.42, -s * 0.5, s * 0.42] }); spine.add(f); });
  spine.add(rbox(0.024, 0.11, 0.006, 0.003, M.redDeep, { pos: [0, 0.395, 0.1535] }));
  [0.43, 0.37].forEach((y) => spine.add(sphere(0.0065, M.yellowShiny, { pos: [0, y, 0.158], cast: false })));
  // logo poitrine + badge nominatif
  const logo = archesMark(M.yellowShiny, 0.07); logo.position.set(-0.098, 0.33, 0.15); logo.rotation.y = -0.38; spine.add(logo);
  const tagMat = new THREE.MeshStandardMaterial({ map: nameTagTexture(opts.name || "LÉO"), roughness: 0.5 });
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.036, 0.006), [M.white, M.white, M.white, M.white, tagMat, M.white]); tag.position.set(0.098, 0.325, 0.148); tag.rotation.y = 0.34; tag.castShadow = true; spine.add(tag);

  /* ---------- bras ---------- */
  J.arm = [1, -1].map((s) => {
    const sh = new THREE.Group(); sh.position.set(s * DIM.shoulderX, DIM.shoulderY, 0); spine.add(sh);
    sh.add(sphere(0.06, M.red, { scale: [1, 1.05, 1] }));
    sh.add(limb(0.052, 0.046, DIM.upperArm, M.skin));
    sh.add(limb(0.062, 0.06, 0.15, M.red));                                    // manche courte
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.0615, 0.0125, 10, 32), M.yellow); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.158; cuff.castShadow = true; sh.add(cuff);
    const el = new THREE.Group(); el.position.y = -DIM.upperArm; sh.add(el);
    el.add(sphere(0.043, M.skin));
    el.add(limb(0.045, 0.036, DIM.foreArm, M.skin));
    const wr = new THREE.Group(); wr.position.y = -DIM.foreArm; el.add(wr);
    wr.add(sphere(0.031, M.skin));
    const hand = new Hand(M.skin, s); wr.add(hand.group);
    return { sh, el, wr, hand, side: s };
  });

  /* ---------- cou, tête ---------- */
  const neck = new THREE.Group(); neck.position.y = DIM.neckY; spine.add(neck); J.neck = neck;
  neck.add(cyl(0.054, 0.06, 0.1, M.skin, { pos: [0, 0.035, 0] }));
  const head = new THREE.Group(); head.position.y = DIM.headY; head.scale.setScalar(1.2); neck.add(head); J.head = head;
  const skull = new THREE.Group(); skull.position.y = DIM.headC; head.add(skull); J.skull = skull;   // centre du crâne
  const cranium = sphere(1, M.skin, { scale: [HEAD.ax, HEAD.ay, HEAD.az] }); cranium.geometry = new THREE.SphereGeometry(1, 64, 44); skull.add(cranium);
  J.face = new Face(skull, M);
  buildHair(skull, M); buildCap(skull, M);

  /* ---------- ancres (accessoires) ---------- */
  J.anchor = { carry: new THREE.Object3D() };
  J.anchor.carry.position.set(0, 0.17, 0.38); spine.add(J.anchor.carry);
  J.torso = spine;
  return { J, M, group: root };
}

function buildShoe(M) {
  const g = new THREE.Group();
  g.add(rbox(0.152, 0.044, 0.31, 0.02, M.sole, { pos: [0, -0.058, 0.075] }));                   // semelle
  g.add(sphere(0.088, M.shoe, { pos: [0, -0.012, 0.062], scale: [0.9, 0.78, 1.62] }));          // tige
  g.add(sphere(0.072, M.redShiny, { pos: [0, -0.04, 0.165], scale: [0.95, 0.62, 1.12] }));       // bout rouge
  g.add(rbox(0.07, 0.04, 0.016, 0.006, M.redShiny, { pos: [0, 0.0, -0.058], rot: [0.25, 0, 0] })); // talon
  for (let i = 0; i < 3; i++) g.add(cyl(0.0058, 0.0058, 0.074, M.yellowShiny, { pos: [0, 0.052 - i * 0.002, 0.012 + i * 0.037], rot: [0.1, 0, Math.PI / 2] }, 14));
  g.add(rbox(0.06, 0.05, 0.012, 0.005, M.white, { pos: [0, 0.052, -0.022], rot: [0.35, 0, 0] }));  // languette
  return g;
}

function buildHair(skull, M) {
  const r = 0.282;
  const geo = new THREE.SphereGeometry(r, 48, 32, 2.74, 3.96, 0, 1.98);
  const hair = new THREE.Mesh(geo, M.hair); hair.scale.set((HEAD.ax / r) * 1.04, (HEAD.ay / r) * 1.05, (HEAD.az / r) * 1.05); hair.castShadow = true; skull.add(hair);
  [1, -1].forEach((s) => skull.add(rbox(0.03, 0.1, 0.034, 0.012, M.hair, { pos: [s * 0.252, 0.015, 0.082], rot: [0, s * 0.16, s * 0.04] })));
}

function buildCap(skull, M) {
  const cap = new THREE.Group(); cap.position.set(0, 0.058, -0.02); cap.rotation.x = -0.3; skull.add(cap);
  const R = 0.292, TH = 1.24;
  const crown = new THREE.Mesh(new THREE.SphereGeometry(R, 56, 32, 0, Math.PI * 2, 0, TH), M.red); crown.scale.set(1, 0.95, 0.99); crown.castShadow = true; cap.add(crown);
  const y0 = R * Math.cos(TH) * 0.95, rr = R * Math.sin(TH);
  const band = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.0095, 10, 64), M.yellow); band.rotation.x = Math.PI / 2; band.position.y = y0; band.scale.set(1, 0.99, 1); band.castShadow = true; cap.add(band);
  cap.add(sphere(0.02, M.yellowShiny, { pos: [0, R * 0.95 + 0.002, 0] }));
  for (let k = 0; k < 6; k++) { // coutures des panneaux
    const ph = (k * Math.PI) / 3 + 0.5236, pts = [];
    for (let i = 0; i <= 14; i++) { const th = 0.06 + (TH - 0.07) * (i / 14); pts.push([R * 1.003 * Math.sin(th) * Math.cos(ph), R * 0.95 * 1.003 * Math.cos(th), R * 0.99 * 1.003 * Math.sin(th) * Math.sin(ph)]); }
    cap.add(tube(pts, 0.0032, M.redDeep, { seg: 20, radial: 5, caps: false }));
  }
  // visière courbée (courte et légèrement relevée pour dégager le visage en vue isométrique)
  const VL = 0.135, VW = 0.145, bend = (x, z) => -0.5 * z * z - 0.75 * x * x * Math.min(1, z / VL);
  const sh = new THREE.Shape(); sh.moveTo(-VW, 0); sh.bezierCurveTo(-VW - 0.006, VL * 0.68, -VW * 0.55, VL, 0, VL); sh.bezierCurveTo(VW * 0.55, VL, VW + 0.006, VL * 0.68, VW, 0); sh.lineTo(-VW, 0);
  const vg = new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 20 });
  vg.rotateX(Math.PI / 2);
  const p = vg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + bend(p.getX(i), p.getZ(i)));
  vg.computeVertexNormals();
  const visor = new THREE.Mesh(vg, M.redShiny); visor.position.set(0, y0 + 0.022, R * 0.97 * Math.sin(TH) - 0.03); visor.rotation.x = -0.2; visor.castShadow = true; cap.add(visor);
  const edge = []; for (let i = 0; i <= 20; i++) { const a = Math.PI - (Math.PI * i) / 20; const x = Math.cos(a) * (VW + 0.003), z = Math.sin(a) * (VL + 0.003); edge.push([x, bend(x, z) - 0.002, z]); }
  const lis = tube(edge, 0.0048, M.yellowShiny, { seg: 40, radial: 6 }); lis.position.copy(visor.position); lis.rotation.copy(visor.rotation); cap.add(lis);
  // logo sur la face avant
  const th = 0.8, n = V3(0, Math.cos(th) * 0.95, Math.sin(th) * 0.99).normalize();
  const mark = archesMark(M.yellowShiny, 0.135); mark.position.set(0, R * 0.95 * Math.cos(th) + n.y * 0.004, R * 0.99 * Math.sin(th) + n.z * 0.004); mark.rotation.set(-Math.atan2(n.y, n.z), 0, 0); cap.add(mark);
}
