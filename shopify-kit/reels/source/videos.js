// Reel « présentation de la boutique » : accroche, 9 produits, carte de fin.
(() => {
const { W, C, prog, easeOut, fill, dots, sticker, bigText, spin, card, brand, flash } = window.V;

const PRODUCTS = [
  ['puzzle', 'Puzzle de chasse', '26,99 €'],
  ['canne', 'Canne à plumes', '11,99 €'],
  ['peluche', 'Peluche à l’herbe à chat', '9,99 €'],
  ['balle', 'Balle à friandises', '14,99 €'],
  ['garnir', 'Balle à garnir', 'dès 9,99 €'],
  ['gamelle', 'Gamelle inclinée', '14,99 €'],
  ['brosse', 'Brosse autonettoyante', '12,99 €'],
  ['peigne', 'Peigne démêloir', '14,99 €'],
  ['kit', 'Kit empreinte de patte', 'dès 6,99 €'],
];
const BG = [C.cobalt, C.pink, C.mint, C.sun, C.cobalt, C.pink, C.mint, C.sun, C.cobalt];
const HOOK = 2.4;
const SHOT = 1.5;
const END = HOOK + PRODUCTS.length * SHOT;
const IMG = {};

const VIDEOS = {
  boutique: {
    duration: END + 3.1,
    draw(t) {
      if (t < HOOK) {
        fill(C.sun);
        dots();
        spin(t, { y: 1300, size: 600 });
        bigText(['9 TROUVAILLES'], { y: 640, size: 128, color: '#fff', stroke: C.ink, p: prog(t, 0.05, 0.4), rot: -3 });
        sticker('pour ton chat et ton chien', { y: 860, size: 72, bg: C.paper, rot: 2, p: prog(t, 0.5, 0.85), maxW: 1000 });
        brand(easeOut(prog(t, 0, 0.3)));
      } else if (t < END) {
        const i = Math.floor((t - HOOK) / SHOT);
        const lt = t - HOOK - i * SHOT;
        const [key, name, price] = PRODUCTS[i];
        const dark = BG[i] === C.cobalt;
        fill(BG[i]);
        dots(dark ? 'rgba(255,255,255,0.14)' : 'rgba(20,22,43,0.12)');
        card(IMG[key], { x: W / 2, y: 930, w: 820, rot: i % 2 ? 3 : -3, p: prog(lt, 0, 0.3) });
        sticker(name, { y: 390, size: 68, bg: C.paper, rot: i % 2 ? 2 : -2, p: prog(lt, 0.1, 0.4), maxW: 1040 });
        sticker(price, { y: 1460, size: 96, bg: dark ? C.sun : C.ink, fg: dark ? C.ink : '#fff', rot: i % 2 ? -3 : 3, p: prog(lt, 0.3, 0.6) });
        brand(1);
      } else {
        const lt = t - END;
        fill(C.sun);
        dots();
        spin(t, { y: 760, size: 600 });
        sticker('Lien en bio', { y: 420, size: 80, bg: C.pink, rot: -4, p: prog(lt, 0.9, 1.25) });
        bigText(['Livraison offerte', 'dès 25 €'], { y: 1170, size: 110, color: C.ink, p: prog(lt, 0.1, 0.5), rot: -2 });
        sticker('France · UE · Suisse', { y: 1390, size: 64, bg: C.mint, rot: 2, p: prog(lt, 0.5, 0.85) });
        brand(1);
      }
      for (let k = 0; k <= PRODUCTS.length; k++) flash(t, HOOK + k * SHOT, 0.12);
    },
  },
};

window.setup = async (name) => {
  await document.fonts.load('800 80px "Bricolage Grotesque"');
  await Promise.all(PRODUCTS.map(async ([k]) => { IMG[k] = await window.V.loadImage(`img/${k}.jpg`); }));
  await window.V.loadSpin('spin');
  return VIDEOS[name].duration;
};
window.drawAt = (name, t) => VIDEOS[name].draw(t);
})();
