// Build : bundle ES modules (Three.js inclus) -> dist/bundle.js, copie GSAP et polices en local.
// Aucune ressource distante n'est utilisée au rendu (le rendu doit être 100 % déterministe et hors-ligne).
import { build } from "esbuild";
import { copyFileSync, mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...a) => join(root, ...a);

mkdirSync(p("dist"), { recursive: true });
mkdirSync(p("vendor"), { recursive: true });
mkdirSync(p("assets/fonts"), { recursive: true });

// 1) GSAP local (chargé comme global par index.html)
copyFileSync(p("node_modules/gsap/dist/gsap.min.js"), p("vendor/gsap.min.js"));

// 2) Polices locales (sous-ensemble latin : couvre le français)
const fonts = [
  ["@fontsource/inter/files/inter-latin-400-normal.woff2", "Inter-400.woff2"],
  ["@fontsource/inter/files/inter-latin-600-normal.woff2", "Inter-600.woff2"],
  ["@fontsource/inter/files/inter-latin-800-normal.woff2", "Inter-800.woff2"],
  ["@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2", "SpaceGrotesk-500.woff2"],
  ["@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2", "SpaceGrotesk-700.woff2"],
  ["@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2", "JetBrainsMono-500.woff2"],
  ["@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2", "JetBrainsMono-700.woff2"],
];
for (const [from, to] of fonts) copyFileSync(p("node_modules", from), p("assets/fonts", to));

// 3) Données sourcées -> injectées dans le bundle (lecture seule au rendu)
const facts = JSON.parse(readFileSync(p("data/facts.json"), "utf8"));
writeFileSync(p("dist/facts.json"), JSON.stringify(facts));

// 4) Bundle JS
const result = await build({
  entryPoints: [p("src/main.js")],
  bundle: true,
  format: "iife",
  target: "chrome120",
  outfile: p("dist/bundle.js"),
  sourcemap: false,
  minify: process.env.MINIFY === "1",
  legalComments: "none",
  logLevel: "info",
  loader: { ".json": "json" },
});
if (result.errors.length) process.exit(1);

// 5) Table de timing (durée, segments, signaux sonores) -> JSON ; la durée est reportée dans index.html
const tl = await build({ entryPoints: [p("src/cues.js")], bundle: true, format: "esm", write: false, loader: { ".json": "json" }, logLevel: "error", platform: "node" });
const mod = await import("data:text/javascript;base64," + Buffer.from(tl.outputFiles[0].text).toString("base64"));
mkdirSync(p("assets/audio"), { recursive: true });
writeFileSync(p("assets/audio/timeline.json"), JSON.stringify(mod.TIMELINE, null, 1));
let html = readFileSync(p("index.html"), "utf8");
const d = String(mod.TIMELINE.duration);
html = html.replace(/(data-composition-id="root"[^>]*data-duration=")[^"]*(")/, `$1${d}$2`).replace(/(<audio id="mix"[^>]*data-duration=")[^"]*(")/, `$1${d}$2`);
writeFileSync(p("index.html"), html);
console.log("durée de la composition :", d, "s");
process.env.MUSK_LANG = "en";
const modEn = await import("data:text/javascript;base64," + Buffer.from(tl.outputFiles[0].text + "\n//en").toString("base64"));
delete process.env.MUSK_LANG;
writeFileSync(p("assets/audio/timeline.en.json"), JSON.stringify(modEn.TIMELINE, null, 1));
const dEn = String(modEn.TIMELINE.duration);
console.log("durée de la version anglaise :", dEn, "s");

// 6) Variantes générées à partir d'index.html. Un projet Hyperframes n'admet qu'UN index.html racine : chaque variante est donc
//    un mini-projet dans son dossier (lint, check, preview et render fonctionnent dans chacun) :
//      (racine)    16:9  français      tiktok/     9:16 français
//      en/         16:9  anglais       tiktok-en/  9:16 anglais
const css = readFileSync(p("src/portrait.css"), "utf8");
const cssEn = readFileSync(p("src/lang-en.css"), "utf8");
const must = (src, from, to) => { if (!src.includes(from)) throw new Error("variante : motif introuvable : " + from); return src.replace(from, to); };
function variant(dir, { en, portrait }) {
  let t = html;
  const flags = [en && 'window.MUSK_LANG = "en";', portrait && 'window.MUSK_FORMAT = "portrait";'].filter(Boolean).join(" ");
  if (en) {
    t = must(t, '<html lang="fr">', '<html lang="en">');
    t = must(t, "<title>Elon Musk : anatomie d'une fortune</title>", "<title>Elon Musk: anatomy of a fortune</title>");
    t = must(t, 'src="assets/audio/mix.m4a"', 'src="assets/audio/mix.en.m4a"');
    t = t.split(`data-duration="${d}"`).join(`data-duration="${dEn}"`);
    t = must(t, "    </style>", cssEn + "    </style>");
  }
  if (portrait) {
    t = must(t, 'content="width=1920, height=1080"', 'content="width=1080, height=1920"');
    t = t.replace("</title>", (en ? " (vertical format)" : " (format vertical)") + "</title>");
    t = must(t, "width: 1920px; height: 1080px;", "width: 1080px; height: 1920px;");
    t = must(t, 'data-width="1920" data-height="1080"', 'data-width="1080" data-height="1920"');
    t = must(t, '<canvas id="stage" width="1920" height="1080">', '<canvas id="stage" width="1080" height="1920">');
    t = must(t, '<div id="root" ', '<div id="root" class="portrait" ');
    t = must(t, "    </style>", css + "    </style>");
  }
  if (flags) t = must(t, '<script src="vendor/gsap.min.js"></script>', `<script>${flags}</script>\n    <script src="vendor/gsap.min.js"></script>`);
  const v = (...a) => p(dir, ...a);
  const audio = en ? "mix.en.m4a" : "mix.m4a";
  for (const sub of ["assets/fonts", "assets/audio", "vendor", "dist"]) mkdirSync(v(sub), { recursive: true });
  for (const f of ["vendor/gsap.min.js", "dist/bundle.js", "assets/audio/" + audio]) copyFileSync(p(f), v(f));
  for (const f of readdirSync(p("assets/fonts"))) copyFileSync(p("assets/fonts", f), v("assets/fonts", f));
  writeFileSync(v("index.html"), t);
  console.log(dir + "/index.html généré (" + (portrait ? "1080×1920" : "1920×1080") + ", " + (en ? "en" : "fr") + ")");
}
variant("tiktok", { en: false, portrait: true });
variant("en", { en: true, portrait: false });
variant("tiktok-en", { en: true, portrait: true });
console.log("build ok ->", existsSync(p("dist/bundle.js")) ? "dist/bundle.js" : "?");
