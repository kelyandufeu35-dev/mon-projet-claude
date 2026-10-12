// Usage : node record.cjs <video> <sortie.mp4> [fps] [secondes max]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const [,, name, out, fpsArg = '30', maxArg] = process.argv;
const FPS = +fpsArg;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:9494/index.html');
  const dur = Math.min(await p.evaluate((n) => window.setup(n), name), maxArg ? +maxArg : 1e9);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(dur * FPS);
  for (let i = 0; i < n; i++) {
    const b64 = await p.evaluate(([nm, t]) => { window.drawAt(nm, t); return document.getElementById('c').toDataURL('image/jpeg', 0.93).split(',')[1]; }, [name, i / FPS]);
    if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log(name, n, 'frames', errs.length ? errs : 'ok');
  await b.close();
})();
