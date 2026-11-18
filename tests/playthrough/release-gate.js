// Release gate for Fishers: plays the built site like a person would, on
// desktop Chrome, "iPhone 13", "Pixel 7" and a 360 px Android, and writes
// results/release-gate.json plus screenshots under reports/release/.
//
//   node release-gate.js --url https://<user>.github.io/fishers/
//   node release-gate.js --url http://localhost:8790/fishers/   (local sub-path)
//
// Checks: zero console errors and failed requests; a full Daily Cast on the
// phone profiles (wrong guess, typo → suggestion → confirm, near miss,
// accept, one timeout, reload mid-round, results, The Catch, share sheet and
// clipboard fallback); the daily stays locked and stats persist after a
// reload; Endless, Archive, Practice, How to Play, Stats and About open;
// offline reload; manifest, icons, link-preview tags; axe; frame rate with
// 4× CPU throttling; landscape.
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const H = require('./helpers');

const A = H.args();
const BASE = String(A.url || 'http://localhost:8790/fishers/').replace(/\/?$/, '/');
const ONLY = A.only ? String(A.only).split(',') : null;
const OUT = H.mkdirp(path.join(H.REPO, 'reports', 'release'));
const data = JSON.parse(fs.readFileSync(path.join(H.REPO, 'data', 'prompts.json'), 'utf8'));
const byText = new Map(data.prompts.map((p) => [p.prompt, p]));

const PROFILES = {
  desktop: { viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  'iphone-13': devices['iPhone 13'],
  'pixel-7': devices['Pixel 7'],
  'android-360': { ...devices['Pixel 7'], viewport: { width: 360, height: 740 }, screen: { width: 360, height: 740 } }
};

const results = { url: BASE, date: new Date().toISOString(), checks: [], profiles: {} };
function check(profile, name, ok, evidence) {
  results.checks.push({ profile, name, ok: !!ok, evidence: evidence === undefined ? null : evidence });
  console.log((ok ? 'PASS ' : 'FAIL ') + profile.padEnd(12) + name + (evidence !== undefined && !ok ? '  → ' + JSON.stringify(evidence).slice(0, 300) : ''));
}

// navigator.share stand-in: records what was shared, or refuses (to test the
// clipboard fallback). Real share sheets can't be driven by automation.
function shareStub() {
  window.__shared = [];
  window.__shareMode = 'ok';
  navigator.share = function (d) {
    if (window.__shareMode === 'refuse') return Promise.reject(Object.assign(new Error('refused'), { name: 'NotAllowedError' }));
    window.__shared.push(d); return Promise.resolve();
  };
  navigator.canShare = function () { return true; };
}

async function newContext(browser, name, extra) {
  const ctx = await browser.newContext({
    ...PROFILES[name], locale: 'en-US', permissions: ['clipboard-read', 'clipboard-write'], serviceWorkers: 'allow', ...(extra || {})
  });
  const page = await ctx.newPage();
  const log = { console: [], pageErrors: [], failed: [] };
  page.on('console', (m) => { if (m.type() === 'error') log.console.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => log.pageErrors.push(String(e).slice(0, 300)));
  page.on('requestfailed', (r) => { if (!/net::ERR_ABORTED|ERR_INTERNET_DISCONNECTED/.test((r.failure() || {}).errorText || '')) log.failed.push({ url: r.url(), error: (r.failure() || {}).errorText }); });
  page.on('response', (r) => { if (r.status() >= 400) log.failed.push({ url: r.url(), status: r.status() }); });
  await page.addInitScript(shareStub);
  await page.addInitScript(() => {
    window.__startFrames = function () { window.__frames = []; const t = (x) => { if (window.__frames) { window.__frames.push(x); requestAnimationFrame(t); } }; requestAnimationFrame(t); };
    window.__stopFrames = function () {
      const f = window.__frames || []; window.__frames = null; const g = [];
      for (let i = 1; i < f.length; i++) g.push(f[i] - f[i - 1]);
      const span = f.length > 1 ? f[f.length - 1] - f[0] : 0;
      return { frames: f.length, avgFps: span ? +(1000 * (f.length - 1) / span).toFixed(1) : 0, over50: g.filter((x) => x > 50).length, worstMs: g.length ? Math.round(Math.max(...g)) : 0 };
    };
  });
  const dir = H.mkdirp(path.join(OUT, name));
  let n = 0;
  const shot = (label) => page.screenshot({ path: path.join(dir, String(++n).padStart(2, '0') + '-' + label + '.png') }).catch(() => {});
  return { ctx, page, log, shot };
}

async function home(page) {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const g = document.getElementById('go'); return g && !g.hasAttribute('aria-busy'); }, null, { timeout: 30000 });
}
async function closeDialogs(page) { await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); }
async function press(page, sel) { await page.waitForSelector(sel, { timeout: 20000 }); await page.focus(sel); await page.keyboard.press('Enter'); }

async function waitInput(page) {
  await page.waitForFunction(() => { const i = document.getElementById('answer'); return i && !i.disabled; }, null, { timeout: 30000 });
  const text = await page.textContent('#prompt-text');
  return byText.get(text);
}
async function cast(page, s) {
  await page.fill('#answer', s);
  await page.press('#answer', 'Enter');
  await H.sleep(200);
  return page.evaluate(() => ({
    cls: (document.getElementById('feedback') || {}).className || '',
    fb: (document.getElementById('feedback') || {}).textContent || '',
    value: (document.getElementById('answer') || {}).value || '',
    open: !!document.getElementById('answer') && !document.getElementById('answer').disabled,
    focused: document.activeElement && document.activeElement.id === 'answer'
  }));
}
function typoOf(p) {
  const names = new Set(p.answers.flatMap((a) => [a.name].concat(a.aliases || [], a.forms || [])).map((s) => s.toLowerCase()));
  for (const a of p.answers.filter((x) => /^[A-Za-z]{6,}$/.test(x.name))) {
    const t = a.name.slice(0, 3) + a.name.slice(4);
    if (!names.has(t.toLowerCase())) return { typed: t, of: a.name };
  }
  return null;
}
async function reveal(page) { await page.waitForSelector('#rv-title', { timeout: 40000 }); return page.textContent('#rv-title'); }

// ---- the full Daily Cast on a phone profile ---------------------------------
async function fullDaily(name, page, shot, cdp) {
  const P = name;
  await home(page);
  const helpOpen = await page.evaluate(() => document.getElementById('dlg-help').open);
  check(P, 'How to Play opens on the first visit', helpOpen);
  await shot('help');
  await closeDialogs(page);
  await shot('home');
  await press(page, '#go');
  let didTypo = false, didNear = false, didWrong = false, didTimeout = false, didReload = false, fps = null;
  for (let round = 1; round <= 7; round++) {
    let p = await waitInput(page);
    if (!p) { check(P, 'prompt text found in the bank (round ' + round + ')', false, await page.textContent('#prompt-text')); return; }
    if (round === 1) await shot('prompt');
    if (round === 1) {
      const w = await cast(page, 'zzqx qqq');
      didWrong = /miss/.test(w.cls) && w.open;
      check(P, 'wrong guess → "not in the net", round stays open', didWrong, w);
      check(P, 'focus stays in the input after Cast (keyboard stays up)', w.focused, w);
      await shot('wrong-guess');
    }
    if (round === 1) {
      const t = typoOf(p);
      if (t) {
        const s = await cast(page, t.typed);
        const ok = /suggest/.test(s.cls) && s.value === t.of && s.open;
        check(P, 'typo "' + t.typed + '" → suggests "' + t.of + '"', ok, s);
        await shot('suggestion');
        await page.press('#answer', 'Enter');
        const title = await reveal(page);
        check(P, 'casting again confirms the suggestion', !!title, title);
        didTypo = ok;
      }
    }
    if (round === 2 || (round > 2 && !didNear && (p.nearMisses || []).length)) {
      if ((p.nearMisses || []).length && !didNear) {
        const s = await cast(page, p.nearMisses[0].name);
        didNear = /near/.test(s.cls) && s.open;
        check(P, 'near miss "' + p.nearMisses[0].name + '" → explains, round stays open', didNear, s);
        await shot('near-miss');
      }
    }
    if (round === 3) {
      // Timeout: type something, then let the clock run out.
      await page.fill('#answer', 'left in the box');
      const t0 = Date.now();
      const title = await reveal(page);
      didTimeout = /nothing landed/i.test(title);
      check(P, 'timeout → "Nothing landed" (' + Math.round((Date.now() - t0) / 1000) + ' s)', didTimeout, title);
      const blurred = await page.evaluate(() => !document.activeElement || document.activeElement.id !== 'answer');
      check(P, 'round end drops the keyboard (input blurred)', blurred);
      await shot('timeout');
    }
    if (round === 5 && !didReload) {
      // Reload in the middle of a round: the cast and its clock resume.
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => { const g = document.getElementById('go'); return g && !g.hasAttribute('aria-busy'); }, null, { timeout: 30000 });
      await closeDialogs(page);
      const label = await page.textContent('#go');
      check(P, 'reload mid-cast → home offers "Back to the net"', /back to the net/i.test(label), label);
      await press(page, '#go');
      p = await waitInput(page);
      didReload = true;
    }
    if (!(await page.$('#rv-title'))) {
      const ans = round === 4 ? p.answers.find((a) => a.tier === 6) : p.answers[0];
      const measure = name === 'pixel-7' && round === 4;
      if (measure && cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      if (measure) await page.evaluate(() => window.__startFrames());
      await cast(page, ans.name);
      const title = await reveal(page);
      if (measure) {
        await H.sleep(600);
        fps = await page.evaluate(() => window.__stopFrames());
        if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        check(P, 'sink animation at 4× CPU throttle: ' + fps.avgFps + ' fps avg, ' + fps.over50 + ' frames > 50 ms', fps.avgFps >= 50, fps);
      }
      check(P, 'round ' + round + ' accept "' + ans.name + '" → ' + title, !!title && !/nothing/i.test(title), title);
      if (round === 4) await shot('lost-sheep');
    }
    await press(page, '#next');
  }
  await page.waitForSelector('#end-title', { timeout: 20000 });
  await H.sleep(1200);
  await shot('results');
  const end = await page.evaluate(() => ({
    rows: document.querySelectorAll('.catch-row').length,
    card: (document.getElementById('share-card') || {}).textContent || '',
    share: !!document.getElementById('share')
  }));
  check(P, 'results screen with The Catch (7 rows)', end.rows === 7, end);
  check(P, 'share card has the site URL and no answers', end.card.includes(BASE.replace(/\/$/, '')) && /\/ 700/.test(end.card), end.card);
  await page.click('.catch-row');
  await H.sleep(300);
  const opened = await page.evaluate(() => document.querySelectorAll('.catch-row[aria-expanded="true"]').length);
  check(P, 'The Catch: a row opens to its whole net', opened === 1, opened);
  await shot('catch');
  // Share sheet path.
  if (end.share) {
    await page.click('#share');
    await H.sleep(300);
    const shared = await page.evaluate(() => window.__shared);
    check(P, 'Share → navigator.share({ text, url })', shared.length === 1 && shared[0].url === BASE && /\/ 700/.test(shared[0].text), shared);
    // Fallback: the sheet refuses, so the result is copied instead.
    await page.evaluate(() => { window.__shareMode = 'refuse'; });
    await page.click('#share');
    await H.sleep(400);
  } else {
    await page.click('#copy');
    await H.sleep(400);
  }
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'ERR ' + e));
  const toast = await page.evaluate(() => { const t = document.getElementById('toast'); return t && !t.hidden ? t.textContent : ''; });
  check(P, 'clipboard fallback copies the card and shows "Copied ✓"', /\/ 700/.test(clip) && /Copied ✓/.test(toast), { clip: clip.slice(0, 80), toast });
  await shot('copied');
  // After finishing: reload keeps the daily locked and the stats.
  await home(page);
  const after = await page.evaluate(() => ({ go: document.getElementById('go').textContent, status: (document.querySelector('.home-status') || {}).textContent || '' }));
  check(P, 'reload after finishing → daily locked ("See today’s net")', /see today/i.test(after.go), after);
  await page.click('#btn-menu');
  await page.click('#menu-stats');
  await H.sleep(300);
  const stats = await page.textContent('#stats-body');
  check(P, 'stats persist (1 played, streak shown)', /Casts\s*1(?!\d)/.test(stats) && /Streak\s*1(?!\d)/.test(stats), stats.slice(0, 160));
  await shot('stats');
  await closeDialogs(page);
  return { fps };
}

async function modes(P, page, shot) {
  await home(page);
  await closeDialogs(page);
  for (const [btn, title, label] of [['#endless', '#en-title', 'Endless'], ['#archive', '#ar-title', 'Archive'], ['#practice', '#pr-title', 'Practice Waters']]) {
    await home(page);
    await closeDialogs(page);
    await page.click(btn);
    const ok = await page.waitForSelector(title, { timeout: 10000 }).then(() => true, () => false);
    check(P, label + ' opens', ok);
    await shot(label.toLowerCase().replace(/ /g, '-'));
  }
  // Start an Endless cast and see a prompt.
  await home(page); await closeDialogs(page);
  await page.click('#endless');
  await press(page, '#en-next');
  const p = await waitInput(page).catch(() => null);
  check(P, 'Endless cast starts with a prompt', !!p);
  await home(page); await closeDialogs(page);
  for (const [item, dlg, label] of [['#menu-help', '#dlg-help', 'How to Play'], ['#menu-stats', '#dlg-stats', 'Stats'], ['#menu-about', '#dlg-about', 'About & credits']]) {
    await page.click('#btn-menu');
    await page.click(item);
    await H.sleep(250);
    const open = await page.evaluate((d) => document.querySelector(d).open, dlg);
    check(P, label + ' dialog opens', open);
    if (label === 'About & credits') {
      const about = await page.textContent('#dlg-about');
      check(P, 'About shows credits, fan-project notice and a build version', /World English Bible/.test(about) && /OpenBible/.test(about) && /independent fan project/.test(about) && !/Version dev/.test(about), about.slice(-80));
      await shot('about');
    }
    await closeDialogs(page);
  }
  const help = await page.textContent('#dlg-help');
  check(P, 'How to Play says stats are saved on this device and new casts start at midnight Eastern', /saved on this device/.test(help) && /midnight Eastern/.test(help));
}

async function a11y(P, page) {
  const { default: AxeBuilder } = await import('@axe-core/playwright').then((m) => ({ default: m.default || m.AxeBuilder }));
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  check(P, 'axe: no serious or critical violations (' + r.violations.length + ' total)', bad.length === 0, bad.map((v) => v.id + ':' + v.nodes.length));
}

async function layout(P, page) {
  const m = await page.evaluate(() => ({
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    small: [...document.querySelectorAll('button, a, input, [role=button]')].filter((e) => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      if (!r.width || s.visibility === 'hidden' || e.closest('dialog:not([open])') || e.closest('[hidden]')) return false;
      if (e.matches('.skip-link, .sr-only *, a.inline')) return false;
      return r.width < 44 || r.height < 44;
    }).map((e) => (e.id || e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)),
    viewport: document.querySelector('meta[name=viewport]').content
  }));
  check(P, 'no horizontal scroll', !m.hScroll);
  check(P, 'tap targets on home ≥ 44×44', m.small.length === 0, m.small);
  return m;
}

async function inputChecks(P, page) {
  await home(page); await closeDialogs(page);
  await page.click('#practice');
  await press(page, '#pr-go');
  await waitInput(page);
  const r = await page.evaluate(() => {
    const i = document.getElementById('answer'), s = getComputedStyle(i), bar = document.getElementById('inrow').getBoundingClientRect();
    return {
      attrs: ['type', 'inputmode', 'autocomplete', 'autocorrect', 'autocapitalize', 'spellcheck', 'enterkeyhint'].map((a) => a + '=' + i.getAttribute(a)).join(' '),
      fontPx: parseFloat(s.fontSize), barBottom: Math.round(bar.bottom), vh: window.innerHeight
    };
  });
  check(P, 'answer input attributes', /type=text inputmode=text autocomplete=off autocorrect=off autocapitalize=off spellcheck=false enterkeyhint=go/.test(r.attrs), r.attrs);
  check(P, 'answer font ≥ 16 px (no iOS zoom)', r.fontPx >= 16, r.fontPx);
  check(P, 'input bar on screen', r.barBottom <= r.vh, r);
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const name of Object.keys(PROFILES)) {
      if (ONLY && !ONLY.includes(name)) continue;
      const { ctx, page, log, shot } = await newContext(browser, name);
      const cdp = name === 'pixel-7' ? await ctx.newCDPSession(page) : null;
      results.profiles[name] = {};
      try {
        await home(page);
        await closeDialogs(page);
        await layout(name, page);
        await a11y(name, page);
        if (name === 'iphone-13' || name === 'pixel-7') {
          const r = await fullDaily(name, page, shot, cdp);
          results.profiles[name].fps = r && r.fps;
        }
        await modes(name, page, shot);
        await inputChecks(name, page);
        await a11y(name, page);
        if (name === 'pixel-7') {
          // Landscape on a phone.
          await page.setViewportSize({ width: 915, height: 412 });
          await H.sleep(400);
          const land = await page.evaluate(() => { const b = document.getElementById('inrow'); const r = b && b.getBoundingClientRect(); return { inputVisible: !!r && r.bottom <= innerHeight && r.top >= 0, hScroll: document.documentElement.scrollWidth > innerWidth + 1 }; });
          check(name, 'landscape: input bar visible, no sideways scroll', land.inputVisible && !land.hScroll, land);
          await shot('landscape');
          await page.setViewportSize(PROFILES[name].viewport);
          // Offline: the service worker serves the shell and the cached bank.
          const sw = await page.evaluate(async () => {
            if (!('serviceWorker' in navigator)) return 'unsupported';
            await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 8000))]);
            for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 250));
            return navigator.serviceWorker.controller ? 'controlled' : 'not controlled';
          });
          check(name, 'service worker controls the page', sw === 'controlled', sw);
          await ctx.setOffline(true);
          let offlineOk = false, offlineInfo = null;
          try {
            await page.reload({ waitUntil: 'load', timeout: 20000 });
            await page.waitForFunction(() => { const g = document.getElementById('go'); return g && !g.hasAttribute('aria-busy'); }, null, { timeout: 20000 });
            await closeDialogs(page);
            await page.click('#endless');
            await press(page, '#en-next');
            offlineInfo = await waitInput(page).then((p) => p && p.id);
            offlineOk = !!offlineInfo;
          } catch (e) { offlineInfo = String(e).slice(0, 200); }
          check(name, 'offline reload: shell loads and a cast is playable from the cached bank', offlineOk, offlineInfo);
          await shot('offline');
          await ctx.setOffline(false);
        }
      } catch (e) {
        check(name, 'run finished without an exception', false, String(e).slice(0, 400));
        await shot('error');
      }
      const errs = log.console.concat(log.pageErrors);
      check(name, 'zero console errors', errs.length === 0, errs);
      check(name, 'zero failed requests', log.failed.length === 0, log.failed);
      await ctx.close();
    }
    // A fresh offline visitor who never loaded the game gets the browser's
    // own offline page; nothing to test there. A visitor whose bank isn't
    // cached sees "The boat is ashore" (checked in code: js/game.js).
  } finally {
    await browser.close();
  }
  const file = path.join(__dirname, 'results', 'release-gate.json');
  H.mkdirp(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(results, null, 2));
  const failed = results.checks.filter((c) => !c.ok);
  console.log('\n' + (results.checks.length - failed.length) + ' / ' + results.checks.length + ' checks passed · ' + path.relative(H.REPO, file));
  process.exitCode = failed.length ? 1 : 0;
})();
