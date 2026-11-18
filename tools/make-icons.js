/* Fishers: renders the app icons from SVG with a headless browser.
 *
 *   node tools/make-icons.js
 *
 * Writes assets/icons/: icon-192.png, icon-512.png, maskable-512.png,
 * apple-touch-icon.png (180), favicon-32.png. Needs the Playwright install in
 * tests/playthrough (npm install there once).
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', 'tests', 'playthrough', 'node_modules', 'playwright'));

const OUT = path.join(__dirname, '..', 'assets', 'icons');

// The ichthys on Galilee blue, with a thin band of sunrise along the bottom.
// scale: how much of the canvas the fish spans (maskable icons keep it inside
// the central 80% safe zone).
function svg(size, opts) {
  const s = opts.fish, cx = 32, cy = opts.cy || 31;
  const r = opts.round ? 14 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1d5a85"/><stop offset=".62" stop-color="#123a5c"/><stop offset="1" stop-color="#0a1f36"/>
    </linearGradient>
    <linearGradient id="dawn" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#f2bf86" stop-opacity="0"/><stop offset=".5" stop-color="#f6cf8a"/><stop offset="1" stop-color="#f2bf86" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="${r}" fill="url(#sea)"/>
  ${opts.band ? '<rect x="6" y="' + (opts.bandY || 47) + '" width="52" height="1.4" rx=".7" fill="url(#dawn)" opacity=".85"/>' : ''}
  <g transform="translate(${cx} ${cy}) scale(${s}) translate(-32 -32)">
    <path d="M10 32Q30 9 54 37M10 32Q30 55 54 27" fill="none" stroke="#f0c25e" stroke-width="5" stroke-linecap="round"/>
  </g>
</svg>`;
}

const ICONS = [
  ['icon-192.png', 192, { fish: 0.92, band: true }],
  ['icon-512.png', 512, { fish: 0.92, band: true }],
  ['maskable-512.png', 512, { fish: 0.62, band: true, bandY: 43, cy: 31 }],
  ['apple-touch-icon.png', 180, { fish: 0.82, band: true }],
  ['favicon-32.png', 32, { fish: 1, round: true }]
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size, opts] of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent('<html><body style="margin:0;background:transparent">' + svg(size, opts) + '</body></html>');
    await page.locator('svg').screenshot({ path: path.join(OUT, name), omitBackground: true });
    console.log('wrote assets/icons/' + name);
  }
  await browser.close();
})();
