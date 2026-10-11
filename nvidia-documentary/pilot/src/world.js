// Monde de la scène pilote : un seul graphe de scène, du dessus d'une puce jusqu'à l'allée d'une
// salle de données, parcouru par une unique trajectoire de caméra. Tout est une fonction pure du
// temps `t` (secondes) : aucun état caché, aucune dérive -> chaque image est reproductible.

import * as THREE from 'three';
import { CinePipeline } from '../../engine/pipeline.js';
import { buildEnvironment, buildWorldEnvironment, dirOf, STUDIO_MAIN } from '../../engine/env.js';
import { buildHall, HALL } from '../../engine/hall.js';
import { buildTray, TRAY } from '../../engine/board.js';
import { buildArchitecture } from '../../engine/arch.js';
import { CameraRig, configureCamera, track } from '../../engine/camera.js';
import { addReveal, sharedTime } from '../../engine/shaders.js';
import { smoothNoise, clamp } from '../../engine/rng.js';
import { createMotionPlanner } from '../../engine/motion.js';

export const DURATION = 32;
const mm = 0.001;

// `pipe` : pipeline partagé (la version verticale réunit plusieurs mondes sur un seul rendu) ;
// `rigKeys` : images-clés de caméra de remplacement (même repère que ci-dessous, voir `L`).
export function createWorld({ canvas, width, height, samples = 6, shadowType = 'basic', pipe: sharedPipe = null, rigKeys = null }) {
  const pipe = sharedPipe || new CinePipeline({ canvas, width, height, samples, shadowType });
  const renderer = pipe.renderer;

  const scene = new THREE.Scene();
  // Pas de `scene.background` : une couleur de fond force Three à effacer profondeur ET couleur à chaque
  // `render()`, ce qui détruirait la profondeur du pré-passage. Le fond (noir) est effacé par le pipeline.
  scene.environment = buildWorldEnvironment(renderer, { capture: [-0.4, 1.5, 1.5], hall: HALL });
  scene.fog = new THREE.FogExp2(0x0c1620, 0.02);

  // --- Salle, baie héros, plateau serveur ---------------------------------------------------
  const hall = buildHall();
  scene.add(hall.group);
  const tray = buildTray();
  const rack = hall.heroRack;
  tray.group.rotation.y = Math.PI / 2; // l'avant du châssis (+Z local) regarde l'allée (+X)
  // Plateau sorti de 0,55 m hors de la baie : centre du châssis = avant de baie + 0,55 - demi-profondeur.
  tray.group.position.set(rack.front + 0.55 - TRAY.depth / 2, rack.slotLo + 0.022, rack.z);
  scene.add(tray.group);
  const gpu = tray.hero;

  // --- Architecture interne de la puce, révélée par une ouverture de la face supérieure ---------
  const reveal = { center: { value: new THREE.Vector2(-0.0025, 0.002) }, radius: { value: 0 }, edge: { value: 0.00035 } };
  const arch = buildArchitecture({ baseY: 0.85 * mm, reveal });
  gpu.add(arch.group);
  const dieMesh = gpu.userData.dieMesh;
  addReveal(gpu.userData.dieMat, reveal);
  dieMesh.layers.set(1); // hors pré-passage de profondeur : la face supérieure peut être trouée

  // Éclairage « studio » propre au GPU héros : environnement tournant affecté à ses matériaux seuls.
  // Le reste de la salle utilise l'environnement de la salle (géométrie réelle, fixe).
  const studioEnv = buildEnvironment(renderer, 'studio');
  const heroMats = new Set();
  gpu.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.isMeshStandardMaterial) heroMats.add(m);
  });
  for (const m of heroMats) {
    m.envMap = studioEnv;
    m.envMapIntensity = 1;
    m.needsUpdate = true;
  }
  // Objets cachés pendant la phase intérieure (la caméra est à l'intérieur de la puce).
  const outside = [hall.group, ...tray.group.children.filter((c) => c !== gpu), ...gpu.children.filter((c) => c !== dieMesh && c !== arch.group)];

  scene.updateMatrixWorld(true);
  const P = new THREE.Vector3();
  gpu.getWorldPosition(P);
  const L = (x, y, z) => gpu.localToWorld(new THREE.Vector3(x, y, z)).toArray(); // repère du package -> monde

  // --- Lumières ---------------------------------------------------------------------------------
  const macroKey = new THREE.SpotLight(0xe6efff, 1, 1.2, 0.17, 0.9, 2);
  const mkPos = L(0.18, 0.32, 0.2);
  macroKey.position.set(...mkPos);
  macroKey.target.position.copy(P);
  macroKey.castShadow = true;
  macroKey.shadow.mapSize.set(2048, 2048);
  macroKey.shadow.camera.near = 0.2;
  macroKey.shadow.camera.far = 0.9;
  macroKey.shadow.bias = -0.00003;
  macroKey.shadow.normalBias = 0.00008;
  macroKey.shadow.radius = 2;
  scene.add(macroKey, macroKey.target);

  const trayKey = new THREE.SpotLight(0xdfe9ff, 1, 8, 0.62, 0.9, 2);
  trayKey.position.set(-0.1, 2.35, 1.2);
  trayKey.target.position.set(-1.1, 1.1, -0.05);
  trayKey.castShadow = true;
  trayKey.shadow.mapSize.set(2048, 2048);
  trayKey.shadow.camera.near = 0.6;
  trayKey.shadow.camera.far = 4.5;
  trayKey.shadow.bias = -0.00008;
  trayKey.shadow.normalBias = 0.0006;
  trayKey.shadow.radius = 3;
  scene.add(trayKey, trayKey.target);

  // « Lampe frontale » de l'objectif sonde : éclaire de près l'architecture pendant la plongée.
  const probe = new THREE.PointLight(0xd8ecff, 0, 0, 2);
  scene.add(probe);

  // --- Trajectoire de caméra ---------------------------------------------------------------------
  const k = (t, pos, target, o = {}) => ({ t, pos, target, ...o });
  const UP_TOP = [-1, 0, 0]; // vue de dessus du package : le haut de l'écran pointe vers -z local (= -x monde)
  const defaultKeys = [
    // A. Macro : orbite lente autour de la puce, de 35° à la verticale d'élévation. Ouvertures fermées
    // (f/16) : la profondeur de champ reste maîtrisée pour un rendu sans images fantômes.
    k(0.0, L(0.046, 0.094, 0.116), L(0.004, 0.0012, 0.000), { focal: 70, fstop: 16, near: 0.02, far: 3, ease: 'inOut' }),
    k(3.2, L(0.000, 0.104, 0.101), L(0.000, 0.0012, 0.000), { focal: 62, fstop: 16, near: 0.02, far: 3, ease: 'inOut' }),
    k(6.0, L(-0.010, 0.106, 0.055), L(-0.002, 0.0014, 0.001), { focal: 52, fstop: 16, near: 0.02, far: 3, ease: 'inOut' }),
    k(8.2, L(-0.0025, 0.075, 0.0035), L(-0.0025, 0.0016, 0.002), { focal: 50, fstop: 16, near: 0.01, far: 3, ease: 'in', up: UP_TOP }),
    // B. Plongée dans la puce.
    k(10.0, L(-0.0025, 0.0140, 0.0030), L(-0.0025, 0.0010, 0.0016), { focal: 35, fstop: 40, near: 0.0008, far: 1, ease: 'inOut', up: UP_TOP }),
    k(11.4, L(-0.0025, 0.0036, 0.0030), L(-0.0025, 0.0011, 0.0000), { focal: 28, fstop: 400, near: 0.0001, far: 0.5, ease: 'inOut', up: UP_TOP }),
    k(12.8, L(-0.0025, 0.00150, 0.0020), L(-0.0026, 0.00125, -0.0040), { focal: 24, fstop: 400, near: 0.00005, far: 0.3, ease: 'linear' }),
    k(14.2, L(-0.0027, 0.00152, -0.0018), L(-0.0028, 0.00130, -0.0100), { focal: 24, fstop: 400, near: 0.00005, far: 0.3, ease: 'inOut' }),
    // C. Remontée par l'ouverture, puis recul vers l'échelle du plateau.
    k(15.6, L(-0.0030, 0.0042, -0.0035), L(-0.0030, 0.0014, -0.0075), { focal: 28, fstop: 250, near: 0.0001, far: 0.5, ease: 'inOut' }),
    k(17.2, L(-0.0050, 0.0300, -0.0060), L(0.0000, 0.0016, 0.0000), { focal: 40, fstop: 12, near: 0.004, far: 3, ease: 'inOut', up: UP_TOP }),
    k(19.2, L(-0.0300, 0.2200, 0.0800), L(0.0000, 0.0000, 0.0000), { focal: 40, fstop: 12, near: 0.02, far: 40, ease: 'inOut', up: UP_TOP }),
    // D. Plateau, baie, allée.
    k(21.6, [-0.60, 1.78, 0.95], [-1.14, 1.08, -0.05], { focal: 32, fstop: 8, near: 0.03, far: 60, ease: 'inOut' }),
    k(24.2, [0.10, 1.55, 2.40], [-1.15, 1.22, 0.0], { focal: 26, fstop: 8, near: 0.04, far: 120, ease: 'inOut' }),
    k(27.4, [0.06, 1.62, 5.20], [-0.30, 1.40, -8.0], { focal: 22, fstop: 8, near: 0.05, far: 150, ease: 'inOut' }),
    k(32.0, [0.00, 1.90, 7.30], [0.00, 1.62, -30.0], { focal: 21, fstop: 8, near: 0.05, far: 150, ease: 'out' }),
  ];
  const rig = new CameraRig(rigKeys ?? defaultKeys, { shake: null });

  // --- Pistes ---------------------------------------------------------------------------------------
  const exposure = track([[0, 1.3], [2.5, 1.15], [6, 0.95], [8, 0.9], [10.5, 1.25], [13, 1.0], [15.5, 1.0], [18.5, 1.0], [22, 1.5], [26.5, 1.6], [30, 1.5], [32, 1.5]]);
  const bloom = track([[0, 0.06], [10, 0.08], [13, 0.12], [16, 0.08], [24, 0.06], [32, 0.06]]);
  // Deux éclats : la pénétration de la surface de la puce (12,5 s) et la sortie à l'air libre (15,4 s),
  // qui masquent les changements de visibilité du décor.
  const flashIn = track([[12.28, 0, 'in'], [12.5, 1.2, 'out'], [12.85, 0]]);
  const flashOut = track([[15.0, 0, 'in'], [15.4, 2.6, 'out'], [16.3, 0]]);
  const flash = (t) => flashIn(t) + flashOut(t);
  const streak = track([[0, 0], [24, 0], [28, 0.05], [32, 0.06]]);
  const fade = track([[0, 0], [1.6, 1], [31.2, 1], [32, 1]]);
  // Décalage (degrés) du softbox par rapport à la direction de réflexion exacte : balayage de lumière.
  const sweepAz = track([[0, -30], [2.6, -18], [5.2, -2], [6.4, 18], [8.2, 34], [12, 34], [15.2, 8], [17.4, 12], [19.6, 28], [23, 0], [32, 0]]);
  const sweepEl = track([[0, 4], [8.2, 0], [32, 0]]);
  const macroOn = track([[0, 1], [16.5, 1], [19.5, 0]]);
  const trayOn = track([[0, 0], [17.5, 0], [21, 1], [25, 0.9], [29, 0.45], [32, 0.4]]);
  const probeOn = track([[0, 0], [9.0, 0], [10.4, 1], [15.5, 1], [17.4, 0.0]]);
  const revealR = track([[0, 0], [8.7, 0], [9.2, 0.0005], [11.6, 0.0050], [14.6, 0.0075], [19.2, 0.0075], [20.6, 0]], 'inOut');

  const camera = new THREE.PerspectiveCamera(30, width / height, 0.01, 200);
  const dieTopWorldY = gpu.localToWorld(new THREE.Vector3(0, gpu.userData.dieTop, 0)).y;
  const state = { t: 0, lens: null };
  const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  const _main = dirOf(STUDIO_MAIN.az, STUDIO_MAIN.el);
  const _q = new THREE.Quaternion(), _e = new THREE.Euler();

  // Caméra à l'instant t, avec un léger mouvement d'épaule proportionnel à l'échelle (distance à la cible).
  function placeCamera(cam, t) {
    const c = rig.sample(t);
    const dist = Math.hypot(c.pos[0] - c.target[0], c.pos[1] - c.target[1], c.pos[2] - c.target[2]);
    const sh = 0.0035 * dist;
    const pos = c.pos.map((v, i) => v + smoothNoise(t * 0.62 + i * 11.7, 1) * sh);
    const target = c.target.map((v, i) => v + smoothNoise(t * 0.83 + i * 5.3, 2) * sh * 0.4);
    const roll = c.roll + smoothNoise(t * 0.55, 3) * 0.0025;
    const lens = configureCamera(cam, { pos, target, focal: c.focal, fstop: c.fstop, focus: c.focus, aspect: width / height, near: c.near, far: c.far, roll, up: c.up });
    return { lens, pos };
  }

  function evaluate(t) {
    sharedTime.value = t;
    tray.update(t, 650);

    // Éclairage du GPU héros : on vise le softbox principal vers la direction de réflexion de la puce
    // (vue depuis la caméra), avec un décalage qui balaie la lumière en dégradé sur le silicium.
    const camNow = rig.sample(t).pos;
    _v.set(P.x - camNow[0], dieTopWorldY - camNow[1], P.z - camNow[2]).normalize();
    _r.copy(_v).addScaledVector(_up, -2 * _v.dot(_up)); // vecteur réfléchi par une surface horizontale
    const rAz = Math.atan2(_r.x, _r.z), rEl = Math.asin(THREE.MathUtils.clamp(_r.y, -1, 1));
    const dbgX = (typeof window !== 'undefined' && window.__extra) || {};
    const sweep = dbgX.sweepAz != null ? dbgX.sweepAz : sweepAz(t);
    _d.copy(dirOf(THREE.MathUtils.radToDeg(rAz) + sweep, THREE.MathUtils.radToDeg(rEl) + sweepEl(t)));
    _q.setFromUnitVectors(_main, _d);
    // Three applique la matrice de l'Euler dont chaque angle est nié ; ce n'est l'inverse de la rotation
    // voulue que si on calcule l'Euler de l'inverse, puis qu'on nie ses angles.
    _q.invert();
    _e.setFromQuaternion(_q, 'XYZ');
    _e.set(-_e.x, -_e.y, -_e.z, 'XYZ');
    for (const m of heroMats) m.envMapRotation.copy(_e);
    scene.environmentIntensity = 0.9;
    const showOutside = t < 12.5 || t >= 15.4;
    for (const o of outside) o.visible = showOutside;
    // Coût : chaque lumière active est évaluée par pixel, et chaque objet caché sous la puce serait
    // ombré pour rien. On n'active que ce qui est visible à l'instant t (fenêtres déterministes).
    arch.group.visible = t >= 8.4 && t <= 17.8;
    hall.group.visible = t >= 16.8;
    macroKey.visible = t < 19.8;
    probe.visible = t >= 9.2 && t < 17.6;
    trayKey.visible = t >= 17.6;

    macroKey.intensity = 0.7 * macroOn(t);
    trayKey.intensity = 32 * trayOn(t);
    const rr = revealR(t);
    reveal.radius.value = rr;
    dieMesh.castShadow = rr < 1e-4;

    const { lens, pos } = placeCamera(camera, t);

    // Lampe sonde : intensité proportionnelle au carré de la distance à la surface (éclairement constant).
    const h = Math.max(0.0002, pos[1] - (dieTopWorldY - 0.0006));
    probe.position.set(pos[0], pos[1], pos[2]);
    probe.intensity = 6.0 * h * h * probeOn(t);

    const g = pipe.grade;
    g.exposure = exposure(t);
    g.bloomStrength = bloom(t);
    g.fade = fade(t);
    g.flash = flash(t);
    g.streakStrength = streak(t);

    state.t = t;
    state.lens = lens;
    return { scene, camera, lens };
  }

  // Nombre de sous-échantillons par image : la profondeur de champ et le flou de mouvement n'ont pas
  // besoin de la même qualité partout (la plongée est quasi sténopé ; l'allée est peu défocalisée).
  const sampleFactor = track([[0, 1.2], [8.4, 1.2], [9.0, 0.6], [15.0, 0.6], [15.4, 0.8], [17.6, 0.8], [18.8, 0.6], [32, 0.6]], 'linear');
  // Obturateur (fraction de la période d'image). Avec peu de sous-échantillons temporels, un obturateur
  // large sur un mouvement rapide en pixels donne des copies translucides distinctes (« fantômes ») au lieu
  // d'un flou continu : l'écart entre copies = déplacement pendant l'obturateur / (N − 1). On le garde donc
  // court quand la caméra balaie vite (macro, plongée, sortie), et on revient à 180° pour l'allée, plus lente.
  const shutterFrac = track([
    [0, 0.22], [8.4, 0.22],          // macro
    [9.2, 0.12], [12.6, 0.12],       // plongée
    [13.6, 0.25], [14.8, 0.25],      // à l'intérieur de l'architecture
    [15.2, 0.10], [15.7, 0.06],      // sortie rapide : obturateur très court
    [17.0, 0.06], [17.6, 0.10],
    [18.8, 0.5], [32, 0.5],          // plateau et allée : 180°
  ], 'linear');
  const planner = createMotionPlanner({
    placeCamera: (cam, t) => placeCamera(cam, t).lens,
    duration: DURATION,
    shutterFrac,
    sampleFactor,
  });
  const { motionPx, shutterFor, samplesFor } = planner;

  return { pipe, scene, camera, evaluate, placeCamera, rig, defaultKeys, UP_TOP, shutterFrac, state, P, L, hall, tray, gpu, reveal, DURATION, samplesFor, shutterFor, sampleFactor, motionPx };
}
