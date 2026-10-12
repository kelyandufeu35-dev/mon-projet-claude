// Les trois vidéos TikTok. Chaque vidéo : durée + fonction draw(t).
(() => {
const { W, H, C, prog, easeOut, easeInOut, photo, fill, dots, sticker, bigText, rain, spin, card, brand, flash, kibble } = window.V;

const IMG = {};

// Carte de fin commune : prix, livraison, appel à l'action.
function endCard(t, t0, { deal } = {}) {
  const p = (a, b) => prog(t, t0 + a, t0 + b);
  fill(C.sun);
  dots();
  spin(t, { y: 760, size: 760 });
  bigText(['14,99 €'], { y: 1210, size: 190, color: C.ink, p: p(0.15, 0.55), rot: -3 });
  sticker('Livraison offerte', { y: 1380, size: 64, bg: C.mint, rot: 2, p: p(0.45, 0.85) });
  if (deal) sticker(deal, { y: 1515, size: 52, bg: C.pink, rot: -2, p: p(0.7, 1.1) });
  sticker('Lien en bio', { y: 470, size: 70, bg: C.paper, rot: -4, p: p(0.95, 1.35) });
  brand(easeOut(p(0, 0.4)));
}

const VIDEOS = {
  // 1. Chien : « POV : ton chien s'ennuie quand tu pars »
  chien: {
    duration: 15,
    draw(t) {
      if (t < 3.2) {
        photo(IMG.chien, 1.04 + 0.1 * easeInOut(prog(t, 0, 3.2)), 0.74, 0.4);
        sticker('POV : ton chien s’ennuie quand tu pars', { y: 330, size: 84, bg: C.paper, rot: -3, p: prog(t, 0.15, 0.6) });
      } else if (t < 6.6) {
        const lt = t - 3.2;
        fill(C.sun);
        dots();
        rain(t, 3.2, 14, 700);
        spin(t, { y: 1020, size: 900 });
        sticker('La balle qui libère ses croquettes', { y: 470, size: 80, bg: C.pink, rot: 2, p: prog(lt, 0.1, 0.5) });
      } else if (t < 10.2) {
        const lt = t - 6.6;
        fill(C.cobalt);
        dots('rgba(255,255,255,0.14)');
        card(IMG.face, { x: W / 2, y: 1240, w: 640, rot: -4, p: prog(lt, 0, 0.4) });
        sticker('Il la pousse', { y: 380, size: 70, bg: C.sun, rot: -3, p: prog(lt, 0.2, 0.55) });
        sticker('Elle roule', { y: 560, size: 70, bg: C.mint, rot: 2, p: prog(lt, 0.9, 1.25) });
        sticker('Les croquettes tombent une à une', { y: 760, size: 64, bg: C.pink, rot: -2, p: prog(lt, 1.6, 1.95) });
      } else if (t < 12.6) {
        const lt = t - 10.2;
        photo(IMG.chien, 1.16 - 0.12 * easeOut(prog(lt, 0, 2.4)), 0.3, 0.6);
        sticker('Occupé, même sans toi', { y: 330, size: 84, bg: C.sun, rot: -2, p: prog(lt, 0.1, 0.5) });
      } else {
        endCard(t, 12.6, { deal: '3 balles : 11,99 € pièce' });
      }
      flash(t, 3.2);
      flash(t, 6.6);
      flash(t, 10.2);
      flash(t, 12.6);
    },
  },

  // 2. Chat : « Ton chat mange trop vite ? »
  chat: {
    duration: 15,
    draw(t) {
      if (t < 3.2) {
        photo(IMG.chat, 1.04 + 0.1 * easeInOut(prog(t, 0, 3.2)), 0.86, 0.35);
        sticker('Ton chat vide sa gamelle en 10 secondes ?', { y: 330, size: 80, bg: C.paper, rot: -3, p: prog(t, 0.15, 0.6) });
      } else if (t < 6.6) {
        const lt = t - 3.2;
        fill(C.pink);
        dots();
        rain(t, 3.2, 14, 700);
        spin(t, { y: 1020, size: 900 });
        sticker('Chaque croquette se mérite', { y: 470, size: 84, bg: C.sun, rot: 2, p: prog(lt, 0.1, 0.5) });
      } else if (t < 10.2) {
        const lt = t - 6.6;
        fill(C.mint);
        dots();
        const steps = [
          ['1', 'Remplis de croquettes', C.sun],
          ['2', 'Pose la balle au sol', C.pink],
          ['3', 'Il joue, il mange doucement', C.paper],
        ];
        steps.forEach(([n, txt, bg], i) => {
          const p = prog(lt, 0.15 + i * 0.75, 0.5 + i * 0.75);
          sticker(`${n}. ${txt}`, { y: 560 + i * 260, size: 66, bg, rot: i % 2 ? 2 : -2, p });
        });
        sticker('Comment ça marche', { y: 330, size: 56, bg: C.paper, rot: -3, p: prog(lt, 0, 0.3) });
      } else if (t < 12.6) {
        const lt = t - 10.2;
        photo(IMG.chat, 1.16 - 0.12 * easeOut(prog(lt, 0, 2.4)), 0.32, 0.6);
        sticker('Des repas plus lents, un chat qui joue', { y: 330, size: 78, bg: C.sun, rot: -2, p: prog(lt, 0.1, 0.5) });
      } else {
        endCard(t, 12.6, { deal: 'Pour chats et petits chiens' });
      }
      flash(t, 3.2);
      flash(t, 6.6);
      flash(t, 10.2);
      flash(t, 12.6);
    },
  },

  // 3. « 3 raisons d'adopter la balle Pattoune »
  raisons: {
    duration: 15,
    draw(t) {
      if (t < 2.8) {
        fill(C.cobalt);
        dots('rgba(255,255,255,0.14)');
        spin(t, { y: 1120, size: 820 });
        bigText(['3 raisons', 'd’adopter', 'la balle'], { y: 560, size: 130, color: '#fff', stroke: C.ink, p: prog(t, 0.1, 0.5), rot: -3 });
      } else if (t < 6) {
        const lt = t - 2.8;
        fill(C.sun);
        dots();
        card(IMG.chien, { x: W / 2, y: 1180, w: 760, rot: -3, p: prog(lt, 0, 0.35) });
        sticker('1. Elle l’occupe quand tu pars', { y: 470, size: 74, bg: C.paper, rot: -2, p: prog(lt, 0.2, 0.55) });
      } else if (t < 9.2) {
        const lt = t - 6;
        fill(C.pink);
        dots();
        card(IMG.chat, { x: W / 2, y: 1180, w: 760, rot: 3, p: prog(lt, 0, 0.35) });
        sticker('2. Elle ralentit les gloutons', { y: 470, size: 74, bg: C.sun, rot: 2, p: prog(lt, 0.2, 0.55) });
      } else if (t < 12.2) {
        const lt = t - 9.2;
        fill(C.mint);
        dots();
        rain(t, 9.2, 12, 650);
        spin(t, { y: 1080, size: 860 });
        sticker('3. Elle fait travailler son flair', { y: 470, size: 74, bg: C.paper, rot: -2, p: prog(lt, 0.2, 0.55) });
      } else {
        endCard(t, 12.2, { deal: '2 balles : 12,74 € pièce' });
      }
      flash(t, 2.8);
      flash(t, 6);
      flash(t, 9.2);
      flash(t, 12.2);
    },
  },
};

window.setup = async (name) => {
  await document.fonts.load('800 80px "Bricolage Grotesque"');
  const [chien, chat, face] = await Promise.all(['photos/balle-pattoune-chien.jpg', 'photos/balle-pattoune-chat.jpg', 'photos/balle-pattoune-1-face.jpg'].map(window.V.loadImage));
  Object.assign(IMG, { chien, chat, face });
  await window.V.loadSpin('spin');
  return VIDEOS[name].duration;
};
window.drawAt = (name, t) => VIDEOS[name].draw(t);
})();
