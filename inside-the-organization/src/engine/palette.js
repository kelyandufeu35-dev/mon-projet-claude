// Palette : rouge, jaune, blanc, gris (+ un cyan réservé aux liaisons de coordination).
export const C = {
  red: 0xda291c,
  redDeep: 0x9e1b12,
  redHot: 0xff4638,
  yellow: 0xffc72c,
  yellowSoft: 0xffe08a,
  gold: 0xf2a900,
  white: 0xf4f3ef,
  paper: 0xe6e5e1,
  grey1: 0xcfd2d6,
  grey2: 0x9ca1a8,
  grey3: 0x6a7078,
  grey4: 0x42464d,
  charcoal: 0x25272d,
  ink: 0x15161a,
  glass: 0x9fb2c0,
  cyan: 0x74d7ff,
  skin: [0xf2c6a0, 0xe0a979, 0xc68642, 0x8d5524, 0xffdbb4, 0x6b4226],
  hair: [0x1b1b1d, 0x3b2a20, 0x6b4a2f, 0xb88a4a, 0x8a8f98, 0xa63a1e],
};

// Les quatre types de relations de la vidéo.
export const LINK = {
  gouvernance: { color: 0xffffff, name: 'Gouvernance' },
  hierarchie: { color: 0xff4638, name: 'Hiérarchie interne' },
  contrat: { color: 0xffc72c, name: 'Relations contractuelles' },
  coordination: { color: 0x74d7ff, name: 'Coordination entre fonctions' },
};

export const css = (hex) => '#' + hex.toString(16).padStart(6, '0');
