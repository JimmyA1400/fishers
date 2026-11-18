// Shared pieces for the Fishers playthroughs.
// Fresh browser context per run, video + trace, phase screenshots, a rAF frame
// sampler, a CLS observer, console/network logging and axe scans.
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const REPO = path.resolve(__dirname, '..', '..');
const MEDIA = path.join(REPO, 'reports', 'media');
const RESULTS = path.join(__dirname, 'results');

const VIEWPORTS = {
  phone: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false }
};

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function mkdirp(dir) { fs.mkdirSync(dir, { recursive: true }); return dir; }

function args(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2), v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    out[k] = v;
  }
  return out;
}

// ---- local server for Fishers ----------------------------------------------
function isUp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode < 500); });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}
async function ensureServer(url = 'http://localhost:8765/') {
  if (await isUp(url)) return null;
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const child = spawn(py, ['-m', 'http.server', '8765'], { cwd: REPO, stdio: 'ignore', detached: false });
  for (let i = 0; i < 40; i++) { await sleep(250); if (await isUp(url)) return child; }
  throw new Error('Could not start the local server on 8765');
}

// ---- a run: one fresh browser context ------------------------------------------
async function startRun(game, label, opts = {}) {
  const vp = VIEWPORTS[opts.viewport || 'desktop'];
  const runId = game + '-' + label;
  const dir = mkdirp(path.join(MEDIA, runId));
  const browser = await chromium.launch({ headless: opts.headed ? false : true });
  const context = await browser.newContext({
    ...vp,
    reducedMotion: opts.reducedMotion || 'no-preference',
    recordVideo: { dir: path.join(dir, 'video'), size: vp.viewport },
    permissions: ['clipboard-read', 'clipboard-write'],
    locale: 'en-US'
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const log = { console: [], pageErrors: [], failedRequests: [], dialogs: [] };
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.console.push({ type: m.type(), text: m.text().slice(0, 300) }); });
  page.on('pageerror', (e) => log.pageErrors.push(String(e).slice(0, 300)));
  page.on('requestfailed', (r) => log.failedRequests.push({ url: r.url(), error: r.failure() && r.failure().errorText }));
  page.on('response', (r) => { if (r.status() >= 400) log.failedRequests.push({ url: r.url(), status: r.status() }); });
  page.on('dialog', async (d) => { log.dialogs.push(d.message()); await d.dismiss(); });
  if (opts.throttle) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(opts.throttle) });
  }
  await page.addInitScript(installObservers);
  const t0 = Date.now();
  const shots = [];
  async function shot(name) {
    const file = path.join(dir, String(shots.length + 1).padStart(2, '0') + '-' + name + '.png');
    if (opts.fastShots) {
      // CDP capture: does not wait for fonts/ad iframes, so mid-animation shots land on time.
      try {
        if (!startRun._cdp) startRun._cdp = new WeakMap();
        let cdp = startRun._cdp.get(page);
        if (!cdp) { cdp = await context.newCDPSession(page); startRun._cdp.set(page, cdp); }
        const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      } catch (e) { await page.screenshot({ path: file }).catch(() => {}); }
    } else await page.screenshot({ path: file }).catch(() => {});
    shots.push({ name, file: path.relative(REPO, file).replace(/\\/g, '/'), t: (Date.now() - t0) / 1000 });
    return file;
  }
  async function finish() {
    const tracePath = path.join(dir, 'trace.zip');
    await context.tracing.stop({ path: tracePath }).catch(() => {});
    const video = page.video();
    await context.close();
    await browser.close();
    let videoPath = null;
    if (video) { try { videoPath = path.relative(REPO, await video.path()).replace(/\\/g, '/'); } catch (e) { /* none */ } }
    return { runId, shots, video: videoPath, trace: path.relative(REPO, tracePath).replace(/\\/g, '/'), log };
  }
  return { browser, context, page, shot, finish, log, t0, dir, runId };
}

// Runs in the page before any script: CLS and a frame sampler.
function installObservers() {
  window.__cls = 0;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) { /* not supported */ }
  window.__frames = null;
  window.__startFrames = function () {
    window.__frames = [];
    const tick = (t) => { if (window.__frames) { window.__frames.push(t); requestAnimationFrame(tick); } };
    requestAnimationFrame(tick);
  };
  window.__stopFrames = function () {
    const f = window.__frames || []; window.__frames = null;
    const gaps = []; for (let i = 1; i < f.length; i++) gaps.push(f[i] - f[i - 1]);
    const span = f.length > 1 ? f[f.length - 1] - f[0] : 0;
    return {
      frames: f.length, ms: Math.round(span),
      avgFps: span ? +(1000 * (f.length - 1) / span).toFixed(1) : 0,
      over50: gaps.filter((g) => g > 50).length,
      worstMs: gaps.length ? Math.round(Math.max(...gaps)) : 0
    };
  };
}

async function axeScan(page, label) {
  const { default: AxeBuilder } = await import('@axe-core/playwright').then((m) => ({ default: m.default || m.AxeBuilder }));
  try {
    const r = await new AxeBuilder({ page }).analyze();
    return {
      label,
      violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0] && v.nodes[0].target.join(' ') }))
    };
  } catch (e) {
    return { label, error: String(e).slice(0, 200) };
  }
}

// Time from a keypress to the first change in an element's text.
async function timeToText(page, selector, action) {
  await page.evaluate((sel) => {
    window.__ttt = null;
    const el = document.querySelector(sel);
    const start = performance.now();
    window.__tttStart = start;
    if (!el) return;
    const before = el.textContent;
    const mo = new MutationObserver(() => {
      if (el.textContent !== before && window.__ttt == null) { window.__ttt = performance.now() - window.__tttStart; mo.disconnect(); }
    });
    mo.observe(el, { childList: true, subtree: true, characterData: true });
  }, selector);
  await page.evaluate(() => { window.__tttStart = performance.now(); });
  await action();
  for (let i = 0; i < 40; i++) {
    const v = await page.evaluate(() => window.__ttt);
    if (v != null) return Math.round(v);
    await sleep(25);
  }
  return null;
}

// Time from an action until the page shows text matching a pattern (polled each frame).
async function timeToMatch(page, source, action) {
  await page.evaluate((src) => {
    window.__ttm = null;
    const re = new RegExp(src, 'i'), start = performance.now();
    window.__ttmStart = start;
    const poll = () => { if (re.test(document.body.innerText)) window.__ttm = performance.now() - window.__ttmStart; else if (performance.now() - start < 5000) requestAnimationFrame(poll); };
    requestAnimationFrame(poll);
  }, source);
  await page.evaluate(() => { window.__ttmStart = performance.now(); });
  await action();
  for (let i = 0; i < 60; i++) { const v = await page.evaluate(() => window.__ttm); if (v != null) return Math.round(v); await sleep(25); }
  return null;
}

function writeResult(name, data) {
  mkdirp(RESULTS);
  const file = path.join(RESULTS, name + '.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

module.exports = { REPO, MEDIA, RESULTS, VIEWPORTS, stamp, sleep, mkdirp, args, ensureServer, startRun, axeScan, timeToText, timeToMatch, writeResult };
