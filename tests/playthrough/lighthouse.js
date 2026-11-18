// Lighthouse on Fishers: the home page (navigation) and mid-game (a snapshot
// taken after starting a Practice round). Uses Playwright's Chromium.
//
//   node lighthouse.js
'use strict';

const path = require('path');
const fs = require('fs');
const H = require('./helpers');
const { chromium } = require('playwright');

const URL = (H.args().url) || 'http://localhost:8765/';

(async () => {
  const server = /localhost/.test(URL) ? await H.ensureServer(URL) : null;
  const lighthouse = (await import('lighthouse')).default;
  const out = { date: H.stamp(), runs: [] };
  // Playwright's Chromium with a debugging port, which Lighthouse drives.
  const PORT = 9333;
  const pw = await chromium.launch({ args: ['--remote-debugging-port=' + PORT] });
  const chrome = { port: PORT, kill: () => pw.close() };
  try {
    for (const formFactor of ['mobile', 'desktop']) {
      const config = formFactor === 'desktop'
        ? { extends: 'lighthouse:default', settings: { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false }, throttlingMethod: 'simulate' } }
        : { extends: 'lighthouse:default' };
      const r = await lighthouse(URL, { port: chrome.port, output: 'html', onlyCategories: ['performance', 'accessibility', 'best-practices'] }, config);
      const cats = r.lhr.categories;
      const html = path.join(H.MEDIA, 'lighthouse-home-' + formFactor + '.html');
      H.mkdirp(H.MEDIA);
      fs.writeFileSync(html, r.report);
      out.runs.push({
        page: 'home', formFactor,
        scores: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, Math.round(v.score * 100)])),
        metrics: {
          FCP: r.lhr.audits['first-contentful-paint'].displayValue,
          LCP: r.lhr.audits['largest-contentful-paint'].displayValue,
          TBT: r.lhr.audits['total-blocking-time'].displayValue,
          CLS: r.lhr.audits['cumulative-layout-shift'].displayValue
        },
        observed: (function (m) { return m && { FCP: Math.round(m.observedFirstContentfulPaint), LCP: Math.round(m.observedLargestContentfulPaint), load: Math.round(m.observedLoad) }; })((r.lhr.audits.metrics.details || {}).items && r.lhr.audits.metrics.details.items[0]), // observedLCP
        lcpElement: JSON.stringify((r.lhr.audits['largest-contentful-paint-element'].details || {}).items || []).slice(0, 900),
        failedA11y: Object.values(r.lhr.audits).filter((a) => a.score === 0 && cats.accessibility.auditRefs.some((ref) => ref.id === a.id)).map((a) => a.id),
        report: path.relative(H.REPO, html).replace(/\\/g, '/')
      });
    }
  } catch (e) {
    out.error = String(e && e.stack || e).slice(0, 600);
  }
  // Mid-game: Lighthouse snapshot mode needs a Puppeteer page; if that is not
  // available, record it as a limitation rather than failing.
  try {
    const puppeteer = await import('puppeteer-core');
    const { startFlow } = await import('lighthouse');
    const browser = await puppeteer.default.connect({ browserURL: 'http://127.0.0.1:' + chrome.port });
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(URL);
    await page.waitForSelector('#go');
    await new Promise((r) => setTimeout(r, 800));
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    await page.click('#practice');
    await page.waitForSelector('#pr-go');
    await page.click('#pr-timer');
    await page.click('#pr-go');
    await page.waitForFunction(() => { const i = document.getElementById('answer'); return i && !i.disabled; }, { timeout: 20000 });
    const flow = await startFlow(page);
    await flow.snapshot({ name: 'mid-game' });
    const res = (await flow.createFlowResult()).steps[0].lhr;
    out.runs.push({ page: 'mid-game (snapshot)', formFactor: 'mobile', scores: Object.fromEntries(Object.entries(res.categories).map(([k, v]) => [k, v.score == null ? null : Math.round(v.score * 100)])) });
    await browser.disconnect();
  } catch (e) {
    out.midGameError = String(e && e.message || e).slice(0, 300);
  }
  await chrome.kill();
  const file = H.writeResult('lighthouse', out);
  console.log(JSON.stringify(out.runs.map((r) => [r.page, r.formFactor, r.scores]), null, 0));
  if (out.error) console.log('error:', out.error);
  if (out.midGameError) console.log('mid-game:', out.midGameError);
  console.log('Wrote', path.relative(H.REPO, file));
  if (server) server.kill();
})();
