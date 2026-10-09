// Format de sortie, fixé à la compilation (esbuild --define __PORTRAIT__).
//  - paysage : 1920 × 1080 (YouTube / web)        - portrait : 1080 × 1920 (TikTok / Reels / Shorts)
export const PORTRAIT = typeof __PORTRAIT__ !== 'undefined' && __PORTRAIT__ === true;
export const W = PORTRAIT ? 1080 : 1920;
export const H = PORTRAIT ? 1920 : 1080;

// Zone de sécurité des étiquettes 3D (px). En portrait : on évite le haut (titre) et le bas (sous-titres + interface TikTok).
export const SAFE = PORTRAIT
  ? { left: 26, right: W - 26, top: () => 495, bottom: 1250 }
  : { left: 40, right: W - 40, top: (x) => (x < 1010 ? 212 : 44), bottom: 884 };
// Facteur d'échelle des étiquettes (police) selon le format.
export const LBL = PORTRAIT ? 1.35 : 1.0;
// Facteur appliqué aux décalages (dx, dy) des étiquettes : les cartes étant plus grandes en portrait.
export const LBLD = PORTRAIT ? 1.2 : 1.0;
