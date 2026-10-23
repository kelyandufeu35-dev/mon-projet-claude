#!/usr/bin/env node
// Regroupe l'application en un seul fichier HTML (styles et scripts intégrés) : il s'ouvre
// d'un double-clic sans serveur et peut être publié tel quel.
//
//   node tools/build-single.mjs [sortie.html]            page complète (dist/bille-musicale.html)
//   node tools/build-single.mjs --fragment sortie.html   contenu seul, pour un hôte qui fournit
//                                                        lui-même <html>, <head> et <body>

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = resolve(args.find((a) => !a.startsWith('--')) || join(ROOT, 'dist', 'bille-musicale.html'));

const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*'\.\/([\w-]+)\.js';\s*$/gm;
const EXPORT = /^export\s+(?:async\s+)?(?:function|class|const|let)\s+([\w$]+)/gm;

// Chaque module devient une fonction qui renvoie ses exports ; ses imports lisent les exports
// des modules déjà évalués (ordre topologique).
const modules = new Map();
async function load(name) {
  if (modules.has(name)) return;
  modules.set(name, null);
  const source = await readFile(join(ROOT, 'src', `${name}.js`), 'utf8');
  const deps = [...source.matchAll(IMPORT)].map((m) => ({ names: m[1].trim(), from: m[2] }));
  for (const d of deps) await load(d.from);
  const exports = [...source.matchAll(EXPORT)].map((m) => m[1]);
  const body = source
    .replace(IMPORT, (_, names, from) => `const {${names}} = __${from};`)
    .replace(/^export\s+/gm, '');
  modules.delete(name);
  modules.set(name, `const __${name} = (() => {\n${body}\nreturn { ${exports.join(', ')} };\n})();\n`);
}
await load('app');
const script = `(() => {\n${[...modules.values()].join('\n')}\n})();`.replace(/<\/script/gi, '<\\/script');

const html = await readFile(join(ROOT, 'index.html'), 'utf8');
const css = await readFile(join(ROOT, 'styles.css'), 'utf8');
const icon = `data:image/svg+xml;base64,${Buffer.from(await readFile(join(ROOT, 'icon.svg'))).toString('base64')}`;
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/\s*<script type="module" src="src\/app.js"><\/script>/, '');
const title = /<title>.*<\/title>/.exec(html)[0];

const page = fragment
  ? `${title}\n<style>\n${css}</style>\n${body.trim()}\n<script>\n${script}\n</script>\n`
  : html
      .replace(/\s*<link rel="manifest"[^>]*>/, '')
      .replace('href="icon.svg"', `href="${icon}"`)
      .replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}</style>`)
      .replace('<script type="module" src="src/app.js"></script>', `<script>\n${script}\n</script>`);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, page);
console.log(`✓ ${out} (${(page.length / 1024).toFixed(0)} Ko)`);
