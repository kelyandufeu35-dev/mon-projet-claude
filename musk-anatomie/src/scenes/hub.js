// SCÈNE 1 — Le mystère de sa fortune (pièce sombre, compteur, milliards -> actions/immeubles/fusée/usine)
// + le hub (podium de Musk) qui revient dans la SCÈNE 7.
import * as THREE from "three";
import { Builder, applyBuild } from "../core/builder.js";
import { mat, colored, C } from "../core/palette.js";
import { labelTexture } from "../core/world.js";
import { Figure, POSES, blend, idle } from "../components/figure.js";
import { VoxelMorph, Shapes } from "../components/fx.js";
import { makeHubRoom, makePodium } from "../components/buildings.js";
import { makeShareBlock } from "../components/finance.js";
import { track, ease, inv, clamp, lerp, fmt } from "../core/util.js";
import { seg, SC, when, whenEnd } from "../timing.js";
import { POS } from "../layout.js";

export const T1 = {
  lightsOn: 0.55,
  counterA: 0.95,
  counterB: 5.0,
  coins: when("s1a", "mille milliards") - 0.2,
  toShares: when("s1a", "Mais cet argent") + 0.0,
  toTowers: when("s1a", "ne dort pas") + 0.55,
  toFactory: seg.s1b.start + 0.05,
  toBigShare: when("s1b", "Plongeons") - 0.35,
  plunge: when("s1b", "Plongeons") + 0.1,
  end: SC.s1.t1,
  finale: SC.s7.t0,
};

export function buildHub(ctx) {
  const { world, hud, facts } = ctx;
  const root = new THREE.Group();
  root.position.copy(POS.hub);
  world.add(root);

  // --- pièce + podium -----------------------------------------------------
  const room = makeHubRoom();
  root.add(room);
  const podium = makePodium(6.5);
  root.add(podium);

  // --- Musk (stylisé) -------------------------------------------------------
  const musk = new Figure({ scale: 2.7, shirt: 0x14161c, jacket: 0x0d0f14, pants: 0x1b2030, shoe: 0x090a0e });
  musk.place(0, 1.15, 0, 0.55);
  root.add(musk.root);

  // --- panneau-compteur (mur du fond) ----------------------------------------
  const cv = document.createElement("canvas");
  cv.width = 2048; cv.height = 470;
  const g = cv.getContext("2d");
  const ctex = new THREE.CanvasTexture(cv);
  ctex.colorSpace = THREE.SRGBColorSpace;
  ctex.anisotropy = 8;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(44, 10.1), new THREE.MeshBasicMaterial({ map: ctex }));
  panel.position.set(0, 15.0, -24.6);
  root.add(panel);
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(45.4, 11.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.blue).multiplyScalar(1.4) }));
  frame.position.set(0, 15.0, -24.66);
  root.add(frame);
  let lastTxt = "";
  const drawCounter = (val, glow) => {
    const txt = fmt.int(val).replace(/ /g, " ");
    const key = txt + ":" + glow.toFixed(2);
    if (key === lastTxt) return;
    lastTxt = key;
    g.fillStyle = "#050a16"; g.fillRect(0, 0, 2048, 470);
    const grad = g.createLinearGradient(0, 0, 0, 470);
    grad.addColorStop(0, "rgba(43,123,255,0.18)"); grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 2048, 470);
    g.textBaseline = "alphabetic";
    g.fillStyle = "#58b4ff"; g.font = '500 44px "JetBrains Mono"'; g.textAlign = "left";
    g.fillText("PATRIMOINE NET ESTIMÉ  ·  FORBES", 70, 82);
    g.textAlign = "right";
    g.fillStyle = "#ffd978"; g.shadowColor = "#ffb81c"; g.shadowBlur = 40 * glow + 8;
    g.font = '700 300px "Space Grotesk"';
    g.fillText(txt, 1500, 380);
    g.shadowBlur = 0;
    g.textAlign = "left";
    g.fillStyle = "#ffffff"; g.font = '700 120px "Space Grotesk"';
    g.fillText("Md$", 1540, 380);
    g.fillStyle = "rgba(255,255,255,0.55)"; g.font = '500 40px "JetBrains Mono"';
    g.fillText("milliards de dollars · estimation", 1540, 440);
    ctex.needsUpdate = true;
  };
  const target = facts.net_worth.headline.value_usd_billions;

  // --- projecteur (cône additif) ---------------------------------------------
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(11, 28, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fb2ff).multiplyScalar(0.7), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  cone.position.set(0, 15, 0);
  cone.rotation.x = Math.PI;
  root.add(cone);

  // --- les milliards : cubes qui se transforment ------------------------------
  const N = 640;
  const vs = 0.9;
  const swirl = Shapes.coinSwirl(N, { radius: 12, height: 13, size: 0.95 });
  const shares = [0, 1, 2, 3].flatMap((i) =>
    Shapes.place(Shapes.share(vs, { w: 8.1, h: 5.4 }), [Math.cos(i * 1.57 + 0.4) * 14, 1.2 + (i % 2) * 6, Math.sin(i * 1.57 + 0.4) * 14], -(i * 1.57 + 0.4) + Math.PI / 2)
  );
  const towers = [
    ...Shapes.place(Shapes.tower(vs, { w: 5.4, d: 5.4, h: 10 }), [-13, 0, -2], 0),
    ...Shapes.place(Shapes.tower(vs, { w: 5.4, d: 5.4, h: 13 }), [12, 0, -6], 0),
  ];
  const factory = Shapes.place(Shapes.factory(vs, { w: 14.4, d: 7.2, h: 3.6 }), [-9, 0, 10], 0.0);
  const rocket = Shapes.place(Shapes.rocket(vs, { radius: 1.8, height: 15 }), [11, 0, 7], 0);
  const big = Shapes.place(Shapes.share(vs, { w: 18, h: 10.8 }), [0, 3.5, 9], 0);
  const morph = new VoxelMorph(N, [swirl, shares, towers, [...factory, ...rocket], big], { seed: 4, arc: 5, spin: 2.6, material: new THREE.MeshLambertMaterial({ color: 0xffffff }) });
  root.add(morph.mesh);

  // la grande action texturée (remplace les voxels une fois formée)
  const bigShare = makeShareBlock("TESLA", { accent: "#58b4ff" });
  bigShare.scale.setScalar(2.8);
  bigShare.position.set(0, 9.4, 9);
  root.add(bigShare);

  // --- colonne « patrimoine net » (finale) --------------------------------------
  const column = new THREE.Group();
  const colBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 3.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.gold).multiplyScalar(1.5), transparent: true, opacity: 0.85 }));
  colBody.position.y = 0.5;
  column.add(colBody);
  const colHalo = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1, 4.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.gold).multiplyScalar(0.8), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  colHalo.position.y = 0.5;
  column.add(colHalo);
  column.position.set(0, 1.2, 0);
  root.add(column);
  const colH = track([[SC.s7.t0, 0], [when("s7b", "patrimoine net") - 0.5, 0, ease.io3], [when("s7b", "patrimoine net") + 1.4, 34]]);

  // --- caméra (clés propres à la scène) ------------------------------------------
  const cx = POS.hub.x, cz = POS.hub.z;
  const cam = [
    { t: 0, x: cx, y: 11, z: cz, az: 20, el: 22, zoom: 1.62, e: "io2" },
    { t: 2.8, x: cx, y: 11.5, z: cz, az: 24, el: 25, zoom: 1.52, e: "io3" },
    { t: T1.toShares + 0.2, x: cx, y: 11.5, z: cz, az: 30, el: 28, zoom: 1.24, e: "io2" },
    { t: T1.toFactory, x: cx, y: 10, z: cz + 1, az: 34, el: 29, zoom: 1.22, e: "io3" },
    { t: T1.toBigShare + 0.3, x: cx, y: 9.4, z: cz + 4, az: 40, el: 29, zoom: 1.5, e: "io4" },
    { t: T1.end - 0.1, x: cx, y: 9.4, z: cz + 9, az: 45, el: 29, zoom: 17, e: "io4" },
  ];

  // --- HUD -------------------------------------------------------------------------
  const nw = facts.net_worth;
  const mdFr = (v) => fmt.int(v).replace(/\u202f/g, " ");
  const dateFr = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  hud.card({
    id: "s1-source", cls: "pill card-left", t0: T1.counterB + 0.2, t1: T1.toFactory + 1.0, x: 56, y: 168, align: "left", enter: "right",
    html: `<b>≈ ${mdFr(nw.headline.value_usd_billions)} Md$</b> · <b>Forbes</b>, ${dateFr(nw.headline.as_of)}<br><span>estimation en temps réel, pas un solde</span><br><span>Bloomberg : ≈ ${mdFr(nw.bloomberg.value_usd_billions)} Md$ (${dateFr(nw.bloomberg.as_of)}) —<br>méthodes différentes, écart normal</span>`,
  });
  hud.card({
    id: "s1-not-cash", cls: "callout gold", t0: when("s1a", "ne dort pas") - 0.1, t1: T1.toFactory + 0.4, x: 56, y: 372, align: "left", enter: "right",
    html: `<span class="big">≠</span> un solde de compte<br><span class="small">une estimation de valeur, pas de l'argent disponible</span>`,
  });

  // --- mise à jour ---------------------------------------------------------------------
  const poseAwe = { ...POSES.awe };
  const update = (t) => {
    const inS1 = t < T1.end + 0.5;
    room.visible = true;
    // la pièce se retire pour le finale
    const wallP = t < T1.finale - 1 ? 1 : 1 - ease.io3(inv(T1.finale + 0.2, T1.finale + 2.0, t));
    applyBuild(room, wallP, { overlap: 0.2 });
    room.children.forEach((m) => { if (m.userData.layer === 0) m.visible = true; });

    // compteur
    if (inS1) {
      const kc = ease.expoOut(inv(T1.counterA, T1.counterB, t));
      const val = t < T1.counterA ? 0 : target * kc;
      drawCounter(val, ease.smooth(inv(T1.counterA, T1.counterB, t)));
      panel.visible = frame.visible = true;
    } else {
      panel.visible = frame.visible = false;
    }

    // voxels
    const sub = (a, b) => ease.io3(inv(a, b, t));
    const m = sub(T1.toShares, T1.toShares + 0.9) + sub(T1.toTowers, T1.toTowers + 0.9) + sub(T1.toFactory, T1.toFactory + 1.0) + sub(T1.toBigShare, T1.toBigShare + 1.0);
    morph.mesh.visible = inS1;
    if (inS1) {
      morph.mesh.rotation.y = 0.45 * t * (1 - ease.smooth(inv(T1.toShares - 0.4, T1.toShares + 0.6, t)));
      morph.update(m, [0, 0, 0], ease.out3(inv(T1.coins, T1.coins + 1.4, t)), t, 1);
    }
    const swap = ease.out3(inv(T1.toBigShare + 0.85, T1.toBigShare + 1.2, t));
    bigShare.visible = inS1 && swap > 0.01;
    bigShare.scale.setScalar(2.8 * (0.9 + 0.1 * swap) * (inS1 ? 1 : 0));
    if (swap > 0.99) morph.mesh.visible = false;
    cone.material.opacity = 0.1 * ease.out2(inv(T1.lightsOn, T1.lightsOn + 1.4, t)) * (inS1 ? 1 : 0.4);

    // Musk
    let pose;
    if (inS1) {
      const awe = ease.io3(inv(T1.coins - 0.3, T1.coins + 0.8, t));
      const point = ease.io3(inv(T1.toFactory + 0.2, T1.toFactory + 1.0, t));
      pose = blend(blend(POSES.stand, poseAwe, awe), POSES.point, point);
      Object.assign(pose, { bob: (idle(t).bob) });
      musk.root.rotation.y = lerp(0.55, 0.35, point);
    } else {
      const cheer = ease.io3(inv(when("s7c", "La richesse") + 0.6, when("s7c", "La richesse") + 1.6, t));
      pose = blend(POSES.presenting, POSES.cheer, cheer);
      musk.root.rotation.y = 0.55;
      pose.bob = idle(t).bob;
    }
    musk.apply(pose);
    podium.userData.ring.scale.setScalar(1 + 0.02 * Math.sin(t * 3));

    // colonne de patrimoine (finale)
    const h = colH(t);
    column.visible = !inS1 && h > 0.05;
    colBody.scale.y = Math.max(0.01, h);
    colBody.position.y = h / 2;
    colHalo.scale.y = Math.max(0.01, h);
    colHalo.position.y = h / 2;
  };

  world.register({ id: "hub", windows: [[0, T1.end], [T1.finale, SC.s7.t1]], pad: 1.2, root, update });
  return { cam, T: T1 };
}
