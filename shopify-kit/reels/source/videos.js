// Reel « présentation de la boutique » : accroche, 9 produits, carte de fin.
(() => {
const { W, C, ctx, prog, easeOut, pop, fill, dots, sticker, bigText, spin, card, brand, flash, roundRect } = window.V;

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
const HOOK = 1.8;
const SHOT = 1.0;
const END = HOOK + PRODUCTS.length * SHOT;
const IMG = {};

// Image de la boutique, entière (sans recadrage), dans un cadre arrondi.
function shopImage(p) {
  if (p <= 0) return;
  const im = IMG.shop;
  const s = Math.min(900 / im.width, 960 / im.height);
  const w = im.width * s;
  const h = im.height * s;
  ctx.save();
  ctx.translate(W / 2, 870);
  ctx.rotate((-2 * Math.PI) / 180);
  const k = pop(p);
  ctx.scale(k, k);
  roundRect(-w / 2 + 16, -h / 2 + 16, w, h, 40);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.save();
  roundRect(-w / 2, -h / 2, w, h, 40);
  ctx.clip();
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.restore();
  roundRect(-w / 2, -h / 2, w, h, 40);
  ctx.lineWidth = 8;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();
}

const VIDEOS = {
  boutique: {
    duration: END + 3.0,
    draw(t) {
      if (t < HOOK) {
        fill(C.sun);
        dots();
        spin(t, { y: 1300, size: 600 });
        bigText(['9 TROUVAILLES'], { y: 640, size: 128, color: '#fff', stroke: C.ink, p: prog(t, 0.0, 0.3), rot: -3 });
        sticker('pour ton chat et ton chien', { y: 860, size: 72, bg: C.paper, rot: 2, p: prog(t, 0.35, 0.65), maxW: 1000 });
        brand(easeOut(prog(t, 0, 0.3)));
      } else if (t < END) {
        const i = Math.floor((t - HOOK) / SHOT);
        const lt = t - HOOK - i * SHOT;
        const [key, name] = PRODUCTS[i];
                fill(BG[i]);
        dots(BG[i] === C.cobalt ? 'rgba(255,255,255,0.14)' : 'rgba(20,22,43,0.12)');
        card(IMG[key], { x: W / 2, y: 980, w: 880, rot: i % 2 ? 3 : -3, p: prog(lt, 0, 0.2) });
        sticker(name, { y: 390, size: 68, bg: C.paper, rot: i % 2 ? 2 : -2, p: prog(lt, 0.05, 0.3), maxW: 1040 });
        brand(1);
      } else {
        const lt = t - END;
        fill(C.sun);
        dots();
        shopImage(prog(lt, 0, 0.3));
        sticker('Lien en bio', { y: 250, size: 76, bg: C.pink, rot: -4, p: prog(lt, 0.6, 0.9) });
        sticker('Livraison offerte dès 25 €', { y: 1420, size: 70, bg: C.paper, rot: 2, p: prog(lt, 0.3, 0.6), maxW: 1000 });
        sticker('France · UE · Suisse', { y: 1560, size: 56, bg: C.mint, rot: -2, p: prog(lt, 0.45, 0.75) });
      }
      for (let k = 0; k <= PRODUCTS.length; k++) flash(t, HOOK + k * SHOT, 0.12);
    },
  },
};

window.setup = async (name) => {
  await document.fonts.load('800 80px "Bricolage Grotesque"');
  await Promise.all(PRODUCTS.map(async ([k]) => { IMG[k] = await window.V.loadImage(`img/${k}.jpg`); }));
  IMG.shop = await window.V.loadImage('img/shop.jpg');
  await window.V.loadSpin('spin');
  return VIDEOS[name].duration;
};
window.drawAt = (name, t) => VIDEOS[name].draw(t);
})();
