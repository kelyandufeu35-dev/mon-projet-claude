import * as THREE from 'three';
import { C, LINK } from '../engine/palette.js';
import { M, std } from '../engine/materials.js';
import { rbox, cyl } from '../components/furniture.js';
import { makeTower, makeArches, makeMiniRestaurant } from '../components/building.js';
import { makeCharacter, Actor, OUTFIT } from '../components/character.js';
import { isLand } from '../data/landmask.js';
import { seg, smooth, smoother, easeOutBack, easeOutCubic, easeInOutCubic, clamp, lerp, DEG } from '../util/math.js';

/* =========================================================================
 * GLOBE — la place se déplie en carte azimutale en points, puis se replie en sphère.
 * Le siège devient l'épingle posée sur le globe. Marchés = structures différentes (non uniformes).
 * ========================================================================= */
export const GLOBE = { R: 15, CY: 19.5, RD: 33, N: 9000 };
export const G_T = {
  collapse0: 29.6, plazaOut0: 31.0, plazaOut1: 32.4,
  dots0: 31.1, dots1: 32.6,
  morph0: 32.5, morph1: 35.2,
  hq0: 32.3, hq1: 34.7,
};

const ll = (lon, lat, out = new THREE.Vector3()) => {
  const a = lat * DEG, b = lon * DEG;
  return out.set(Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b));
};

/** Marchés illustratifs. type A = exploité, B = licencié de développement, C = société affiliée. */
export const MARKETS = [
  { id: 'us', name: 'États-Unis', note: 'Marché exploité', type: 'A', lon: -106, lat: 32, t: 36.0 },
  { id: 'latam', name: 'Amérique latine', note: 'Licencié de développement', type: 'B', lon: -55, lat: -13, t: 37.5 },
  { id: 'fr', name: 'France', note: 'Marché exploité', type: 'A', lon: 2.4, lat: 46.6, t: 38.9 },
  { id: 'de', name: 'Allemagne', note: 'Marché exploité', type: 'A', lon: 10.3, lat: 51.2, t: 39.2 },
  { id: 'me', name: 'Moyen-Orient', note: 'Licencié de développement', type: 'B', lon: 45, lat: 25, t: 40.2 },
  { id: 'cn', name: 'Chine', note: 'Société affiliée', type: 'C', lon: 104, lat: 34, t: 41.2 },
  { id: 'jp', name: 'Japon', note: 'Société affiliée', type: 'C', lon: 138, lat: 36, t: 41.6 },
  { id: 'au', name: 'Australie', note: 'Marché exploité', type: 'A', lon: 134, lat: -25, t: 42.4 },
];
const TYPE_STYLE = {
  A: { color: C.red, link: 'hierarchie', accent: C.red },
  B: { color: C.yellow, link: 'contrat', accent: C.yellow },
  C: { color: 0xffffff, link: 'gouvernance', accent: C.white },
};
// Rotations de visée : région au centre de l'écran à l'instant t.
const FACE_KEYS = [
  { t: 35.4, lon: -95, lat: 28 }, { t: 36.4, lon: -95, lat: 28 },
  { t: 37.9, lon: -62, lat: 0 }, { t: 38.4, lon: -62, lat: 0 },
  { t: 40.0, lon: 18, lat: 38 }, { t: 40.3, lon: 18, lat: 38 },
  { t: 41.3, lon: 80, lat: 32 }, { t: 41.7, lon: 80, lat: 32 },
  { t: 42.8, lon: 125, lat: 5 }, { t: 43.0, lon: 125, lat: 5 },
  { t: 44.6, lon: -92, lat: 34 },
];

function greatArc(a, b, R, lift) {
  const pts = [];
  const ang = a.angleTo(b);
  const n = 48, axis = new THREE.Vector3().crossVectors(a, b).normalize();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const v = a.clone().applyAxisAngle(axis, ang * u);
    pts.push(v.multiplyScalar(R * (1 + lift * Math.sin(Math.PI * u))));
  }
  return new THREE.CatmullRomCurve3(pts);
}

function makeMarker(m) {
  const g = new THREE.Group();
  const st = TYPE_STYLE[m.type];
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.12, 28), std(0x2d3037, { rough: 0.8 })); pad.position.y = 0.04; pad.receiveShadow = true; g.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.72, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.9 }));
  ring.position.y = 0.11; g.add(ring);
  const body = new THREE.Group(); g.add(body);
  let anim = () => {};
  if (m.type === 'A') {
    const tw = makeTower({ w: 1.15, d: 1.15, floors: 6, fh: 0.46, wall: C.white, glass: C.glass, seed: 41, fins: C.red, cap: C.grey2, lit: 0.7 });
    tw.group.position.set(-0.45, 0.1, -0.25); body.add(tw.group);
    const r1 = makeMiniRestaurant({ w: 0.95, d: 0.62, h: 0.34, signSize: 0.3 }); r1.position.set(0.55, 0.1, 0.5); body.add(r1);
    const r2 = makeMiniRestaurant({ w: 0.85, d: 0.58, h: 0.32, signSize: 0.28 }); r2.position.set(-0.7, 0.1, 0.62); r2.rotation.y = 0.2; body.add(r2);
    anim = (p, t) => { tw.build(clamp((p - 0.1) / 0.9)); };
  } else if (m.type === 'B') {
    const hall = rbox(1.8, 0.62, 1.0, M.white(), { r: 0.06 }); hall.position.set(-0.1, 0.1, -0.3); body.add(hall);
    const roofB = rbox(1.9, 0.09, 1.1, M.yellow(), { r: 0.03 }); roofB.position.set(-0.1, 0.72, -0.3); body.add(roofB);
    const win = rbox(1.4, 0.3, 0.03, M.glass(), { r: 0.01 }); win.position.set(-0.1, 0.25, 0.22); body.add(win);
    const sh = makeMiniRestaurant({ w: 0.9, d: 0.6, h: 0.32, signSize: 0.3 }); sh.position.set(0.5, 0.1, 0.78); body.add(sh);
    const doc = new THREE.Group();
    const sheet = rbox(0.62, 0.04, 0.8, M.white(), { r: 0.015 }); doc.add(sheet);
    for (let i = 0; i < 3; i++) { const ln = rbox(0.4, 0.045, 0.04, M.grey2(), { r: 0.005 }); ln.position.set(0, 0.01, -0.22 + i * 0.14); doc.add(ln); }
    const seal = cyl(0.12, 0.12, 0.05, M.yellow(), 16); seal.position.set(0.14, 0.01, 0.26); doc.add(seal);
    doc.position.set(-0.1, 1.5, -0.3); doc.rotation.x = -0.25; body.add(doc);
    anim = (p, t) => { doc.position.y = 1.5 + Math.sin(t * 2) * 0.08; doc.rotation.y = t * 0.8; };
  } else {
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 2.3, 28), std(C.glass, { rough: 0.12, metal: 0.4, emissive: 0x6f8396, emI: 0.35 })); tw.position.set(-0.4, 1.25, -0.2); tw.castShadow = true; body.add(tw);
    for (let i = 0; i < 4; i++) { const f = cyl(0.64, 0.64, 0.06, M.white(), 28); f.position.set(-0.4, 0.4 + i * 0.55, -0.2); body.add(f); }
    const cap = cyl(0.66, 0.66, 0.12, M.grey1(), 28); cap.position.set(-0.4, 2.4, -0.2); body.add(cap);
    // camembert « participation »
    const pie = new THREE.Group();
    const base = cyl(0.42, 0.42, 0.08, M.grey1(), 32); pie.add(base);
    const sector = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.1, 24, 1, false, 0, Math.PI * 0.8), M.red()); sector.position.y = 0.04; pie.add(sector);
    pie.position.set(0.85, 1.2, 0.3); pie.rotation.x = Math.PI / 2 * 0.0 - 0.9; body.add(pie);
    const rs = makeMiniRestaurant({ w: 0.9, d: 0.6, h: 0.32, signSize: 0.3 }); rs.position.set(0.55, 0.1, 0.85); body.add(rs);
    anim = (p, t) => { pie.rotation.y = t * 0.9; };
  }
  // équipe locale
  const team = [];
  const nTeam = m.type === 'B' ? 2 : 3;
  for (let i = 0; i < nTeam; i++) {
    const ch = makeCharacter({ ...OUTFIT.worker(i + (m.lon | 0)), scale: 0.5 });
    body.add(ch.root);
    const bx = -0.2 + i * 0.55, bz = 1.35;
    team.push(new Actor(ch, {
      path: [{ t: 0, x: bx, z: bz, y: 0.1 }, { t: 40 + i, x: bx, z: bz }, { t: 41 + i, x: bx + 0.5, z: bz - 0.1 }, { t: 60, x: bx + 0.5, z: bz - 0.1 }],
      face: [{ t: 0, a: 0.4 }], acts: [{ t0: 0, t1: 999, act: i % 2 ? 'talk' : 'idle' }], appear: { t: m.t + 0.9 + i * 0.15, dur: 0.5 }, phase: i * 1.7,
    }));
  }
  return { group: g, body, ring, pad, anim, team };
}

export function buildGlobe(ctx) {
  const { scene, links, labels } = ctx;
  const { R, CY, RD, N } = GLOBE;
  const root = new THREE.Group(); root.name = 'globe'; scene.add(root);
  const spin = new THREE.Group(); spin.position.set(0, CY, 0); root.add(spin);

  // Orientation de projection : HQ (Chicago) au pôle de la carte azimutale.
  const hGeo = ll(-87.6, 41.9);
  const Q = new THREE.Quaternion().setFromUnitVectors(hGeo, new THREE.Vector3(0, 1, 0));
  const Qinv = Q.clone().invert();

  // Points de terre (réseau de Fibonacci)
  const dotsGeo = []; // {v (géo), rho, F (local), nF (local)}
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N, rad = Math.sqrt(1 - y * y), th = i * ga;
    const lat = Math.asin(y) / DEG, lon = ((th / DEG + 180) % 360 + 360) % 360 - 180;
    if (!isLand(lon, lat)) continue;
    const v = new THREE.Vector3(rad * Math.cos(th), y, -rad * Math.sin(th)); // cohérent avec ll()
    const vp = v.clone().applyQuaternion(Q);
    const theta = Math.acos(clamp(vp.y, -1, 1)), phi = Math.atan2(vp.z, vp.x);
    const rho = theta / Math.PI;
    const Fw = new THREE.Vector3(rho * RD * Math.cos(phi), 0.06, rho * RD * Math.sin(phi));
    const F = Fw.clone().sub(new THREE.Vector3(0, CY, 0)).applyQuaternion(Qinv);
    dotsGeo.push({ v, rho, F, phi });
  }
  const count = dotsGeo.length;
  const dotG = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 6).translate(0, 0.05, 0);
  const dotM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.05, emissive: 0x33363e, emissiveIntensity: 0.6 });
  const dots = new THREE.InstancedMesh(dotG, dotM, count);
  dots.castShadow = false; dots.receiveShadow = false; dots.frustumCulled = false;
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // dégradé léger blanc → gris chaud pour du relief
    const k = 0.84 + 0.16 * Math.sin(i * 1.7);
    col.setRGB(k, k * 0.985, k * 0.95); dots.setColorAt(i, col);
  }
  spin.add(dots);
  const up = new THREE.Vector3(0, 1, 0);
  const tmpP = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpM = new THREE.Matrix4();
  const flatN = up.clone().applyQuaternion(Qinv);
  let lastKey = null;

  // Sphère océan + halo atmosphérique
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 64, 48), new THREE.MeshStandardMaterial({ color: 0x2a2d35, roughness: 0.85, metalness: 0.1, emissive: 0x15171c, emissiveIntensity: 0.8 }));
  ocean.castShadow = true; ocean.receiveShadow = true; spin.add(ocean);
  const atmos = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 48, 36), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { c: { value: new THREE.Color(C.yellow) } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; uniform vec3 c; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), vV)), 3.2); gl_FragColor = vec4(c*f*0.9, f*0.55); }',
  }));
  atmos.renderOrder = 1; root.add(atmos); atmos.position.set(0, CY, 0);
  // piédestal sous le globe
  const pedestal = new THREE.Group(); root.add(pedestal);
  const pbase = cyl(5.2, 6.0, 0.7, M.grey4(), 48); pbase.position.y = 0; pedestal.add(pbase);
  const pring = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.5, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: C.yellow, transparent: true, opacity: 0.85 }));
  pring.position.y = 0.72; pedestal.add(pring);
  pedestal.position.y = CY - R - 1.6;

  // Marqueurs de marché
  const markers = MARKETS.map((m) => {
    const mk = makeMarker(m);
    const v = ll(m.lon, m.lat);
    mk.group.position.copy(v).multiplyScalar(R * 0.99);
    mk.group.quaternion.setFromUnitVectors(up, v);
    spin.add(mk.group);
    mk.m = m; mk.v = v;
    // liaison depuis le siège (épingle) : grand arc
    const curve = greatArc(hGeo, v, R * 0.99, 0.28 + hGeo.angleTo(v) * 0.05);
    const st = TYPE_STYLE[m.type];
    links.add({ curve, type: st.link, parent: spin, t0: m.t + 0.7, drawDur: 1.0, t1: 50, radius: 0.1, pulses: 3, speed: 0.38, dash: m.type === 'C' ? 0.8 : 0 });
    // étiquette
    labels.add({
      kind: 'card', title: m.name, sub: m.note, color: st.color, scale: 0.8,
      anchor: (t, out) => { const p = mk.group.getWorldPosition(out); out.y += 1.2; return out; },
      dx: m.id === 'de' ? 90 : m.id === 'jp' ? 80 : m.id === 'cn' ? -120 : -130, dy: m.id === 'de' ? -95 : -110, t0: m.t + 1.0, t1: Math.min(m.t + 3.6, 43.5), align: m.id === 'de' || m.id === 'jp' ? 'left' : 'right',
    });
    return mk;
  });

  // Quaternions de visée (géo → monde) pour chaque clé
  const camAt = ctx.camAt; // injecté par main
  function faceQuat(lon, lat, t) {
    const s = camAt(t);
    const D = new THREE.Vector3(Math.cos(s.el * DEG) * Math.sin(s.az * DEG), Math.sin(s.el * DEG), Math.cos(s.el * DEG) * Math.cos(s.az * DEG)).normalize();
    const e1 = ll(lon, lat), upG = new THREE.Vector3(0, 1, 0);
    const e2 = upG.clone().sub(e1.clone().multiplyScalar(upG.dot(e1))).normalize();
    const e3 = new THREE.Vector3().crossVectors(e1, e2);
    const upW = new THREE.Vector3(0, 1, 0);
    const E2 = upW.clone().sub(D.clone().multiplyScalar(upW.dot(D))).normalize();
    const E3 = new THREE.Vector3().crossVectors(D, E2);
    const A = new THREE.Matrix4().makeBasis(e1, e2, e3);
    const B = new THREE.Matrix4().makeBasis(D, E2, E3);
    const Rm = new THREE.Matrix4().multiplyMatrices(B, A.transpose());
    return new THREE.Quaternion().setFromRotationMatrix(Rm);
  }
  const faceQ = FACE_KEYS.map((k) => faceQuat(k.lon, k.lat, k.t));
  function spinAt(t) {
    if (t <= FACE_KEYS[0].t) {
      // de Q (projection) vers la première visée
      const u = smoother((t - G_T.morph1) / (FACE_KEYS[0].t - G_T.morph1));
      return t <= G_T.morph1 ? Q.clone() : Q.clone().slerp(faceQ[0], u);
    }
    for (let i = 1; i < FACE_KEYS.length; i++) {
      if (t <= FACE_KEYS[i].t) {
        const u = smoother((t - FACE_KEYS[i - 1].t) / (FACE_KEYS[i].t - FACE_KEYS[i - 1].t));
        return faceQ[i - 1].clone().slerp(faceQ[i], u);
      }
    }
    return faceQ[faceQ.length - 1].clone();
  }

  function update(t) {
    const live = t > G_T.dots0 - 0.2 && t < 45.1;
    root.visible = live;
    if (!live) {
      // hors de la séquence globe, le siège reprend sa pose d'origine (le hook saute d'un instant à l'autre)
      if (t < G_T.dots0 - 0.2) { const g = ctx.hq.group; g.position.set(0, 0, 0); g.quaternion.identity(); g.scale.setScalar(1); }
      return;
    }
    const m = seg(t, G_T.morph0, G_T.morph1, (x) => x);
    const s = spinAt(t);
    spin.quaternion.copy(s);

    // — points : apparition en ondulation, puis repli en sphère
    const morphing = t < G_T.morph1 + 0.05 || lastKey === null;
    const key = morphing ? 'm' + t.toFixed(4) : 'done';
    if (key !== lastKey || morphing) {
      for (let i = 0; i < count; i++) {
        const d = dotsGeo[i];
        const delay = 0.5 * (1 - d.rho);
        const u = easeInOutCubic(clamp((m - delay) / (1 - 0.5)));
        const appear = easeOutBack(clamp((t - G_T.dots0 - d.rho * 1.1) / 0.5), 2.2);
        tmpP.copy(d.F).lerp(tmpS.copy(d.v).multiplyScalar(R * 0.995), u);
        tmpN.copy(flatN).lerp(d.v, u).normalize();
        tmpQ.setFromUnitVectors(up, tmpN);
        const sc = Math.max(0.0001, appear);
        tmpM.compose(tmpP, tmpQ, tmpS.set(sc, sc, sc));
        dots.setMatrixAt(i, tmpM);
      }
      dots.instanceMatrix.needsUpdate = true;
      lastKey = key;
    }
    ocean.scale.setScalar(Math.max(0.001, easeOutCubic(seg(t, 33.7, 35.1, (x) => x))));
    atmos.scale.setScalar(Math.max(0.001, easeOutCubic(seg(t, G_T.morph1 - 0.8, G_T.morph1 + 0.6, (x) => x))));
    pedestal.scale.setScalar(Math.max(0.001, easeOutBack(seg(t, G_T.morph1 - 1, G_T.morph1 + 0.3, (x) => x), 1.4)));

    // — le siège devient l'épingle du globe
    const hp = easeInOutCubic(seg(t, G_T.hq0, G_T.hq1, (x) => x));
    const hqG = ctx.hq.group;
    const pinPos = new THREE.Vector3().copy(hGeo).multiplyScalar(R * 0.99).applyQuaternion(s).add(new THREE.Vector3(0, CY, 0));
    const pinQ = s.clone().multiply(new THREE.Quaternion().setFromUnitVectors(up, hGeo));
    if (t < G_T.hq0 - 0.001) { hqG.position.set(0, 0, 0); hqG.quaternion.identity(); hqG.scale.setScalar(1); }
    else {
      hqG.position.set(0, 0, 0).lerp(pinPos, hp);
      hqG.position.y += Math.sin(Math.PI * hp) * 6;           // petit arc de vol
      hqG.quaternion.identity().slerp(pinQ, hp);
      hqG.scale.setScalar(lerp(1, 0.2, hp));
    }

    for (const mk of markers) {
      const p = easeOutBack(clamp((t - mk.m.t) / 0.9), 1.5);
      mk.group.visible = p > 0.001;
      mk.group.scale.setScalar(Math.max(0.0001, p * 1.25));
      mk.anim(clamp((t - mk.m.t) / 1.6), t);
      mk.ring.scale.setScalar(1 + 0.12 * Math.sin(t * 3 + mk.m.lon));
      for (const a of mk.team) a.update(t);
    }
  }
  /** Position monde d'un marqueur à l'instant t (pour viser un plongeon de caméra). */
  function markerWorldAt(id, t) {
    const mk = markers.find((x) => x.m.id === id);
    const sq = spinAt(t);
    return mk.v.clone().multiplyScalar(R * 0.99).applyQuaternion(sq).add(new THREE.Vector3(0, CY, 0));
  }
  return { update, root, spin, markers, Q, hGeo, markerWorldAt };
}
