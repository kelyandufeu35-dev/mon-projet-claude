// Assemble une page autonome (fragment HTML prêt à publier en artefact) : demo.html + dist/interactive.js en ligne.
import fs from "fs";
const root = new URL("..", import.meta.url).pathname;
const html = fs.readFileSync(root + "demo.html", "utf8");
const js = fs.readFileSync(root + "dist/interactive.js", "utf8").replace(/<\/script/gi, "<\\/script");
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const link = html.match(/<link [^>]*fonts.googleapis[^>]*>/)[0];
const style = html.match(/<style>[\s\S]*?<\/style>/)[0];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script src="dist\/interactive\.js"><\/script>/, "");
fs.writeFileSync(root + "dist/equipier-3d.html", [title, link, style, body.trim(), "<script>" + js + "</script>"].join("\n"));
console.log("dist/equipier-3d.html", (fs.statSync(root + "dist/equipier-3d.html").size / 1024).toFixed(0), "Ko");
