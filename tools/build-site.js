/* Fishers: builds the deployable site into _site/.
 *
 * Only an allowlist is copied: the game page, its CSS, JS, game data, icons,
 * fonts, manifest, service worker and 404 page. Nothing from tests/, reports/,
 * tools/, content/ or review/ is published, and neither are the raw Bible
 * texts.
 *
 *   node tools/build-site.js            version = short git SHA (or "dev")
 *   BUILD_VERSION=abc123 node tools/build-site.js
 *
 * The version is stamped into sw.js (so every deploy gets a fresh cache) and
 * js/config.js (shown in About & credits).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_site');

function version() {
  if (process.env.BUILD_VERSION) return process.env.BUILD_VERSION.slice(0, 12);
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch (e) { return 'dev'; }
}

// Paths are relative to the repo root. Directories copy
// only the listed extensions.
const FILES = ['index.html', '404.html'];
const OPTIONAL = ['manifest.webmanifest', 'sw.js'];
const DIRS = [
  ['css', ['.css']],
  ['js', ['.js']],
  ['assets', ['.svg', '.png', '.ico']],
  ['fonts', ['.woff2', '.txt']]
];

function copyDir(dir, exts) {
  const src = path.join(ROOT, dir);
  if (!fs.existsSync(src)) return;
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const rel = path.join(dir, ent.name);
    if (ent.isDirectory()) { copyDir(rel, exts); continue; }
    if (!exts.includes(path.extname(ent.name).toLowerCase())) continue;
    fs.mkdirSync(path.join(OUT, dir), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), path.join(OUT, rel));
  }
}

function main() {
  const v = version();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of FILES) {
    if (!fs.existsSync(path.join(ROOT, f))) throw new Error('Missing ' + f);
    fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
  }
  for (const f of OPTIONAL) if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
  for (const [d, exts] of DIRS) copyDir(d, exts);

  // Game data: the JSON only (prompts.js is the file:// copy), minified.
  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'prompts.json'), 'utf8'));
  fs.writeFileSync(path.join(OUT, 'data', 'prompts.json'), JSON.stringify(bank));

  // Stamp the version.
  const stamp = (rel, from, to) => {
    const f = path.join(OUT, rel), s = fs.readFileSync(f, 'utf8');
    if (!s.includes(from)) throw new Error(rel + ' has no ' + from + ' to stamp');
    fs.writeFileSync(f, s.split(from).join(to));
  };
  stamp('js/config.js', "version: 'dev'", "version: '" + v + "'");
  if (fs.existsSync(path.join(OUT, 'sw.js'))) stamp('sw.js', '__BUILD_VERSION__', v);

  // GitHub Pages: serve files as-is (no Jekyll).
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  // Report.
  let total = 0;
  const list = [];
  (function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else { const n = fs.statSync(p).size; total += n; list.push([path.relative(OUT, p).replace(/\\/g, '/'), n]); }
    }
  })(OUT);
  list.sort((a, b) => a[0].localeCompare(b[0]));
  if (process.argv.includes('--list')) for (const [f, n] of list) console.log((n / 1024).toFixed(1).padStart(8) + ' KB  ' + f);
  console.log('Built _site/ · version ' + v + ' · ' + list.length + ' files · ' + (total / 1024 / 1024).toFixed(2) + ' MB');
  return list;
}

if (require.main === module) main();
module.exports = { main };
