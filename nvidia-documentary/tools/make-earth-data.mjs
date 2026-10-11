#!/usr/bin/env node
// Données de la Terre pour le globe de la vidéo verticale : masque terre/mer 1024x512 (équirectangulaire,
// 1 bit par pixel) et principales villes, tirés de Natural Earth (domaine public, naturalearthdata.com).
// Usage : node tools/make-earth-data.mjs   (lit tools/.cache/ne_50m_land.geojson et ne_50m_populated_places_simple.geojson)
// Sortie : tiktok/src/lib/earth-data.js
import fs from 'node:fs';

const W = 1024, H = 512;
const land = JSON.parse(fs.readFileSync('tools/.cache/ne_50m_land.geojson', 'utf8'));
const bits = new Uint8Array(W * H);

function fillPolygon(rings) {
  // Remplissage par lignes de balayage, règle pair/impair (les trous sont des anneaux supplémentaires).
  const edges = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = [((ring[i][0] + 180) / 360) * W, ((90 - ring[i][1]) / 180) * H];
      const [x2, y2] = [((ring[i + 1][0] + 180) / 360) * W, ((90 - ring[i + 1][1]) / 180) * H];
      if (y1 !== y2) edges.push([x1, y1, x2, y2]);
    }
  }
  let ymin = H, ymax = 0;
  for (const e of edges) { ymin = Math.min(ymin, e[1], e[3]); ymax = Math.max(ymax, e[1], e[3]); }
  for (let y = Math.max(0, Math.floor(ymin)); y <= Math.min(H - 1, Math.ceil(ymax)); y++) {
    const yc = y + 0.5;
    const xs = [];
    for (const [x1, y1, x2, y2] of edges) {
      if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) xs.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.max(0, Math.ceil(xs[i] - 0.5)); x <= Math.min(W - 1, Math.floor(xs[i + 1] - 0.5)); x++) bits[y * W + x] = 1;
    }
  }
}
for (const f of land.features) {
  const g = f.geometry;
  if (g.type === 'Polygon') fillPolygon(g.coordinates);
  else if (g.type === 'MultiPolygon') for (const p of g.coordinates) fillPolygon(p);
}
// Antarctique : on le retire (pôle, sans intérêt visuel et lourd en points).
for (let y = Math.floor(H * (90 + 62) / 180); y < H; y++) for (let x = 0; x < W; x++) bits[y * W + x] = 0;

const packed = new Uint8Array((W * H) / 8);
for (let i = 0; i < W * H; i++) if (bits[i]) packed[i >> 3] |= 0x80 >> (i & 7);

const pp = JSON.parse(fs.readFileSync('tools/.cache/ne_50m_populated_places_simple.geojson', 'utf8'));
const cities = pp.features
  .map((f) => ({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], pop: f.properties.pop_max || 0 }))
  .filter((c) => c.pop > 0)
  .sort((a, b) => b.pop - a.pop)
  .slice(0, 420)
  .map((c) => [+c.lon.toFixed(2), +c.lat.toFixed(2), Math.round(c.pop / 1000)]);

const landCount = bits.reduce((s, v) => s + v, 0);
const out = `// Généré par tools/make-earth-data.mjs — données Natural Earth (domaine public). Ne pas éditer à la main.
export const LAND_W = ${W};
export const LAND_H = ${H};
export const LAND_B64 = '${Buffer.from(packed).toString('base64')}';
// [longitude, latitude, population (milliers)] des ${cities.length} plus grandes agglomérations.
export const CITIES = ${JSON.stringify(cities)};
`;
fs.writeFileSync('tiktok/src/lib/earth-data.js', out);
console.log(`terre : ${(100 * landCount / (W * H)).toFixed(1)} % des pixels, ${cities.length} villes, ${(out.length / 1024).toFixed(0)} Ko`);
