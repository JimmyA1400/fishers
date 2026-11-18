// Update test: keep a tab open on the live site while a new version deploys,
// and check that the tab offers "New version available", and that tapping
// Refresh reloads into the new build.
//
//   node update-check.js --url https://<user>.github.io/fishers/ [--minutes 8]
//
// Start it, then push a change to main.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');
const H = require('./helpers');

const A = H.args();
const BASE = String(A.url || 'https://jimmya1400.github.io/fishers/');
const LIMIT = Number(A.minutes || 8) * 60000;

(async () => {
  const out = { url: BASE, started: new Date().toISOString() };
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const dir = H.mkdirp(path.join(H.REPO, 'reports', 'release', 'update'));
  try {
    await page.goto(BASE);
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 30000 });
    out.before = await page.evaluate(() => window.FSH_CONFIG.version);
    console.log('open tab is on', out.before, '— push a change now');
    const t0 = Date.now();
    let seen = false;
    while (Date.now() - t0 < LIMIT) {
      // What a returning player does: the page checks for an update when it becomes visible.
      await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {}));
      await H.sleep(8000);
      seen = await page.evaluate(() => { const t = document.getElementById('toast'); return !!t && !t.hidden && /New version/.test(t.textContent); });
      if (seen) break;
    }
    out.toastAfterS = Math.round((Date.now() - t0) / 1000);
    out.toast = seen;
    await page.screenshot({ path: path.join(dir, '01-toast.png') });
    if (seen) {
      await Promise.all([page.waitForEvent('load', { timeout: 20000 }), page.click('.toast-btn')]);
      await page.waitForFunction(() => window.FSH_CONFIG && window.FSH_CONFIG.version, null, { timeout: 20000 });
      out.after = await page.evaluate(() => window.FSH_CONFIG.version);
      await page.screenshot({ path: path.join(dir, '02-after-refresh.png') });
    }
    out.ok = !!(seen && out.after && out.after !== out.before);
  } catch (e) {
    out.error = String(e).slice(0, 400);
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'results', 'update-check.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out));
})();
