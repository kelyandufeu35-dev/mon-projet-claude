// Contrôle de mise en page (dev) : toutes les `step` secondes, liste les cartes du HUD et les sous-titres visibles qui se
// chevauchent ou sortent du cadre. Complète `hyperframes check` (qui n'échantillonne que quelques instants).
// Usage : node scripts/overlaps.mjs --file tiktok-en/index.html --vp 1080x1920 [--step 0.5] [--min 60]
import puppeteer from "puppeteer-core";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const file = opt("file", "index.html");
const [vw, vh] = opt("vp", "1920x1080").split("x").map(Number);
const step = +opt("step", "0.5");
const minArea = +opt("min", "60");
const exe = process.env.HYPERFRAMES_BROWSER_PATH || "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browser = await puppeteer.launch({ executablePath: exe, headless: "shell", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--font-render-hinting=none"] });
const page = await browser.newPage();
await page.setViewport({ width: vw, height: vh });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: "load" });
await page.waitForFunction("window.MuskDoc && window.MuskDoc.ready", { timeout: 90000 });
const dur = await page.evaluate(() => +document.getElementById("root").dataset.duration);
const found = new Map();
for (let t = 0.3; t < dur - 0.3; t += step) {
  const boxes = await page.evaluate((tt, W, H) => {
    window.MuskDoc.renderAt(tt);
    const els = [...document.querySelectorAll("#hud .hc"), document.getElementById("sub")];
    return els.filter((e) => e && getComputedStyle(e).display !== "none" && parseFloat(getComputedStyle(e).opacity) > 0.55 && e.textContent.trim()).map((e) => {
      const r = e.getBoundingClientRect();
      return { id: e.className.replace("hc ", "").slice(0, 28) + " «" + e.textContent.trim().slice(0, 34) + "»", x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, out: r.left < -2 || r.top < -2 || r.right > W + 2 || r.bottom > H + 2 };
    });
  }, t, vw, vh);
  for (const b of boxes) if (b.out) found.set("HORS CADRE " + b.id, [...(found.get("HORS CADRE " + b.id) || []), t]);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (w > 0 && h > 0 && w * h > minArea) { const k = a.id + "  ✕  " + b.id; found.set(k, [...(found.get(k) || []), t]); }
  }
}
for (const [k, ts] of found) console.log(`${ts[0].toFixed(1)}–${ts[ts.length - 1].toFixed(1)} s (${ts.length}×)  ${k}`);
console.log(found.size ? `${found.size} conflit(s)` : "aucun chevauchement ni débordement");
await browser.close();
