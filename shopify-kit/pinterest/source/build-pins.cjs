// Génère les 10 épingles Pinterest Pattoune (1000×1500, JPG) avec Playwright.
// Usage : NODE_PATH=/opt/node-tools/node_modules node shopify-kit/pinterest/source/build-pins.cjs [numéro]
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '..');
const f = (p) => 'file://' + path.join(ROOT, p);

const IMG = {
  chien: f('shopify-kit/photos/balle-pattoune-chien.jpg'),
  chat: f('shopify-kit/photos/balle-pattoune-chat.jpg'),
  face: f('shopify-kit/photos/balle-pattoune-1-face.jpg'),
  croq: f('shopify-kit/photos/balle-pattoune-2-croquettes.jpg'),
  taille: f('shopify-kit/photos/balle-pattoune-3-taille-8cm.jpg'),
  hero: f('shopify-theme/assets/pt-hero-poster.jpg'),
  balle3d: f('shopify-theme/assets/pt-balle-3d.webp'),
};

const FONTS = `
@font-face{font-family:'Bricolage Grotesque';font-weight:200 800;font-stretch:75% 100%;
  src:url(${f('shopify-theme/assets/bricolage-latin.woff2')}) format('woff2-variations');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}
@font-face{font-family:'Bricolage Grotesque';font-weight:200 800;font-stretch:75% 100%;
  src:url(${f('shopify-theme/assets/bricolage-latin-ext.woff2')}) format('woff2-variations');
  unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;}
@font-face{font-family:'Figtree';font-weight:300 900;
  src:url(${f('shopify-theme/assets/figtree-latin.woff2')}) format('woff2-variations');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}
@font-face{font-family:'Figtree';font-weight:300 900;
  src:url(${f('shopify-theme/assets/figtree-latin-ext.woff2')}) format('woff2-variations');
  unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;}
`;

const CSS = `
:root{--ink:#14162b;--ink2:#1d2040;--cream:#f6efe4;--paper:#fbf7f1;--sand:#eadfd0;--sun:#ffc23c;--red:#c4140f;--muted:#4a4a5e;--on-dark:#d6cfc8}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1000px;height:1500px;background:#000}
.pin{width:1000px;height:1500px;position:relative;overflow:hidden;font-family:'Figtree',sans-serif;color:var(--ink);background:var(--cream)}
.pin.dark{background:var(--ink);color:var(--cream)}
.pin.sun{background:var(--sun)}
.pad{padding:0 64px}
.tag{display:inline-block;font:800 25px/1 'Figtree';letter-spacing:.09em;text-transform:uppercase;padding:14px 24px 13px;border-radius:999px;background:var(--ink);color:var(--sun)}
.dark .tag{background:var(--sun);color:var(--ink)}
h1{font-family:'Bricolage Grotesque';font-weight:800;font-stretch:84%;letter-spacing:-.025em;line-height:1;font-size:108px;text-wrap:balance}
h1 .hl{display:inline-block;line-height:.9;background:var(--sun);color:var(--ink);padding:.03em .12em .07em;border-radius:.14em}
.sun h1 .hl{background:var(--ink);color:var(--sun)}
h1 .red{color:var(--red)}
.dark h1 .red{color:#ff6b5c}
.lead{font:600 34px/1.3 'Figtree';color:var(--muted);text-wrap:pretty}
.dark .lead{color:var(--on-dark)}
.sun .lead{color:#3b3420}

/* cartes numérotées */
.list{display:flex;flex-direction:column;gap:18px}
.item{display:flex;gap:24px;align-items:center;background:var(--paper);border:3px solid var(--ink);border-radius:24px;padding:20px 26px;box-shadow:6px 6px 0 var(--ink)}
.dark .item{background:var(--ink2);border-color:#3a3e66;box-shadow:none}
.num{flex:none;width:66px;height:66px;border-radius:50%;background:var(--sun);color:var(--ink);display:grid;place-items:center;font:800 38px/1 'Bricolage Grotesque';font-stretch:90%;border:3px solid var(--ink)}
.sun .num{background:var(--red);color:#fff}
.item b{display:block;font:800 36px/1.08 'Figtree';letter-spacing:-.01em}
.item b,.item span,.note div{text-wrap:pretty}
.item em{font-style:normal;color:var(--red)}
.item span{display:block;font:500 27px/1.25 'Figtree';color:var(--muted);margin-top:4px}
.dark .item span{color:var(--on-dark)}

.note{display:flex;gap:18px;align-items:center;border-radius:22px;padding:20px 26px;font:600 27px/1.3 'Figtree';background:var(--ink);color:var(--cream)}
.note strong{color:var(--sun);font-weight:800}
.dark .note{background:var(--cream);color:var(--ink)}
.dark .note strong{color:var(--red)}
.note.alert{background:var(--red);color:#fff}
.note.alert strong{color:#fff}
.note svg{flex:none}

/* pied de page */
.foot{position:absolute;left:64px;right:64px;bottom:44px;height:64px;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:12px;font:800 34px/1 'Bricolage Grotesque';font-stretch:88%;letter-spacing:-.01em;color:var(--ink)}
.dark .brand{color:var(--cream)}
.brand svg{width:46px;height:44px}
.cta{font:700 24px/1 'Figtree';opacity:.75}
.foot-line{position:absolute;left:64px;right:64px;bottom:128px;height:3px;background:currentColor;opacity:.12}

.photo{display:block;width:100%;height:100%;object-fit:cover}
.frame{border:3px solid var(--ink);border-radius:32px;overflow:hidden;box-shadow:8px 8px 0 var(--ink);background:var(--paper)}
.price{display:inline-flex;align-items:baseline;gap:10px;background:var(--sun);color:var(--ink);font:800 56px/1 'Bricolage Grotesque';font-stretch:88%;padding:16px 26px 14px;border-radius:20px;border:3px solid var(--ink)}
.chip{display:inline-flex;align-items:center;gap:10px;font:700 25px/1 'Figtree';padding:15px 18px;white-space:nowrap;border-radius:999px;border:3px solid var(--ink);background:var(--paper)}
.dot{width:14px;height:14px;border-radius:50%;background:var(--red);flex:none}
`;

const logo = (id = 'a') => `<svg viewBox="-330 -260 660 620" aria-hidden="true"><defs>
<clipPath id="c${id}"><circle cx="0" cy="175" r="165"/></clipPath>
<radialGradient id="s${id}" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#3a0000" stop-opacity=".55"/></radialGradient>
<pattern id="d${id}" width="70" height="70" patternUnits="userSpaceOnUse" x="-35" y="-35"><rect width="70" height="70" fill="#c4140f"/><path d="M35 0 70 35 35 70 0 35Z" fill="#d92a20"/><path d="M35 0 70 35H35Z" fill="#ef5a4a"/><path d="M0 35h35V0Z" fill="#e5463a"/><path d="M35 35h35L35 70Z" fill="#a80f0b"/></pattern></defs>
<g fill="currentColor"><ellipse cx="-250" cy="-30" rx="70" ry="90" transform="rotate(-28 -250 -30)"/><ellipse cx="-100" cy="-150" rx="74" ry="98" transform="rotate(-9 -100 -150)"/><ellipse cx="100" cy="-150" rx="74" ry="98" transform="rotate(9 100 -150)"/><ellipse cx="250" cy="-30" rx="70" ry="90" transform="rotate(28 250 -30)"/></g>
<g clip-path="url(#c${id})"><rect x="-200" y="-20" width="400" height="400" fill="url(#d${id})" transform="rotate(8 0 175)"/><circle cx="0" cy="175" r="165" fill="url(#s${id})"/></g></svg>`;

const foot = (cta) => `<div class="foot"><div class="brand">${logo('ft')}<span>Pattoune</span></div><div class="cta">${cta}</div></div>`;

const items = (arr) => `<div class="list">${arr.map(([t, s], i) => `<div class="item"><div class="num">${i + 1}</div><div><b>${t}</b>${s ? `<span>${s}</span>` : ''}</div></div>`).join('')}</div>`;

const eye = (c = 'currentColor') => `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const warn = (c = 'currentColor') => `<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>`;
const clock = (c = 'currentColor') => `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
const steth = (c = 'currentColor') => `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v6a5 5 0 0 0 10 0V3"/><path d="M10 14v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/></svg>`;

// Icônes simples pour les infographies (trait encre, accents rouge / jaune)
const ICON = {
  fill: `<svg viewBox="0 0 120 120"><circle cx="60" cy="70" r="40" fill="#c4140f" stroke="#14162b" stroke-width="5"/><path d="M38 52 60 40 82 52M30 74h60M42 98 60 86 78 98" stroke="#ef5a4a" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="60" cy="32" rx="14" ry="6" fill="#14162b"/><ellipse cx="50" cy="14" rx="8" ry="6" fill="#b8743d" stroke="#14162b" stroke-width="3"/><ellipse cx="70" cy="8" rx="8" ry="6" fill="#b8743d" stroke="#14162b" stroke-width="3"/><path d="M60 18v8" stroke="#14162b" stroke-width="4" stroke-linecap="round"/></svg>`,
  give: `<svg viewBox="0 0 120 120"><path d="M8 104h104" stroke="#14162b" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="72" r="30" fill="#c4140f" stroke="#14162b" stroke-width="5"/><path d="M42 62 60 52 78 62M34 78h52" stroke="#ef5a4a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M60 8v22M50 22l10 10 10-10" stroke="#14162b" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  play: `<svg viewBox="0 0 120 120"><circle cx="44" cy="58" r="30" fill="#c4140f" stroke="#14162b" stroke-width="5"/><path d="M26 48 44 38 62 48M18 64h52" stroke="#ef5a4a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M8 100c10-6 18-6 28 0" stroke="#14162b" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="2 9"/><ellipse cx="84" cy="94" rx="8" ry="6" fill="#b8743d" stroke="#14162b" stroke-width="3"/><ellipse cx="102" cy="86" rx="8" ry="6" fill="#b8743d" stroke="#14162b" stroke-width="3"/><ellipse cx="96" cy="104" rx="8" ry="6" fill="#b8743d" stroke="#14162b" stroke-width="3"/></svg>`,
  cherche: `<svg viewBox="0 0 120 120"><circle cx="50" cy="50" r="30" fill="#fbf7f1" stroke="#14162b" stroke-width="6"/><path d="M72 72l28 28" stroke="#14162b" stroke-width="10" stroke-linecap="round"/><ellipse cx="50" cy="50" rx="11" ry="8" fill="#b8743d" stroke="#14162b" stroke-width="3"/></svg>`,
  gobelets: `<svg viewBox="0 0 120 120"><g stroke="#14162b" stroke-width="4" stroke-linejoin="round"><path d="M10 92l6-46h20l6 46z" fill="#ffc23c"/><path d="M44 92l6-46h20l6 46z" fill="#c4140f"/><path d="M78 92l6-46h20l6 46z" fill="#ffc23c"/></g><path d="M4 96h112" stroke="#14162b" stroke-width="5" stroke-linecap="round"/><ellipse cx="60" cy="108" rx="9" ry="6" fill="#b8743d" stroke="#14162b" stroke-width="3"/></svg>`,
  serviette: `<svg viewBox="0 0 120 120"><path d="M30 84h80V60H30" fill="#ffc23c" stroke="#14162b" stroke-width="5" stroke-linejoin="round"/><circle cx="30" cy="72" r="26" fill="#ffc23c" stroke="#14162b" stroke-width="5"/><path d="M30 72m-14 0a14 14 0 1 0 14-14" fill="none" stroke="#14162b" stroke-width="4" stroke-linecap="round"/><path d="M50 66h46M50 78h46" stroke="#c4140f" stroke-width="4" stroke-linecap="round"/><ellipse cx="80" cy="102" rx="8" ry="6" fill="#b8743d" stroke="#14162b" stroke-width="3"/><ellipse cx="100" cy="98" rx="8" ry="6" fill="#b8743d" stroke="#14162b" stroke-width="3"/></svg>`,
  carton: `<svg viewBox="0 0 120 120"><path d="M18 50h84v52H18z" fill="#d9a46a" stroke="#14162b" stroke-width="5" stroke-linejoin="round"/><path d="M18 50 6 32h48l12 18M102 50l12-18H66" fill="#e8bd86" stroke="#14162b" stroke-width="5" stroke-linejoin="round"/><path d="M34 50c4-14 14-18 22-10 6-10 20-8 22 4 6-2 12 2 12 6" fill="#fbf7f1" stroke="#14162b" stroke-width="4" stroke-linejoin="round"/><ellipse cx="60" cy="76" rx="9" ry="6" fill="#b8743d" stroke="#14162b" stroke-width="3"/></svg>`,
  calme: `<svg viewBox="0 0 120 120"><path d="M14 70c0-26 20-40 46-40s46 14 46 40v14H14z" fill="#ffc23c" stroke="#14162b" stroke-width="5" stroke-linejoin="round"/><path d="M10 84h100v14H10z" fill="#c4140f" stroke="#14162b" stroke-width="5" stroke-linejoin="round"/><path d="M80 14h14l-14 14h14M64 26h9l-9 9h9" stroke="#14162b" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ration: `<svg viewBox="0 0 120 120"><path d="M10 64h100c0 22-20 38-50 38S10 86 10 64z" fill="#c4140f" stroke="#14162b" stroke-width="5" stroke-linejoin="round"/><path d="M60 14v40M48 26c0-8 24-8 24 0" stroke="#14162b" stroke-width="0"/><ellipse cx="38" cy="56" rx="9" ry="6" fill="#b8743d" stroke="#14162b" stroke-width="3"/><ellipse cx="60" cy="52" rx="9" ry="6" fill="#b8743d" stroke="#14162b" stroke-width="3"/><ellipse cx="82" cy="56" rx="9" ry="6" fill="#b8743d" stroke="#14162b" stroke-width="3"/><path d="M60 8v30M48 26l12 12 12-12" stroke="#14162b" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  gamelle: `<svg viewBox="0 0 120 120"><path d="M10 60h100c0 24-20 40-50 40S10 84 10 60z" fill="#ffc23c" stroke="#14162b" stroke-width="5" stroke-linejoin="round"/><ellipse cx="60" cy="60" rx="50" ry="12" fill="#fbf7f1" stroke="#14162b" stroke-width="5"/><path d="M38 60c0-10 44-10 44 0M50 60c0-5 20-5 20 0" stroke="#c4140f" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
  eparpille: `<svg viewBox="0 0 120 120"><g fill="#b8743d" stroke="#14162b" stroke-width="3"><ellipse cx="20" cy="40" rx="9" ry="6"/><ellipse cx="56" cy="24" rx="9" ry="6"/><ellipse cx="96" cy="44" rx="9" ry="6"/><ellipse cx="36" cy="76" rx="9" ry="6"/><ellipse cx="78" cy="80" rx="9" ry="6"/><ellipse cx="22" cy="104" rx="9" ry="6"/><ellipse cx="100" cy="106" rx="9" ry="6"/><ellipse cx="60" cy="54" rx="9" ry="6"/></g></svg>`,
  tapis: `<svg viewBox="0 0 120 120"><rect x="8" y="34" width="104" height="60" rx="12" fill="#c4140f" stroke="#14162b" stroke-width="5"/><g stroke="#ffc23c" stroke-width="7" stroke-linecap="round"><path d="M24 50v28M42 50v28M60 50v28M78 50v28M96 50v28"/></g><ellipse cx="51" cy="64" rx="7" ry="5" fill="#b8743d" stroke="#14162b" stroke-width="3"/></svg>`,
};

const PINS = [
  // ---------- 4 CONSEILS ----------
  {
    file: 'pin-01-conseil-occuper-chien-seul.jpg', cls: 'dark',
    body: `
    <div class="pad" style="padding-top:76px">
      <span class="tag">Conseil · Chien</span>
      <h1 style="margin-top:30px;font-size:108px">5 idées pour occuper ton chien <span class="hl">seul</span> à la maison</h1>
      <div style="margin-top:38px">${items([
        ['Une vraie balade avant de partir', 'Laisse-le renifler : ça fatigue aussi.'],
        ['Un coin calme et sûr', 'Panier, eau fraîche, rien à avaler.'],
        ['Des croquettes cachées', 'Prises dans sa ration, cachettes faciles.'],
        ['Un jeu de recherche avant ton départ', 'Avec toi, puis tu ranges le jouet.'],
        ['Des absences courtes au début', 'Puis plus longues, toujours sur un succès.'],
      ]).replace(/class="item"/g, 'class="item" style="padding:15px 26px"').replace('class="list"','class="list" style="gap:14px"')}</div>
      <div class="note" style="margin-top:26px">${eye('#c4140f')}<div>Un petit jouet comme la balle à friandises s’utilise <strong>uniquement sous ta surveillance.</strong></div></div>
    </div>
    <div class="foot-line"></div>${foot('Lis l’article sur le blog →')}`,
  },
  {
    file: 'pin-02-conseil-chat-s-ennuie.jpg', cls: '',
    body: `
    <div style="position:absolute;left:0;top:0;width:1000px;height:640px;overflow:hidden">
      <img class="photo" src="${IMG.chat}" style="object-position:50% 30%">
    </div>
    <div style="position:absolute;left:0;right:0;top:590px;bottom:0;background:var(--cream);border-radius:60px 60px 0 0"></div>
    <div class="pad" style="position:absolute;left:0;right:0;top:560px">
      <span class="tag" style="box-shadow:0 0 0 8px var(--cream)">Conseil · Chat</span>
      <h1 style="margin-top:26px;font-size:100px">Ton chat s’ennuie ?<br><span class="red">6 signes</span> à repérer</h1>
      <div style="margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
        ${['Bêtises à répétition', 'Miaulements insistants', 'Courses folles la nuit', 'Attaques de chevilles', 'Réclame à manger sans arrêt', 'Semble éteint, sans envie']
          .map((t, i) => `<div class="item" style="padding:16px 18px;gap:14px;box-shadow:5px 5px 0 var(--ink)"><div class="num" style="width:52px;height:52px;font-size:30px">${i + 1}</div><b style="font-size:28px;line-height:1.12">${t}</b></div>`).join('')}
      </div>
      <div class="note" style="margin-top:22px;font-size:25px;padding:16px 24px">${steth('#ffc23c')}<div>Un changement soudain ? <strong>Demande d’abord l’avis de ton vétérinaire.</strong></div></div>
    </div>
    <div class="foot-line"></div>${foot('Signes + solutions sur le blog →')}`,
  },
  {
    file: 'pin-03-conseil-choisir-balle-distributrice.jpg', cls: 'sun',
    body: `
    <div class="pad" style="padding-top:72px">
      <span class="tag">Guide d’achat</span>
      <h1 style="margin-top:30px;font-size:100px">Balle à croquettes :<br>comment bien la <span class="hl">choisir</span></h1>
    </div>
    <div style="position:absolute;right:-120px;top:520px;width:430px;height:430px;border-radius:50%;overflow:hidden;border:3px solid var(--ink);box-shadow:8px 8px 0 var(--ink)">
      <img class="photo" src="${IMG.croq}" style="transform:scale(1.5);object-position:50% 45%">
    </div>
    <div class="pad" style="position:absolute;left:0;top:500px;width:670px;padding-right:0">
      ${items([
        ['La taille', 'Assez grande pour ne pas être avalée.'],
        ['La matière', 'Souple, plus discrète au sol.'],
        ['L’ouverture', 'Tes croquettes doivent passer.'],
        ['La forme', 'Facettes : elle s’arrête et repart.'],
        ['L’entretien', 'Facile à rincer et à sécher.'],
      ]).replace(/class="item"/g, 'class="item" style="padding:22px 24px"')}
    </div>
    <div class="foot-line"></div>${foot('Les 5 critères sur le blog →')}`,
  },
  {
    file: 'pin-04-conseil-regles-jeux-de-flair.jpg', cls: '',
    body: `
    <div class="pad" style="padding-top:72px">
      <span class="tag">Conseil · Chien &amp; chat</span>
      <h1 style="margin-top:30px;font-size:110px">Jeux de flair :<br>les <span class="hl">5 règles d’or</span></h1>
    </div>
    <div class="frame" style="position:absolute;left:64px;right:64px;top:420px;height:290px">
      <img class="photo" src="${IMG.chien}" style="object-position:50% 50%">
    </div>
    <div class="pad" style="position:absolute;left:0;right:0;top:744px">
      ${items([
        ['Des séances courtes', 'Arrête quand il en redemande.'],
        ['Commence facile', 'Il doit réussir vite pour comprendre.'],
        ['Finis sur une réussite', 'Il garde l’envie de jouer.'],
        ['Puise dans sa ration', 'Pas de croquettes en plus.'],
        ['Reste présent', 'Et retire ce qu’il abîme.'],
      ]).replace(/class="item"/g, 'class="item" style="padding:10px 22px"').replace('class="list"','class="list" style="gap:14px"').replace(/class="num"/g, 'class="num" style="width:54px;height:54px;font-size:30px"')}
    </div>
    <div class="foot-line"></div>${foot('Idées de jeux sur le blog →')}`,
  },

  // ---------- 3 PRODUIT ----------
  {
    file: 'pin-05-produit-balle-a-friandises.jpg', cls: 'dark',
    body: `
    <div style="position:absolute;left:0;top:0;width:1000px;height:1000px;overflow:hidden">
      <img class="photo" src="${IMG.hero}" style="object-position:50% 62%">
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,22,43,.75) 0%,rgba(20,22,43,0) 30%,rgba(20,22,43,0) 62%,#14162b 100%)"></div>
    </div>
    <div class="pad" style="position:absolute;top:70px;left:0;right:0">
      <span class="tag">Balle à friandises</span>
    </div>
    <div class="pad" style="position:absolute;top:760px;left:0;right:0">
      <h1 style="font-size:124px">Son repas devient <span class="hl">un jeu.</span></h1>
      <p class="lead" style="margin-top:26px">Balle à facettes de 8 cm : il la pousse, elle roule, les croquettes tombent une à une. Pour chats et petits chiens.</p>
      <div style="margin-top:34px;display:flex;align-items:center;gap:22px">
        <div class="price">14,99 €</div>
        <div style="font:700 28px/1.25 'Figtree';color:var(--cream)">Livraison offerte<br><span style="color:var(--on-dark);font-weight:500">France, UE &amp; Suisse</span></div>
      </div>
    </div>
    <div class="foot-line"></div>${foot('Découvrir la balle →')}`,
  },
  {
    file: 'pin-06-produit-3-etapes.jpg', cls: 'sun',
    body: `
    <img src="${IMG.balle3d}" style="position:absolute;right:-70px;top:60px;width:380px;height:380px;transform:rotate(12deg)">
    <div class="pad" style="padding-top:72px">
      <span class="tag">Mode d’emploi</span>
      <h1 style="margin-top:30px;font-size:116px;width:640px">Simple comme <span class="hl">1, 2, 3</span></h1>
    </div>
    <div class="pad" style="position:absolute;left:0;right:0;top:500px;display:flex;flex-direction:column;gap:30px">
      ${[
        ['fill', 'Remplis', 'Glisse quelques croquettes sèches, prises dans sa ration du jour.'],
        ['give', 'Donne', 'Pose la balle au sol, devant ton chat ou ton petit chien.'],
        ['play', 'Laisse jouer', 'Il la pousse, elle roule, les croquettes tombent une à une.'],
      ].map(([ic, t, s], i) => `<div class="item" style="padding:22px 28px;gap:26px;align-items:center">
          <div style="flex:none;width:130px;height:130px;border-radius:26px;background:var(--cream);border:3px solid var(--ink);display:grid;place-items:center">${ICON[ic].replace('<svg', '<svg width="104" height="104"')}</div>
          <div><b style="font-size:46px;font-family:'Bricolage Grotesque';font-stretch:88%"><em>${i + 1}.</em> ${t}</b><span style="font-size:28px;text-wrap:balance">${s}</span></div></div>`).join('')}
      <div class="note" style="margin-top:4px">${eye('#ffc23c')}<div>Un jeu à partager : <strong>toujours sous ta surveillance.</strong></div></div>
    </div>
    <div class="foot-line"></div>${foot('14,99 € · livraison offerte →')}`,
  },
  {
    file: 'pin-07-produit-taille-8cm.jpg', cls: '',
    body: `
    <div class="pad" style="padding-top:72px">
      <span class="tag">La bonne taille</span>
      <h1 style="margin-top:30px;font-size:108px"><span class="red">8 cm</span>, pensée pour les chats et les <span class="hl">petits chiens</span></h1>
    </div>
    <div class="frame" style="position:absolute;left:64px;right:64px;top:520px;height:540px">
      <img class="photo" src="${IMG.taille}" style="object-position:50% 64%">
    </div>
    <div class="pad" style="position:absolute;left:0;right:0;top:1094px">
      <div style="display:flex;flex-wrap:nowrap;gap:12px">
        <span class="chip"><i class="dot"></i>Caoutchouc souple TPE</span>
        <span class="chip"><i class="dot"></i>À facettes</span>
        <span class="chip"><i class="dot"></i>Croquettes sèches</span>
      </div>
      <div class="note alert" style="margin-top:22px">${warn('#fff')}<div><strong>Pas pour les grands chiens :</strong> ils pourraient l’avaler.</div></div>
    </div>
    <div class="foot-line"></div>${foot('14,99 € · livraison offerte →')}`,
  },

  // ---------- 3 ASTUCES / INFOGRAPHIES ----------
  {
    file: 'pin-08-astuce-jeux-de-flair-maison.jpg', cls: '',
    body: `
    <div class="pad" style="padding-top:72px">
      <span class="tag">Astuce · Fait maison</span>
      <h1 style="margin-top:30px;font-size:104px">4 jeux de flair avec ce que tu as <span class="hl">déjà</span></h1>
    </div>
    <div class="pad" style="position:absolute;left:0;right:0;top:430px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
      ${[
        ['cherche', '« Cherche ! »', 'Cache des croquettes, d’abord en vue, puis de plus en plus loin.'],
        ['gobelets', 'Les gobelets', '3&nbsp;gobelets retournés, 1&nbsp;croquette dessous : il désigne le bon.'],
        ['serviette', 'La serviette roulée', 'Parsème-la de croquettes, puis <span style="display:inline;white-space:nowrap;font-size:inherit;color:inherit">roule-la</span> : il la déroule à la truffe.'],
        ['carton', 'Le carton surprise', 'Papier froissé + croquettes. Reste à côté : on ne mange pas le papier.'],
      ].map(([ic, t, s]) => `<div class="item" style="flex-direction:column;align-items:flex-start;gap:12px;padding:24px 24px 26px;height:100%">
          <div style="width:118px;height:118px;border-radius:24px;background:var(--cream);border:3px solid var(--ink);display:grid;place-items:center">${ICON[ic].replace('<svg', '<svg width="96" height="96"')}</div>
          <b style="font-size:36px;font-family:'Bricolage Grotesque';font-stretch:88%">${t}</b><span style="font-size:26px;margin-top:0">${s}</span></div>`).join('')}
    </div>
    <div class="pad" style="position:absolute;left:0;right:0;top:1190px">
      <div class="note" style="font-size:25px;padding:16px 24px">${eye('#ffc23c')}<div>Séances courtes, croquettes prises dans sa ration, <strong>et tu restes à côté.</strong></div></div>
    </div>
    <div class="foot-line"></div>${foot('Plus de jeux sur le blog →')}`,
  },
  {
    file: 'pin-09-astuce-chien-mange-trop-vite.jpg', cls: 'dark',
    body: `
    <div class="pad" style="padding-top:72px">
      <span class="tag">Astuce · Repas</span>
      <h1 style="margin-top:30px;font-size:104px">Ton chien mange <span class="hl">trop vite</span> ?<br>5 façons de ralentir</h1>
    </div>
    <div class="pad" style="position:absolute;left:0;right:0;top:540px;display:flex;flex-direction:column;gap:14px">
      ${[
        ['calme', 'Manger au calme', 'À l’écart des autres animaux.'],
        ['ration', 'Partager la ration', 'En 2 repas ou plus dans la journée.'],
        ['gamelle', 'Gamelle anti-glouton', 'Des reliefs à contourner.'],
        ['eparpille', 'Éparpiller les croquettes', 'Il les cherche une par une au flair.'],
        ['tapis', 'Tapis de fouille ou jouet', 'Adapté à sa taille, sous tes yeux.'],
      ].map(([ic, t, s]) => `<div class="item" style="padding:12px 22px;gap:22px">
          <div style="flex:none;width:84px;height:84px;border-radius:18px;background:var(--cream);display:grid;place-items:center">${ICON[ic].replace('<svg', '<svg width="66" height="66"')}</div>
          <div><b style="font-size:34px">${t}</b><span style="font-size:26px;margin-top:2px">${s}</span></div></div>`).join('')}
      <div class="note alert" style="margin-top:6px;font-size:24px;padding:16px 22px">${warn('#fff')}<div><strong>Ventre gonflé, efforts pour vomir sans y arriver ?</strong> C’est une urgence : appelle ton vétérinaire.</div></div>
    </div>
    <div class="foot-line"></div>${foot('Causes + solutions sur le blog →')}`,
  },
  {
    file: 'pin-10-astuce-premiere-balle-a-friandises.jpg', cls: 'sun',
    body: `
    <div class="pad" style="padding-top:72px">
      <span class="tag">Astuce · Bien débuter</span>
      <h1 style="margin-top:30px;font-size:100px">Première partie avec une balle à friandises</h1>
      <p class="lead" style="margin-top:20px;font-weight:700">5 astuces pour que ça marche du premier coup</p>
    </div>
    <div class="pad" style="position:absolute;left:0;right:0;top:470px">
      ${items([
        ['Commence facile', 'Fais-la rouler devant lui : les croquettes tombent.'],
        ['Petites croquettes sèches', 'Elles passent bien. Pas de pâtée.'],
        ['Prends-les dans sa ration', 'Il joue sans manger plus.'],
        ['Reste à côté', 'Retire-la si elle est mâchouillée ou abîmée.'],
        ['Rince-la souvent', 'Eau tiède + liquide vaisselle, puis séchage.'],
      ]).replace(/class="item"/g, 'class="item" style="padding:16px 24px"')}
      <div class="note" style="margin-top:28px">${clock('#ffc23c')}<div>Certains comprennent en deux minutes, d’autres en quelques jours : <strong>reste patient.</strong></div></div>
    </div>
    <div class="foot-line"></div>${foot('Le guide complet →')}`,
  },
];

// Espaces insécables à la française avant ? : ! ; » et après «
const frenchSpaces = (h) => h.replace(/>([^<]*)</g, (m, t) => '>' + t.replace(/ ([?:!;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0') + '<');

(async () => {
  const only = process.argv[2] ? Number(process.argv[2]) : null;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 1500 }, deviceScaleFactor: 1 });
  for (const [i, pin] of PINS.entries()) {
    if (only && only !== i + 1) continue;
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${FONTS}${CSS}</style></head>
      <body><div class="pin ${pin.cls}">${frenchSpaces(pin.body)}</div></body></html>`;
    const src = path.join(__dirname, pin.file.replace('.jpg', '.html'));
    fs.writeFileSync(src, html);
    await page.goto('file://' + src);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');
    // Contrôle : rien ne doit dépasser la ligne du pied de page ni les bords
    const issues = await page.evaluate(() => {
      const out = [];
      const limit = 1500 - 128 - 10;
      document.querySelectorAll('.pin *').forEach((el) => {
        if (el.closest('.foot') || el.classList.contains('foot-line') || el.closest('svg')) return;
        if (el.tagName === 'IMG' || el.closest('[style*="overflow:hidden"]')) return;
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        if (r.bottom > limit) out.push(`déborde en bas (${Math.round(r.bottom)}) : ${el.className || el.tagName} « ${el.textContent.trim().slice(0, 40)} »`);
        if (r.right > 1000 - 40 && !el.style.right && el.tagName !== 'DIV') out.push(`trop à droite (${Math.round(r.right)}) : ${el.tagName} « ${el.textContent.trim().slice(0, 40)} »`);
      });
      return [...new Set(out)].slice(0, 6);
    });
    const outFile = path.join(OUT, pin.file);
    await page.screenshot({ path: outFile, type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1000, height: 1500 } });
    const kb = Math.round(fs.statSync(outFile).size / 1024);
    console.log(`${pin.file}  ${kb} Ko${issues.length ? '\n   ! ' + issues.join('\n   ! ') : ''}`);
  }
  await browser.close();
})();
