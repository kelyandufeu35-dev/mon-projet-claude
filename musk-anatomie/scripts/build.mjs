// Build : bundle ES modules (Three.js inclus) -> dist/bundle.js, copie GSAP et polices en local.
// Aucune ressource distante n'est utilisée au rendu (le rendu doit être 100 % déterministe et hors-ligne).
import { build } from "esbuild";
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
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

// 6) Version verticale 1080×1920 (TikTok / Reels / Shorts) : tiktok.html est GÉNÉRÉ à partir de index.html
const css = readFileSync(p("src/portrait.css"), "utf8");
const must = (src, from, to) => { if (!src.includes(from)) throw new Error("tiktok.html : motif introuvable : " + from); return src.replace(from, to); };
let t = html;
t = must(t, 'content="width=1920, height=1080"', 'content="width=1080, height=1920"');
t = must(t, "<title>Elon Musk : anatomie d'une fortune</title>", "<title>Elon Musk : anatomie d'une fortune (format vertical)</title>");
t = must(t, "width: 1920px; height: 1080px;", "width: 1080px; height: 1920px;");
t = must(t, 'data-width="1920" data-height="1080"', 'data-width="1080" data-height="1920"');
t = must(t, '<canvas id="stage" width="1920" height="1080">', '<canvas id="stage" width="1080" height="1920">');
t = must(t, '<div id="root" ', '<div id="root" class="portrait" ');
t = must(t, '<script src="vendor/gsap.min.js"></script>', '<script>window.MUSK_FORMAT = "portrait";</script>\n    <script src="vendor/gsap.min.js"></script>');
t = must(t, "    </style>", css + "    </style>");
writeFileSync(p("tiktok.html"), t);
console.log("tiktok.html généré (1080×1920)");
console.log("build ok ->", existsSync(p("dist/bundle.js")) ? "dist/bundle.js" : "?");
