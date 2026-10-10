// HUD global : titre de scène, avertissement permanent, sources datées, sous-titres.
import { SC, seg } from "./timing.js";
import { ln } from "./core/lang.js";

const TITLES = [
  ["s1", "01", ln("Le mystère de sa fortune", "The mystery of his fortune")],
  ["s2", "02", ln("Tesla : posséder une part d'entreprise", "Tesla: owning a share of a company")],
  ["s3", "03", ln("SpaceX et l'intelligence artificielle", "SpaceX and artificial intelligence")],
  ["s4", "04", ln("Pourquoi sa fortune varie", "Why his fortune moves")],
  ["s5", "05", ln("Milliardaire ≠ argent liquide", "Billionaire ≠ cash")],
  ["s6", "06", ln("Emprunter grâce à ses actions", "Borrowing against his shares")],
  ["s7", "07", ln("La structure complète de sa richesse", "The full structure of his wealth")],
];

const SOURCES = {
  s1: ln("Sources : Forbes, profil Elon Musk (10 oct. 2026) · Bloomberg Billionaires Index (5 oct. 2026) — estimations, pas des certitudes", "Sources: Forbes, Elon Musk profile (Oct 10, 2026) · Bloomberg Billionaires Index (Oct 5, 2026) — estimates, not certainties"),
  s2: ln("Sources : Tesla 10-K/A et Form 4 (juin 2026) · profil Forbes — ≈ 11 % estimé, hors actions restreintes non acquises", "Sources: Tesla 10-K/A and Form 4 (June 2026) · Forbes profile — ≈ 11% estimated, excluding unvested restricted shares"),
  s3: ln("Sources : CNBC (3 fév. 2026) · SpaceX S-1/A (3 juin 2026) · Forbes — fusion close le 2 fév. 2026 ; pourcentages estimés", "Sources: CNBC (Feb 3, 2026) · SpaceX S-1/A (June 3, 2026) · Forbes — merger closed Feb 2, 2026; percentages estimated"),
  s4: ln("Exemple hypothétique, chiffres inventés · mesure réelle : Forbes, 2 oct. 2026 (+61 Md$ en une séance)", "Hypothetical example, made-up numbers · real measure: Forbes, Oct 2, 2026 (+$61B in one session)"),
  s5: ln("Définitions générales · liquidités personnelles : aucun chiffre fiable trouvé, donc aucun chiffre affiché", "General definitions · personal cash: no reliable figure found, so none is shown"),
  s6: ln("Mécanisme général, exemple hypothétique · aucune opération particulière d'Elon Musk n'est présentée comme un fait", "General mechanism, hypothetical example · no specific Elon Musk transaction is presented as fact"),
  s7: ln("Sources : Forbes (10 oct. 2026) · Bloomberg (5 oct. 2026) · Tesla, proxy 2025 (actions nanties au 29 août 2025) · SpaceX S-1/A (3 juin 2026)", "Sources: Forbes (Oct 10, 2026) · Bloomberg (Oct 5, 2026) · Tesla 2025 proxy (shares pledged as of Aug 29, 2025) · SpaceX S-1/A (June 3, 2026)"),
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
    id: "disclaimer", cls: "disclaimer", html: ln("ESTIMATIONS · MONTANTS DATÉS ET SOURCÉS · PAS DES SOLDES DE COMPTE", "ESTIMATES · DATED AND SOURCED AMOUNTS · NOT ACCOUNT BALANCES"), x: 1864, y: 56, align: "right",
    t0: 1.2, t1: SC.s7.t1 - 0.6, inD: 0.8, outD: 0.6, enter: "fade", p: { x: 540, y: 206, align: "center" },
  });
}

// la phrase finale s'affiche en grand à l'écran : pas de doublon en sous-titre
export const subtitleSegments = () => Object.values(seg).filter((s) => s.id !== "s7c");
