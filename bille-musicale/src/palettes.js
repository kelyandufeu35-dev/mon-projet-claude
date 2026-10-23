// Palettes et couleurs des plateformes.

export const PALETTES = {
  neon: { label: 'Néon', bgTop: '#1a0f3d', bgBottom: '#05030f', ball: '#f2f4ff', low: '#ff3d8b', mid: '#ffc23d', high: '#3dd6ff' },
  ocean: { label: 'Océan', bgTop: '#08324a', bgBottom: '#020b14', ball: '#eafcff', low: '#2a6bff', mid: '#19d3c5', high: '#b8ff6b' },
  sunset: { label: 'Coucher de soleil', bgTop: '#45123f', bgBottom: '#12040f', ball: '#fff3e6', low: '#ff4d5e', mid: '#ff9a3d', high: '#ffe066' },
  candy: { label: 'Bonbon', bgTop: '#3a1d52', bgBottom: '#150a24', ball: '#ffffff', low: '#ff8fd1', mid: '#b59cff', high: '#8fe8ff' },
  gold: { label: 'Or et nuit', bgTop: '#1c1c26', bgBottom: '#060608', ball: '#fff7e0', low: '#b8862e', mid: '#f2c45a', high: '#fff0b8' },
};

export const COLOR_MODES = {
  pitch: 'Selon la hauteur',
  note: 'Une couleur par note',
  single: 'Couleur unique',
};

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? [...h].map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function toHsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

// Interpolation par la teinte (le chemin le plus court) : évite les couleurs grises à mi-chemin.
function mixHue(a, b, t) {
  const [h1, s1, l1] = toHsl(a);
  const [h2, s2, l2] = toHsl(b);
  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  if (!s1) return hsl(h2, s1 + (s2 - s1) * t, l1 + (l2 - l1) * t);
  if (!s2) return hsl(h1, s1 + (s2 - s1) * t, l1 + (l2 - l1) * t);
  return hsl((h1 + dh * t + 360) % 360, s1 + (s2 - s1) * t, l1 + (l2 - l1) * t);
}

export function platformColor(colors, mode, midi, minMidi, maxMidi) {
  if (mode === 'note') return hsl((((midi % 12) * 7) % 12) * 30, 0.85, 0.62); // cycle des quintes
  const low = hexToRgb(colors.low);
  const mid = hexToRgb(colors.mid);
  const high = hexToRgb(colors.high);
  if (mode === 'single') return mid;
  const t = maxMidi > minMidi ? (midi - minMidi) / (maxMidi - minMidi) : 0.5;
  return t < 0.5 ? mixHue(low, mid, t * 2) : mixHue(mid, high, (t - 0.5) * 2);
}

const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

// Même palette, teintes tournées de `deg` degrés (pour faire évoluer une palette personnalisée).
export function rotateColors(colors, deg) {
  const out = {};
  for (const [k, hex] of Object.entries(colors)) {
    if (typeof hex !== 'string' || k === 'ball' || k === 'label') {
      out[k] = hex;
      continue;
    }
    const [h, s, l] = toHsl(hexToRgb(hex));
    out[k] = toHex(hsl((h + deg + 360) % 360, s, l));
  }
  return out;
}
