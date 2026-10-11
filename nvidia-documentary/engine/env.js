// Environnement lumineux procédural (IBL) : un volume sombre avec de vraies sources
// (panneaux et barres LED), défini comme sur un plateau de prise de vue : chaque source a un
// azimut, une élévation et une taille angulaire. Il est prétraité en PMREM pour les reflets PBR.
// Les intensités sont en HDR (> 1) : les métaux reflètent des sources réellement plus brillantes
// que le reste de la pièce.
//
// Repère : azimut 0° = +z (derrière une caméra qui regarde vers -z), positif vers +x (droite de
// l'écran) ; élévation 0° = horizon, 90° = zénith.

import * as THREE from 'three';

const R = 10; // distance des panneaux (seule la direction compte pour l'IBL)

export function dirOf(az, el) {
  const a = THREE.MathUtils.degToRad(az);
  const e = THREE.MathUtils.degToRad(el);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}

function panel(scene, { az, el, w, h, color = 0xffffff, intensity = 1, roll = 0, soft = 0 }) {
  const mat = soft > 0
    ? new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: { c: { value: new THREE.Color(color).multiplyScalar(intensity) }, s: { value: soft } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: `uniform vec3 c; uniform float s; varying vec2 vUv; void main(){
          vec2 d = abs(vUv - 0.5) * 2.0;
          float k = (1.0 - smoothstep(1.0 - s, 1.0, d.x)) * (1.0 - smoothstep(1.0 - s, 1.0, d.y));
          gl_FragColor = vec4(c * k, 1.0); }`,
      })
    : new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.copy(dirOf(az, el).multiplyScalar(R));
  m.lookAt(0, 0, 0);
  m.rotateZ(THREE.MathUtils.degToRad(roll));
  scene.add(m);
  return m;
}

// Direction (azimut, élévation) du softbox principal du preset 'studio' (premier élément).
export const STUDIO_MAIN = { az: 176, el: 20 };

export const ENV_PRESETS = {
  // (défini après studio et hall : voir plus bas pour 'both')
  // Plateau de macro : grand softbox arrière-haut (reflets larges sur le silicium), key latérale
  // douce, deux barres de contre-jour pour les arêtes, accents vert NVIDIA et bleu discrets.
  studio: [
    { az: 176, el: 20, w: 8.5, h: 5.0, color: 0xe4eeff, intensity: 3.0, soft: 0.9 },
    { az: 150, el: 52, w: 8, h: 8, color: 0xdfe9ff, intensity: 1.8, soft: 0.9 },
    { az: -48, el: 38, w: 7.5, h: 6, color: 0xf2f6ff, intensity: 3.0, soft: 0.9 },
    { az: 62, el: 20, w: 8, h: 5, color: 0xcfe0ff, intensity: 1.1, soft: 0.9 },
    { az: 0, el: 82, w: 10, h: 10, color: 0xe6efff, intensity: 1.6, soft: 0.9 },
    { az: -118, el: 11, w: 0.9, h: 7, color: 0xeaf3ff, intensity: 9, soft: 0.8 },
    { az: 128, el: 9, w: 0.8, h: 6.5, color: 0xeaf3ff, intensity: 8, soft: 0.8 },
    { az: 96, el: 3, w: 11, h: 0.5, color: 0x76b900, intensity: 3.5, soft: 0.8 },
    { az: -96, el: 5, w: 0.6, h: 4.5, color: 0x2a6bff, intensity: 1.6, soft: 0.8 },
  ],
  // Salle de données : rampes LED régulières au plafond, accents verts bas.
  hall: [
    ...[-60, -35, -12, 12, 35, 60].map((az) => ({ az, el: 70 - Math.abs(az) * 0.2, w: 0.3, h: 12, color: 0xe8f1ff, intensity: 11 })),
    { az: 0, el: 86, w: 12, h: 12, color: 0xdbe7ff, intensity: 1.1 },
    { az: 180, el: 4, w: 14, h: 0.18, color: 0x76b900, intensity: 6 },
    { az: 90, el: 6, w: 0.18, h: 9, color: 0x76b900, intensity: 3.5 },
  ],
};

ENV_PRESETS.both = [...ENV_PRESETS.studio, ...ENV_PRESETS.hall.map((p) => ({ ...p, intensity: p.intensity * 0.9 }))];

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {'studio'|'hall'|'both'} kind
 */
export function buildEnvironment(renderer, kind = 'studio') {
  const s = new THREE.Scene();
  // Coque de la pièce : sol quasi noir, murs sombres légèrement bleutés.
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(40, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec3 vP; void main(){
        float h = vP.y;
        vec3 floorC = vec3(0.004, 0.005, 0.006);
        vec3 wallC = vec3(0.012, 0.016, 0.022);
        vec3 ceilC = vec3(0.02, 0.026, 0.034);
        vec3 c = mix(floorC, wallC, smoothstep(-0.25, 0.1, h));
        c = mix(c, ceilC, smoothstep(0.1, 0.9, h));
        gl_FragColor = vec4(c, 1.);
      }`,
    })
  );
  s.add(room);
  for (const p of ENV_PRESETS[kind] || ENV_PRESETS.studio) panel(s, p);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(s, 0.012, 0.1, 100);
  pmrem.dispose();
  s.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return rt.texture;
}


/**
 * Environnement "monde" : géométrie réelle de la salle de données (rampes LED, lignes vertes de baies, baies sombres, sol), capturée depuis un point de
 * l'allée. Le PMREM contient donc de vraies sources aux bonnes positions : le sol brillant reflète
 * des rampes qui convergent vers l'horizon, comme dans une vraie prise de vue.
 * Pas de plafond ni de murs dans la capture. Le GPU « héros » a son propre environnement de studio.
 */
export function buildWorldEnvironment(renderer, { capture = [0, 1.6, 2], hall } = {}) {
  const s = new THREE.Scene();
  const root = new THREE.Group();
  root.position.set(-capture[0], -capture[1], -capture[2]);
  s.add(root);

  // Coque sombre du ciel.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(vec3(0.004,0.005,0.007), vec3(0.016,0.021,0.03), smoothstep(-0.2,0.9,h)); gl_FragColor = vec4(c,1.); }`,
    })
  );
  s.add(sky);

  const dark = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.012, 0.014, 0.017) });
  const emit = (c, i) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), toneMapped: false });
  const box = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    root.add(m);
  };
  const len = hall.zNear - hall.zFar;
  const zc = (hall.zNear + hall.zFar) / 2;
  // Sol et deux rangées de baies (blocs sombres).
  box(60, 0.02, 120, 0, 0, zc, dark);
  for (const sx of [-1, 1]) {
    box(hall.rackD, hall.rackH, len, sx * (hall.aisleHalf + hall.rackD / 2), hall.rackH / 2, zc, dark);
    // Ligne verte en haut de baie.
    box(0.014, 0.014, len, sx * (hall.aisleHalf - 0.004), hall.rackH + 0.006, zc, emit(0x76b900, 3.4));
  }
  // Rampes LED du plafond (positions identiques à celles de la salle).
  const nBars = Math.ceil(len / 3.8);
  for (const bx of [-1.0, 1.0]) for (let i = 0; i < nBars; i++) {
    box(0.14, 0.05, 3.2, bx, hall.ceilH - 0.03, hall.zNear - i * 3.8 - 1.6, emit(0xe8f1ff, 7.5));
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(s, 0.0, 0.05, 2000);
  pmrem.dispose();
  s.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return rt.texture;
}
