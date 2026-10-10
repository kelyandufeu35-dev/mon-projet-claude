// Benchmark de rendu WebGL logiciel : mesure le temps de renderAt(t) (3D + HUD) à différents instants (dev uniquement).
// Usage : node scripts/bench.mjs 5 20 35 52 63 80 95
import puppeteer from "puppeteer-core";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const times = process.argv.slice(2).filter((a) => !isNaN(+a)).map(Number);
const exe = process.env.HYPERFRAMES_BROWSER_PATH || "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browser = await puppeteer.launch({ executablePath: exe, headless: "shell", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(pathToFileURL(resolve("index.html")).href, { waitUntil: "load" });
await page.waitForFunction("window.MuskDoc && window.MuskDoc.ready", { timeout: 120000 });
let total = 0;
for (const t of times) {
  const ms = await page.evaluate((t0) => {
    const w = window.MuskDoc.world, gl = w.renderer.getContext(), px = new Uint8Array(4);
    window.MuskDoc.renderAt(t0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const a = performance.now();
    for (let i = 0; i < 4; i++) { window.MuskDoc.renderAt(t0 + (i + 1) / 30); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    return (performance.now() - a) / 4;
  }, t);
  total += ms;
  console.log(`t=${String(t).padStart(6)} s : ${ms.toFixed(0)} ms/image`);
}
console.log("moyenne :", (total / times.length).toFixed(0), "ms/image");
await browser.close();
