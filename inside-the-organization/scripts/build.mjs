// Empaquette src/ (Three.js inclus) en un seul fichier dist/scene.js — rendu hors-ligne, déterministe.
import { build } from 'esbuild';
await build({
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', outfile: 'dist/scene.js',
  target: 'chrome120', sourcemap: false, minify: false, logLevel: 'info',
});
