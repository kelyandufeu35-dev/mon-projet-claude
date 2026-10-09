// Empaquette src/ (Three.js inclus) en un seul fichier par format — rendu hors-ligne, déterministe.
//   dist/scene.js          paysage 1920x1080
//   tiktok/dist/scene.js   portrait 1080x1920 (+ synchronisation des assets partagés dans tiktok/assets)
import { build } from 'esbuild';
import fs from 'node:fs';
const common = { entryPoints: ['src/main.js'], bundle: true, format: 'iife', target: 'chrome120', sourcemap: false, minify: false, logLevel: 'info', loader: { '.json': 'json' } };
await build({ ...common, outfile: 'dist/scene.js', define: { __PORTRAIT__: 'false' } });
fs.mkdirSync('tiktok/dist', { recursive: true });
await build({ ...common, outfile: 'tiktok/dist/scene.js', define: { __PORTRAIT__: 'true' } });
// assets partagés (polices, audio, GSAP, feuille de style) copiés dans le projet vertical
fs.cpSync('assets', 'tiktok/assets', { recursive: true });
