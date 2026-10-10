// Exporte la table de timing (narration + signaux sonores) en JSON pour scripts/make_audio.py.
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const r = await build({ entryPoints: [join(root, "src/cues.js")], bundle: true, format: "esm", write: false, loader: { ".json": "json" }, logLevel: "error", platform: "node" });
const m = await import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
mkdirSync(join(root, "assets/audio"), { recursive: true });
writeFileSync(join(root, "assets/audio/timeline.json"), JSON.stringify(m.TIMELINE, null, 1));
console.log("timeline.json écrit :", m.TIMELINE.cues.length, "signaux, durée", m.TIMELINE.duration, "s");
