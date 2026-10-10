// Empaquette src/ (Three.js inclus) en un fichier par format et par langue — rendu hors-ligne, déterministe.
//   dist/scene.js            paysage 1920x1080, français
//   tiktok/dist/scene.js     portrait 1080x1920, français (+ assets partagés copiés dans tiktok/assets)
//   tiktok-en/dist/scene.js  portrait 1080x1920, anglais  (+ assets partagés, voix off anglaise dans tiktok-en/assets/audio/vo)
import { build } from 'esbuild';
import fs from 'node:fs';
const common = { entryPoints: ['src/main.js'], bundle: true, format: 'iife', target: 'chrome120', sourcemap: false, minify: false, logLevel: 'info', loader: { '.json': 'json' } };
const def = (portrait, lang) => ({ __PORTRAIT__: String(portrait), __LANG__: JSON.stringify(lang) });
await build({ ...common, outfile: 'dist/scene.js', define: def(false, 'fr') });
fs.mkdirSync('tiktok/dist', { recursive: true });
await build({ ...common, outfile: 'tiktok/dist/scene.js', define: def(true, 'fr') });
fs.mkdirSync('tiktok-en/dist', { recursive: true });
await build({ ...common, outfile: 'tiktok-en/dist/scene.js', define: def(true, 'en') });
// assets partagés (polices, audio, GSAP, feuille de style) copiés dans les projets verticaux (sans les voix off des autres langues)
const skipVo = (src) => !/audio[\\/]vo-[a-z]{2}$/.test(src);
fs.cpSync('assets', 'tiktok/assets', { recursive: true, filter: skipVo });
fs.cpSync('assets', 'tiktok-en/assets', { recursive: true, filter: skipVo });
fs.cpSync('assets/audio/vo-en', 'tiktok-en/assets/audio/vo', { recursive: true, force: true });
