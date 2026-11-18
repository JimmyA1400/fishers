// Phone UI check: dialogs and pages on short phone screens.
//   node phone-ui.js                                   (local build, via tools/serve-subpath.js)
//   node phone-ui.js - https://<user>.github.io/fishers/  (the live site)
// For each profile:
//  - one real touch swipe scrolls the content (raw CDP touch, no overscroll);
//  - at the very end of the scroll, the title and the bottom button are on screen,
//    nothing covers the button, and pressing it works.
const path = require('path'); const fs = require('fs'); const REPO = path.join(__dirname, '..', '..');
const { chromium, devices } = require(path.join(REPO, 'tests', 'playthrough', 'node_modules', 'playwright'));
const { spawn } = require('child_process');
const BASE = process.argv[3] || 'http://localhost:8790/fishers/';
const OUT = path.join(REPO, 'reports', 'release', 'phone-ui'); fs.mkdirSync(OUT, { recursive: true });

async function swipe(cdp, x, H) { const y0 = Math.min(380, Math.round((H || 560) * 0.75));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - k * 30 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const visible = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s); if (!e) return false;
  const r = e.getBoundingClientRect();
  if (!(r.top >= 0 && r.bottom <= innerHeight && r.height > 0)) return false;
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!hit && (hit === e || e.contains(hit));
}, sel);

(async () => {
  const srv = process.argv[3] ? null : spawn('node', [path.join(REPO, 'tools', 'serve-subpath.js')], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch(); const rows = []; let bad = 0;
  const profiles = [
    ['iPhone SE', { ...devices['iPhone SE'] }],
    ['iPhone 13 bars', { ...devices['iPhone 13'], viewport: { width: 390, height: 560 } }],
    ['Pixel 7 bars', { ...devices['Pixel 7'], viewport: { width: 412, height: 640 } }],
    ['360x560', { viewport: { width: 360, height: 560 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
    ['landscape', { viewport: { width: 740, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ];
  for (const [name, o] of profiles) {
    delete o.defaultBrowserType;
    const ctx = await b.newContext(o); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
    
    const rec = (what, ok) => { rows.push((ok ? 'PASS ' : 'FAIL ') + name.padEnd(15) + what); if (!ok) bad++; };
    await page.goto(BASE);
    await page.waitForFunction(() => document.getElementById('theme') && !document.getElementById('theme').hasAttribute('data-held'), null, { timeout: 30000 });
    await page.waitForTimeout(800);

    async function checkDialog(id, label) {
      const sel = '#' + id;
      rec(label + ': title on screen at the top', await visible(page, sel + ' h2'));
      rec(label + ': close button on screen at the top', await visible(page, sel + ' form[method=dialog] .btn'));
      const s0 = await page.evaluate((s) => document.querySelector(s).scrollTop, sel);
      const scrollable = await page.evaluate((s) => { const d = document.querySelector(s); return d.scrollHeight > d.clientHeight + 2; }, sel);
      if (scrollable) {
        await swipe(cdp, 120, o.viewport.height); await page.waitForTimeout(700);
        const s1 = await page.evaluate((s) => document.querySelector(s).scrollTop, sel);
        rec(label + ': a touch swipe scrolls it (' + s0 + ' → ' + s1 + ')', s1 > s0);
        await page.evaluate((s) => { const d = document.querySelector(s); d.scrollTop = d.scrollHeight; }, sel);
        await page.waitForTimeout(300);
        rec(label + ': title still on screen at the end', await visible(page, sel + ' h2'));
        rec(label + ': close button on screen at the end', await visible(page, sel + ' form[method=dialog] .btn'));
      }
      await page.click(sel + ' form[method=dialog] .btn', { timeout: 5000 }).catch((e) => console.log('click failed', String(e).slice(0, 200))); await page.waitForTimeout(400);
      rec(label + ': closes when pressed', !(await page.evaluate((s) => document.querySelector(s).open, sel)));
    }

    // How to fish opens by itself on a first visit.
    await checkDialog('dlg-help', 'How to fish (first visit)');
    if (name === 'iPhone SE') {
      await page.evaluate(() => document.getElementById('dlg-help').showModal());
      await page.waitForTimeout(300); await page.screenshot({ path: OUT + '/ui-help-top.png' });
      await page.evaluate(() => { const d = document.getElementById('dlg-help'); d.scrollTop = d.scrollHeight; });
      await page.waitForTimeout(300); await page.screenshot({ path: OUT + '/ui-help-end.png' });
      await page.evaluate(() => document.getElementById('dlg-help').close());
    }
    // The menu and each dialog it opens.
    for (const [btn, id, label] of [['#menu-help', 'dlg-help', 'How to fish'], ['#menu-stats', 'dlg-stats', 'Logbook'], ['#menu-about', 'dlg-about', 'About']]) {
      await page.click('#btn-menu', { timeout: 5000 }); await page.waitForTimeout(400);
      rec('menu opens from the corner button', await page.evaluate(() => document.getElementById('dlg-menu').open));
      rec('menu: every button on screen', await page.evaluate(() => [...document.querySelectorAll('#dlg-menu .btn')].every((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })));
      await page.click(btn, { timeout: 5000 }); await page.waitForTimeout(500);
      await checkDialog(id, label);
    }
    // Pages that scroll: the last button must be reachable and tappable.
    for (const [open, last] of [['#theme', '#th-back'], ['#group', '#gr-back'], ['#practice', '#pr-back'], ['#endless', '#en-back'], ['#archive', '#ar-back']]) {
      await page.waitForFunction(() => document.body.classList.contains('view-home'), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(900);
      await page.evaluate((s) => document.querySelector(s).click(), open);
      await page.waitForSelector(last, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(500);
      const scroller = await page.evaluate(() => { const a = document.getElementById('app'); return a.scrollHeight > a.clientHeight + 2; });
      if (scroller) {
        const s0 = await page.evaluate(() => document.getElementById('app').scrollTop);
        await swipe(cdp, 200, o.viewport.height); await page.waitForTimeout(700);
        const s1 = await page.evaluate(() => document.getElementById('app').scrollTop);
        rec(open.slice(1) + ' page: a touch swipe scrolls it', s1 > s0);
        await page.evaluate(() => { const a = document.getElementById('app'); a.scrollTop = a.scrollHeight; });
        await page.waitForTimeout(300);
      }
      rec(open.slice(1) + ' page: bottom button on screen and tappable', await visible(page, last));
      if (name === 'iPhone SE' && open === '#group') await page.screenshot({ path: OUT + '/ui-group-end.png' });
      await page.click(last, { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(800);
      rec(open.slice(1) + ' page: its button returns home', await page.evaluate(() => document.body.classList.contains('view-home')));
    }
    await ctx.close();
  }
  console.log(rows.filter((r) => r.startsWith('FAIL')).join('\n'));
  console.log(rows.length + ' checks, ' + (bad ? bad + ' FAILED' : 'ALL PASS'));
  await b.close(); if (srv) srv.kill();
})();
