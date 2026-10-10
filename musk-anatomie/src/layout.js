// Géométrie du monde : cinq districts reliés autour du hub (Musk).
// Axes écran à az = 45° : droite R = (1,0,-1)/√2 ; fond F = (-1,0,-1)/√2.
import * as THREE from "three";

const SQ = Math.SQRT1_2;
/** point du monde à (a) vers la droite de l'écran et (b) vers le fond */
export const at = (a, b, y = 0) => new THREE.Vector3((a - b) * SQ, y, (-a - b) * SQ);

const D = 95;
export const POS = {
  hub: at(0, 0),
  tesla: at(-D, 0),   // gauche
  spacex: at(D, 0),   // droite
  bourse: at(0, D),   // fond
  bank: at(0, -D),    // avant
};
export const PLATFORM = 66; // côté (carré aligné sur les axes monde)
