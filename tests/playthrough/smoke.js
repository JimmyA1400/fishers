// Quick live smoke test after a deploy: the page loads on "Pixel 7" with no
// errors, serves the expected build, a Daily Cast plays through (one answer
// per round), and the result can be shared and copied.
//
//   node smoke.js --url https://<user>.github.io/fishers/ [--version abc1234]
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const H = require('./helpers');

const A = H.args();
const BASE = String(A.url || 'https://jimmya1400.github.io/fishers/');
const data = JSON.parse(fs.readFileSync(path.join(H.REPO, 'data', 'prompts.json'), 'utf8'));
const byText = new Map(data.prompts.map((p) => [p.prompt, p]));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  await page.addInitScript(() => { window.__shared = []; navigator.share = (d) => { window.__shared.push(d); return Promise.resolve(); }; navigator.canShare = () => true; });
  const out = { url: BASE };
  try {
    await page.goto(BASE + '?smoke=' + Date.now());
    await page.waitForFunction(() => window.FSH_CONFIG && document.getElementById('go'), null, { timeout: 20000 });
    await H.sleep(1500);
    out.version = await page.evaluate(() => window.FSH_CONFIG.version);
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    const label = await page.textContent('#go');
    out.daily = /see today/i.test(label) ? 'already played' : 'played';
    await page.focus('#go'); await page.keyboard.press('Enter');
    if (out.daily === 'played') {
      for (let i = 0; i < 7; i++) {
        await page.waitForFunction(() => { const x = document.getElementById('answer'); return x && !x.disabled; }, null, { timeout: 30000 });
        const p = byText.get(await page.textContent('#prompt-text'));
        await page.fill('#answer', p.answers[0].name); await page.press('#answer', 'Enter');
        await page.waitForSelector('#next', { timeout: 30000 });
        await page.focus('#next'); await page.keyboard.press('Enter');
      }
    }
    await page.waitForSelector('#share', { timeout: 30000 });
    await H.sleep(1500);
    await page.click('#share');
    await H.sleep(300);
    out.shared = await page.evaluate(() => window.__shared[0] && window.__shared[0].url);
    await page.click('#copy');
    await H.sleep(400);
    out.copied = /\/ 700/.test(await page.evaluate(() => navigator.clipboard.readText()));
  } catch (e) { errs.push(String(e).slice(0, 300)); }
  out.errors = errs;
  out.ok = !errs.length && out.shared === BASE && out.copied && (!A.version || out.version === A.version);
  console.log(JSON.stringify(out));
  await b.close();
  process.exitCode = out.ok ? 0 : 1;
})();
