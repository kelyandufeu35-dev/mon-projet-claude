#!/usr/bin/env node
// Génère pilot/test-<nom>.html : copie de la composition limitée à une courte durée, avec un décalage de
// lecture par défaut, pour valider rapidement un extrait par un vrai rendu Hyperframes.
// Usage : node tools/make-test-comp.mjs <nom> <début_s> <durée_s> [samples] [scale]
import fs from 'node:fs';
const [, , name = 'extrait', start = '0', dur = '3', samples = '2', scale = '0.5'] = process.argv;
let html = fs.readFileSync('pilot/index.html', 'utf8');
html = html.replaceAll('data-duration="32"', `data-duration="${dur}"`).replace('tl.to({}, { duration: 32 });', `tl.to({}, { duration: ${dur} });`);
html = html.replace('"label":"Sous-échantillons par image","default":8', `"label":"Sous-échantillons par image","default":${samples}`)
  .replace('"label":"Échelle de la résolution interne","default":1', `"label":"Échelle de la résolution interne","default":${scale}`)
  .replace('"label":"Décalage de lecture (s)","default":0', `"label":"Décalage de lecture (s)","default":${start}`);
html = html.replace(`data-start="0" data-duration="${dur}" data-track-index="2" data-volume="1"`, `data-start="0" data-duration="${dur}" data-track-index="2" data-volume="1" data-media-start="${start}"`);
fs.writeFileSync(`pilot/test-${name}.html`, html);
console.log(`pilot/test-${name}.html : t=${start}..${+start + +dur}s, samples=${samples}, scale=${scale}`);
