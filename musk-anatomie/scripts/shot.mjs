// Capture rapide (dev) : rend les images aux instants donnés et enregistre des PNG complets (3D + HUD).
// Usage : node scripts/shot.mjs 1.5 5 9.2 [--out shots] [--scale 0.5]
import puppeteer from "puppeteer-core";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
const args = process.argv.slice(2);
const times = args.filter((a) => !a.startsWith("--") && !isNaN(+a)).map(Number);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const out = opt("out", "shots");
mkdirSync(out, { recursive: true });
const exe = process.env.HYPERFRAMES_BROWSER_PATH || "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browser = await puppeteer.launch({ executablePath: exe, headless: "shell", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--font-render-hinting=none"] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
page.on("console", (m) => { if (["error", "warning", "log"].includes(m.type())) console.log("console." + m.type() + ":", m.text()); });
await page.evaluateOnNewDocument(() => { window.addEventListener("unhandledrejection", (e) => console.error("UNHANDLED:", e.reason && (e.reason.stack || e.reason.message || String(e.reason)))); });
await page.goto(pathToFileURL(resolve("index.html")).href, { waitUntil: "load" });
await page.waitForFunction("window.MuskDoc && window.MuskDoc.ready", { timeout: 90000 });
for (const t of times) {
  const ms = await page.evaluate((tt) => { const a = performance.now(); window.MuskDoc.renderAt(tt); return performance.now() - a; }, t);
  const f = `${out}/t${String(t).replace(".", "_").padStart(6, "0")}.png`;
  await page.screenshot({ path: f });
  console.log(f, ms.toFixed(0) + "ms");
}
await browser.close();
