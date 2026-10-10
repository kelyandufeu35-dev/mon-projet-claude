// HUD global : titre de scène, avertissement permanent, sources datées, sous-titres.
import { SC, seg } from "./timing.js";

const TITLES = [
  ["s1", "01", "Le mystère de sa fortune"],
  ["s2", "02", "Tesla : posséder une part d'entreprise"],
  ["s3", "03", "SpaceX et l'intelligence artificielle"],
  ["s4", "04", "Pourquoi sa fortune varie"],
  ["s5", "05", "Milliardaire ≠ argent liquide"],
  ["s6", "06", "Emprunter grâce à ses actions"],
  ["s7", "07", "La structure complète de sa richesse"],
];

const SOURCES = {
  s1: "Sources : Forbes, profil Elon Musk (10 oct. 2026) · Bloomberg Billionaires Index (5 oct. 2026) — estimations, pas des certitudes",
  s2: "Sources : Tesla 10-K/A et Form 4 (juin 2026) · profil Forbes — ≈ 11 % estimé, hors actions restreintes non acquises",
  s3: "Sources : CNBC (3 fév. 2026) · SpaceX S-1/A (3 juin 2026) · Forbes — fusion close le 2 fév. 2026 ; pourcentages estimés",
  s4: "Exemple hypothétique, chiffres inventés · mesure réelle : Forbes, 2 oct. 2026 (+61 Md$ en une séance)",
  s5: "Définitions générales · liquidités personnelles : aucun chiffre fiable trouvé, donc aucun chiffre affiché",
  s6: "Mécanisme général, exemple hypothétique · aucune opération particulière d'Elon Musk n'est présentée comme un fait",
  s7: "Sources : Forbes (10 oct. 2026) · Bloomberg (5 oct. 2026) · Tesla, proxy 2025 (actions nanties au 29 août 2025) · SpaceX S-1/A (3 juin 2026)",
};

export function buildGlobalHud({ hud }) {
  for (const [k, n, title] of TITLES) {
    const s = SC[k];
    hud.card({
      id: "chip-" + k, cls: "chip", html: `<i>${n}</i> ${title}`, x: 56, y: 56, align: "left",
      t0: s.t0 + 0.5, t1: s.t1 - 0.2, inD: 0.5, outD: 0.3, enter: "right", p: { x: 44, y: 150, align: "left" },
    });
    hud.card({
      id: "src-" + k, cls: "srcline", html: SOURCES[k], x: 56, y: 1052, align: "left",
      t0: s.t0 + 0.6, t1: s.t1 - 0.1, inD: 0.6, outD: 0.3, enter: "fade", p: { x: 540, y: 1836, align: "center" },
    });
  }
  hud.card({
    id: "disclaimer", cls: "disclaimer", html: "ESTIMATIONS · MONTANTS DATÉS ET SOURCÉS · PAS DES SOLDES DE COMPTE", x: 1864, y: 56, align: "right",
    t0: 1.2, t1: SC.s7.t1 - 0.6, inD: 0.8, outD: 0.6, enter: "fade", p: { x: 540, y: 206, align: "center" },
  });
}

// la phrase finale s'affiche en grand à l'écran : pas de doublon en sous-titre
export const subtitleSegments = () => Object.values(seg).filter((s) => s.id !== "s7c");
