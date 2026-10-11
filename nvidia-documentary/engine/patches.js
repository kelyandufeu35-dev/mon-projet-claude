// Correctifs de performance pour le rendu WebGL logiciel (SwiftShader), mesurés sur ce projet.
// À appeler avant la première compilation d'un matériau.
//
// 1. Lecture d'environnement (IBL). Mesure, 1280x720, 1 sous-échantillon, scène PBR avec IBL :
//      `texture2DGradEXT` (par défaut dans Three r170) : ~800 ms
//      `texture2D` standard                            : ~420 ms
//    Le résultat visuel est identique : le PMREM n'a pas de mipmaps, donc le LOD est déjà nul.
//
// 2. Texture ORM partagée (R = occlusion, G = rugosité, B = métallicité). Three lit la même
//    texture trois fois ; avec `defines.ORM_SHARED` on la lit une seule fois. Chaque lecture de
//    texture plein écran coûte environ 70 ms à 720p en rendu logiciel.

import { ShaderChunk } from 'three';

let applied = false;

function replaceOnce(chunkName, needle, replacement) {
  const src = ShaderChunk[chunkName];
  if (!src || !src.includes(needle)) {
    // Version de Three différente : on ne touche à rien plutôt que de casser le rendu.
    console.warn(`[patches] chunk ${chunkName} inattendu, correctif ignoré`);
    return false;
  }
  ShaderChunk[chunkName] = src.replace(needle, replacement);
  return true;
}

export function applyShaderPatches() {
  if (applied) return;
  applied = true;

  replaceOnce(
    'cube_uv_reflection_fragment',
    'texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb',
    'texture2D( envMap, uv ).rgb'
  );

  replaceOnce(
    'metalnessmap_fragment',
    'vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );',
    `#ifdef ORM_SHARED
		vec4 texelMetalness = texelRoughness;
	#else
		vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	#endif`
  );

  replaceOnce(
    'aomap_fragment',
    'float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;',
    `#ifdef ORM_SHARED
		float ambientOcclusion = ( texelRoughness.r - 1.0 ) * aoMapIntensity + 1.0;
	#else
		float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	#endif`
  );
}
