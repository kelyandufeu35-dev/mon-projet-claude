// Extensions de shader pour matériaux Three.js (onBeforeCompile). Tout est une fonction pure du
// temps `uTime` : aucune dérive, aucun Math.random() -> rendu reproductible image par image.
//
// Les extensions se composent : chaque appel à `patch()` ajoute son fragment de code et sa clé
// au matériau (sans écraser les précédentes), pour que des matériaux ayant des combinaisons
// différentes ne partagent jamais le même programme compilé.

import * as THREE from 'three';

export const sharedTime = { value: 0 };

export function patch(material, key, fn) {
  const prev = material.onBeforeCompile;
  const prevKey = material.userData.__patchKeys || '';
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(material, shader, renderer);
    fn(shader, renderer);
  };
  material.userData.__patchKeys = `${prevKey}|${key}`;
  material.customProgramCacheKey = () => material.userData.__patchKeys;
  material.needsUpdate = true;
  return material;
}

const HASH_GLSL = /* glsl */ `
float hf_hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`;

// Position monde du fragment, utile à plusieurs extensions.
function withWorldPos(shader) {
  if (shader.vertexShader.includes('vHfWorld')) return;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vHfWorld;')
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 hfWp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        hfWp = instanceMatrix * hfWp;
      #endif
      vHfWorld = (modelMatrix * hfWp).xyz;`
    );
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vHfWorld;');
}

/**
 * LED clignotantes sur une texture émissive (MeshStandardMaterial) : chaque cellule reçoit une
 * fréquence et une phase propres ; une fraction des LED reste allumée en continu.
 */
export function addBlink(material, { cells = [128, 480], baseLevel = 0.12, steadyFraction = 0.45, minRate = 1.2, maxRate = 9.0 } = {}) {
  // Remplace entièrement l'inclusion de la carte émissive : le clignotement ne module QUE la carte de LED.
  // Ordre d'application : appeler addHallAmbient AVANT addBlink (l'ambiance s'insère après l'inclusion,
  // donc après la ligne modulée par le clignotement, et n'est jamais affectée).
  return patch(material, `blink-${cells.join('x')}-${baseLevel}-${steadyFraction}-${minRate}-${maxRate}`, (shader) => {
    shader.uniforms.uTime = sharedTime;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\n${HASH_GLSL}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#ifdef USE_EMISSIVEMAP
          vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
          vec2 cell = floor(vEmissiveMapUv * vec2(${cells[0].toFixed(1)}, ${cells[1].toFixed(1)}));
          float rnd = hf_hash21(cell);
          float rate = mix(${minRate.toFixed(2)}, ${maxRate.toFixed(2)}, hf_hash21(cell + 3.1));
          float on = step(0.5, fract(uTime * rate + rnd * 13.0));
          float steady = step(${(1 - steadyFraction).toFixed(3)}, hf_hash21(cell + 9.0));
          float level = mix(${baseLevel.toFixed(3)}, 1.0, mix(on, 1.0, steady));
          totalEmissiveRadiance *= emissiveColor.rgb * level;
        #endif`
      );
  });
}

/** Même clignotement pour un MeshBasicMaterial dont la couleur vient d'une texture (reflets du sol). */
export function addBlinkBasic(material, { cells = [128, 480], baseLevel = 0.12, steadyFraction = 0.45, minRate = 1.2, maxRate = 9.0 } = {}) {
  return patch(material, `blinkbasic-${cells.join('x')}-${baseLevel}-${steadyFraction}`, (shader) => {
    shader.uniforms.uTime = sharedTime;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\n${HASH_GLSL}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
          vec2 cell = floor(vMapUv * vec2(${cells[0].toFixed(1)}, ${cells[1].toFixed(1)}));
          float rnd = hf_hash21(cell);
          float rate = mix(${minRate.toFixed(2)}, ${maxRate.toFixed(2)}, hf_hash21(cell + 3.1));
          float on = step(0.5, fract(uTime * rate + rnd * 13.0));
          float steady = step(${(1 - steadyFraction).toFixed(3)}, hf_hash21(cell + 9.0));
          float level = mix(${baseLevel.toFixed(3)}, 1.0, mix(on, 1.0, steady));
          diffuseColor.rgb *= level;
        #endif`
      );
  });
}

/**
 * Impulsions lumineuses qui circulent le long de fils (boîtes unitaires étirées sur X).
 * Attributs d'instance : aSeed (0..1), aLen (nombre de motifs le long du fil).
 */
export function addWirePulse(material, { color = new THREE.Color(0x76b900), base = 0.05, peak = 5.0, speed = 0.55 } = {}) {
  return patch(material, `wirepulse-${base}-${peak}-${speed}`, (shader) => {
    shader.uniforms.uTime = sharedTime;
    shader.uniforms.uPulseColor = { value: color };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSeed;\nattribute float aLen;\nvarying float vAlong;\nvarying float vSeed;\nvarying float vLen;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlong = position.x + 0.5;\nvSeed = aSeed;\nvLen = aLen;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uPulseColor;\nvarying float vAlong;\nvarying float vSeed;\nvarying float vLen;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float ph = fract(vAlong * vLen - uTime * ${speed.toFixed(3)} * (0.6 + vSeed) + vSeed * 7.0);
        float head = smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.05, 0.3, ph));
        totalEmissiveRadiance += uPulseColor * (${base.toFixed(3)} + ${peak.toFixed(3)} * head);`
      );
  });
}

/**
 * Ouverture circulaire dans la face supérieure de la puce (révèle l'architecture dessous), avec un
 * liseré lumineux au bord. `uniforms.center` est en mètres dans le repère objet de la puce.
 */
export function addReveal(material, uniforms) {
  return patch(material, 'reveal', (shader) => {
    shader.uniforms.uRevealCenter = uniforms.center;
    shader.uniforms.uRevealRadius = uniforms.radius;
    shader.uniforms.uRevealEdge = uniforms.edge;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uRevealCenter;\nuniform float uRevealRadius;\nuniform float uRevealEdge;\nvarying vec3 vObjPos;')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float revealD = length(vObjPos.xz - uRevealCenter);
        if (uRevealRadius > 0.0 && revealD < uRevealRadius) discard;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rim = (1.0 - smoothstep(0.0, uRevealEdge, revealD - uRevealRadius)) * step(0.0001, uRevealRadius);
        rim = rim * rim;
        totalEmissiveRadiance += mix(vec3(0.46, 0.72, 0.0), vec3(0.85, 1.0, 0.7), rim) * rim * 3.4;`
      );
  });
}

/**
 * Lumière ambiante « cuite » de la salle : éclairement périodique sous chaque rampe LED (période
 * `period` le long de Z) et dégradé vertical. Ajoute `diffuseColor * ambient * pools` à l'émissif :
 * équivalent à une lumière d'ambiance, sans coût par source.
 */
export function addHallAmbient(material, { ambient = 5, period = 3.8, z0 = 6.4, poolMin = 0.35, heightFull = 2.4, heightMin = 0.35, sheen = 0 } = {}) {
  return patch(material, `hallambient-${ambient}-${period}-${z0}-${poolMin}-${heightMin}-${sheen}`, (shader) => {
    withWorldPos(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float hfPool = mix(${poolMin.toFixed(3)}, 1.0, 0.5 + 0.5 * cos((vHfWorld.z - ${z0.toFixed(3)}) * 6.2831853 / ${period.toFixed(3)}));
      float hfH = mix(${heightMin.toFixed(3)}, 1.0, smoothstep(0.0, ${heightFull.toFixed(3)}, vHfWorld.y));
      totalEmissiveRadiance += diffuseColor.rgb * ${ambient.toFixed(3)} * hfPool * hfH;
      ${sheen > 0 ? `float hfFr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
      totalEmissiveRadiance += vec3(0.42, 0.55, 0.72) * hfFr * ${sheen.toFixed(3)} * hfPool * hfH;` : ''}`
    );
  });
}

/**
 * Sol réfléchissant : transparence pilotée par Fresnel. Ce qui est sous le sol (copies miroir
 * de sources lumineuses) apparaît par transparence d'autant plus que l'angle est rasant.
 * Nécessite `transparent: true`, blending pré-multiplié (One, OneMinusSrcAlpha) et le sol hors
 * pré-passage de profondeur (calque 1).
 */
export function addFresnelMirror(material, { strength = 1.0, roughness = 0.3 } = {}) {
  return patch(material, `fresnelmirror-${strength}-${roughness}`, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float hfCos = clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
      float hfF = 0.04 + 0.96 * pow(1.0 - hfCos, 5.0);
      float hfRefl = clamp(hfF * ${strength.toFixed(3)} * ${(1 - roughness).toFixed(3)}, 0.0, 1.0);
      gl_FragColor = vec4(outgoingLight, 1.0 - hfRefl);`
    );
  });
}
