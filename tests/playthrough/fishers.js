// Fishers playthrough: plays today's Daily Cast through the UI on a fresh
// context, walking the test matrix, and writes results/fishers-<viewport>.json
// plus screenshots, video and a trace under reports/media/.
//
//   node fishers.js [--viewport phone|desktop|both] [--throttle 4] [--headed]
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const H = require('./helpers');

const URL = 'http://localhost:8765/';
const A = H.args();
const data = JSON.parse(fs.readFileSync(path.join(H.REPO, 'data', 'prompts.json'), 'utf8'));
const byId = Object.fromEntries(data.prompts.map((p) => [p.id, p]));
const POINTS = Object.fromEntries(data.tiers.map((t) => [t.id, t.points]));

// The game's own date logic, run in Node.
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(H.REPO, 'js', 'config.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(H.REPO, 'js', 'daily.js'), 'utf8'), sandbox);
const CFG = sandbox.window.FSH_CONFIG, D = sandbox.window.FSHDaily;
const TODAY = D.dateKey(new Date());
data.schedule = JSON.parse(fs.readFileSync(path.join(H.REPO, 'data', 'schedule.json'), 'utf8'));
const S = require(path.join(H.REPO, 'js', 'schedule.js'));
const dailyIds = S.dailyIds(data, data.schedule, TODAY, CFG);
const endless1Ids = S.endlessIds(data, data.schedule, 1, TODAY, CFG);

// ---- the oracle: test answers for one prompt -----------------------------------
function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim(); }
function oracle(p) {
  const tier = (t) => p.answers.filter((a) => a.tier === t);
  const names = new Set(p.answers.flatMap((a) => [a.name].concat(a.aliases || [])).map(norm));
  const pick = (t) => tier(t).sort((a, b) => a.name.length - b.name.length)[0] || null;
  const long = p.answers.filter((a) => /^[A-Za-z]{7,}$/.test(a.name) && a.tier >= 3);
  let typo = null, typoOf = null;
  for (const a of long) {
    const n = a.name, t = n.slice(0, 3) + n.slice(4);       // drop the 4th letter
    if (!names.has(norm(t))) { typo = t; typoOf = a.name; break; }
  }
  let typo2 = null;
  if (typoOf) { const n = typoOf; typo2 = n.slice(0, 2) + n.slice(3); if (names.has(norm(typo2))) typo2 = null; }
  let prefix = null, prefixOf = null;
  for (const a of p.answers.filter((x) => /^[A-Za-z]{9,}$/.test(x.name))) {
    const pre = a.name.slice(0, 6);
    if (!names.has(norm(pre)) && p.answers.filter((x) => norm(x.name).startsWith(norm(pre))).length === 1) { prefix = pre; prefixOf = a.name; break; }
  }
  const aliasA = p.answers.find((a) => (a.aliases || []).some((al) => norm(al) !== norm(a.name)));
  return {
    id: p.id, prompt: p.prompt, closed: !!p.closed,
    byTier: Object.fromEntries([1, 2, 3, 4, 5, 6].map((t) => [t, pick(t) && pick(t).name])),
    sheep: (tier(6)[0] || {}).name || null,
    seat: (tier(2)[0] || {}).name || null,
    near: p.nearMisses && p.nearMisses[0] ? p.nearMisses[0].name : null,
    alias: aliasA ? { alias: aliasA.aliases.find((al) => norm(al) !== norm(aliasA.name)), of: aliasA.name, tier: aliasA.tier } : null,
    typo, typo2, typoOf, prefix, prefixOf,
    nonAnswer: 'pizza',
    tierOf: (name) => { const a = p.answers.find((x) => norm(x.name) === norm(name)); return a ? a.tier : null; }
  };
}

// ---- page helpers ------------------------------------------------------------------
async function closeDialogs(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
}
async function waitReady(page, timeout = 15000) {
  const t = Date.now();
  await page.waitForFunction(() => { const i = document.getElementById('answer'); return i && !i.disabled; }, null, { timeout });
  return Date.now() - t;
}
async function state(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const st = JSON.parse(localStorage.getItem('fishers.v1') || '{}');
    return {
      feedback: q('#feedback') ? q('#feedback').textContent : null,
      feedbackClass: q('#feedback') ? q('#feedback').className : null,
      value: q('#answer') ? q('#answer').value : null,
      secs: q('#secs') ? q('#secs').textContent : null,
      tag: !!q('#net-tag'),
      result: q('#rv-title') ? q('#rv-title').textContent : null,
      hudM: q('#hud-m') ? q('#hud-m').textContent : null,
      hudScore: q('#hud-score') ? q('#hud-score').textContent : null,
      results: st.daily ? st.daily.results.length : null,
      injectedImg: !!document.querySelector('#feedback img, .feedback img'),
      body: document.body.className
    };
  });
}
async function submit(page, text, { measure } = {}) {
  await page.fill('#answer', text);
  let latency = null;
  if (measure) latency = await H.timeToText(page, '#feedback', () => page.press('#answer', 'Enter'));
  else await page.press('#answer', 'Enter');
  await H.sleep(180);
  const s = await state(page);
  return { text: text.length > 60 ? text.slice(0, 20) + '…(' + text.length + ' chars)' : text, latencyMs: latency, ...s };
}
async function waitResult(page, timeout = 15000) {
  const t = Date.now();
  await page.waitForSelector('#next', { timeout });
  return Date.now() - t;
}
// The button bobs, so Playwright never sees it 'stable'; press it with the keyboard instead.
async function pressKey(page, sel) { await page.waitForSelector(sel); await page.focus(sel); await page.keyboard.press('Enter'); }
async function pressNext(page) { await page.waitForSelector('#next'); await page.focus('#next'); await page.keyboard.press('Enter'); }
function metres(s) { return s ? Number(String(s).replace(/[^0-9]/g, '')) : null; }

// Accept an answer and watch the sink: frames, three mid-sink shots, timing.
async function acceptAndSink(page, run, text, label) {
  await page.fill('#answer', text);
  await page.evaluate(() => window.__startFrames());
  const t = Date.now();
  await page.press('#answer', 'Enter');
  const frames = [];
  for (let i = 0; i < 3; i++) { await H.sleep(i === 0 ? 450 : 700); await run.shot(label + '-mid-sink-' + (i + 1)); frames.push(await state(page)); }
  const toResult = await waitResult(page).then((ms) => ms + (Date.now() - t - ms));
  const fps = await page.evaluate(() => window.__stopFrames());
  await H.sleep(700);
  await run.shot(label + '-result');
  return { acceptToResultMs: Date.now() - t - 700, fps, during: frames.map((f) => ({ hudM: f.hudM, tag: f.tag })), after: await state(page), toResult };
}

// ---- one full daily on one viewport ----------------------------------------------------
async function playDaily(viewport, opts = {}) {
  const run = await H.startRun('fishers', viewport + (opts.throttle ? '-throttled' : ''), { viewport, throttle: opts.throttle, headed: A.headed });
  const { page } = run;
  const out = { viewport, today: TODAY, dailyIds, rounds: [], checks: {}, timings: {}, axe: [], notes: [] };
  const expectTotal = [];
  try {
    const tLoad = Date.now();
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForSelector('#go', { timeout: 15000 });
    out.timings.loadToHomeMs = Date.now() - tLoad;
    out.checks.helpOpensFirstVisit = await page.evaluate(() => document.getElementById('dlg-help').open);
    await page.keyboard.press('Escape');
    out.checks.escClosesHelp = !(await page.evaluate(() => document.getElementById('dlg-help').open));
    await closeDialogs(page);
    out.checks.soundDefaultOff = await page.evaluate(() => document.getElementById('btn-sound').getAttribute('aria-pressed') === 'false');
    await H.sleep(600);
    await run.shot('home');
    out.axe.push(await H.axeScan(page, 'home'));

    // Keyboard: Tab to the start button, Enter to start.
    let tabs = 0;
    for (; tabs < 15; tabs++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement && document.activeElement.id === 'go')) break;
    }
    out.checks.tabsToStart = tabs + 1;
    const tStart = Date.now();
    await page.keyboard.press('Enter');
    await H.sleep(1900);
    await run.shot('countdown');
    // Submit during the countdown: the field and button are disabled.
    out.checks.submitDuringCountdown = await page.evaluate(() => ({ inputDisabled: document.getElementById('answer').disabled, castDisabled: document.getElementById('cast').disabled }));
    await waitReady(page, 20000);
    out.timings.startToInputReadyMs = Date.now() - tStart;
    out.checks.autofocus = await page.evaluate(() => document.activeElement && document.activeElement.id === 'answer');
    await run.shot('input-ready');
    out.axe.push(await H.axeScan(page, 'input-ready'));

    for (let r = 0; r < 7; r++) {
      const p = byId[dailyIds[r]], o = oracle(p);
      const round = { n: r + 1, id: p.id, prompt: p.prompt, oracle: { ...o, tierOf: undefined }, steps: [] };
      if (r > 0) {
        const before = await state(page);
        await pressNext(page);
        const tNext = Date.now();
        await waitReady(page, 20000);
        round.nextToInputReadyMs = Date.now() - tNext;
        const s = await state(page);
        round.startsAtDepth = s.hudM;
        round.startsAtExpected = expectTotal.reduce((a, b) => a + b, 0) * 10;
        round.cameraStartsAtNewDepth = metres(s.hudM) === round.startsAtExpected;
        void before;
      }
      const secs0 = (await state(page)).secs;

      if (r === 0) {
        round.steps.push({ case: 'empty submit', ...(await submit(page, '')) });
        round.steps.push({ case: 'non-answer', ...(await submit(page, o.nonAnswer, { measure: true })) });
        await run.shot('wrong-guess');
        round.steps.push({ case: '500 chars', ...(await submit(page, 'x'.repeat(500))) });
        round.steps.push({ case: 'emoji', ...(await submit(page, '🐟🙏✝️')) });
        round.steps.push({ case: 'html injection', ...(await submit(page, '<img src=x onerror=alert(1)>')) });
        if (o.near) round.steps.push({ case: 'near miss', ...(await submit(page, o.near)) });
        const accepting = o.typo ? o.typoOf : (o.byTier[3] || o.byTier[1]);
        if (o.typo) {
          round.steps.push({ case: 'typo -> suggestion', expect: o.typoOf, ...(await submit(page, o.typo, { measure: true })) });
          await run.shot('correction');
          if (o.typo2) round.steps.push({ case: 'edit re-evaluates', ...(await submit(page, o.typo2)) });
        }
        round.secsAfterMisses = (await state(page)).secs;
        round.timerKeptRunning = Number(round.secsAfterMisses) < Number(secs0);
        // Confirm the suggestion (the field now holds the answer), pressing Enter twice.
        if (o.typo) {
          await page.evaluate(() => window.__startFrames());
          const t = Date.now();
          await page.press('#answer', 'Enter');
          await page.press('#answer', 'Enter').catch(() => {});
          await waitResult(page);
          round.acceptToResultMs = Date.now() - t;
          round.fps = await page.evaluate(() => window.__stopFrames());
          round.accepted = accepting;
        } else {
          const res = await acceptAndSink(page, run, accepting, 'r1');
          Object.assign(round, res);
          round.accepted = accepting;
        }
        await H.sleep(700);
        if (r === 0) await run.shot('r1-result');
      } else if (r === 1) {
        const ans = o.sheep || o.byTier[5];
        round.steps.push({ case: 'case + whitespace', input: '  ' + ans.toUpperCase() + '  ' });
        Object.assign(round, await acceptAndSink(page, run, '  ' + ans.toUpperCase() + '  ', 'r2'));
        round.accepted = ans;
        out.axe.push(await H.axeScan(page, 'result'));
      } else if (r === 2) {
        if (o.typo) round.steps.push({ case: 'suggestion left unconfirmed', ...(await submit(page, o.typo)) });
        else round.steps.push({ case: 'text left in field', ...(await submit(page, o.nonAnswer)) });
        await page.fill('#answer', o.typo || 'left in the box');
        const t = Date.now();
        await page.waitForSelector('#next', { timeout: 40000 });
        round.timeoutWaitMs = Date.now() - t;
        await H.sleep(900);
        await run.shot('timeout');
        round.accepted = null;
      } else if (r === 3) {
        const ans = o.byTier[1];
        Object.assign(round, await acceptAndSink(page, run, ans, 'r4'));
        round.accepted = ans;
      } else if (r === 4) {
        round.steps.push({ case: 'non-answer then refresh mid-round', ...(await submit(page, o.nonAnswer)) });
        const secsBefore = (await state(page)).secs;
        await page.reload();
        await page.waitForSelector('#go');
        await closeDialogs(page);
        round.afterRefresh = { home: await page.textContent('#go'), resultsStored: (await state(page)).results };
        await pressKey(page, '#go');
        await waitReady(page, 20000);
        const secsAfter = (await state(page)).secs;
        round.refresh = { secsBefore, secsAfter, timerKeptRunning: Number(secsAfter) <= Number(secsBefore) };
        const ans = o.alias ? o.alias.alias : (o.seat || o.byTier[5] || o.byTier[3]);
        round.steps.push({ case: o.alias ? 'alias / KJV spelling' : 'best seat', input: ans });
        Object.assign(round, await acceptAndSink(page, run, ans, 'r5'));
        round.accepted = o.alias ? o.alias.of : ans;
      } else if (r === 5) {
        if (o.prefix) {
          round.steps.push({ case: 'prefix -> suggestion', expect: o.prefixOf, ...(await submit(page, o.prefix)) });
        }
        // A second tab with the same game.
        const tab2 = await run.context.newPage();
        await tab2.goto(URL);
        await tab2.waitForSelector('#go', { timeout: 10000 });
        await tab2.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
        round.secondTab = { button: await tab2.textContent('#go') };
        await tab2.close();
        const ans = o.prefix ? null : (o.seat || o.byTier[4] || o.byTier[3]);
        if (o.prefix) {
          Object.assign(round, await acceptAndSink(page, run, (await state(page)).value, 'r6'));
          round.accepted = o.prefixOf;
        } else {
          Object.assign(round, await acceptAndSink(page, run, ans, 'r6'));
          round.accepted = ans;
        }
      } else if (r === 6) {
        const ans = o.byTier[5] || o.byTier[4] || o.byTier[3];
        await page.fill('#answer', ans);
        const t = Date.now();
        await page.press('#answer', 'Enter');
        await H.sleep(700);
        await run.shot('r7-before-refresh');
        await page.reload();                               // refresh mid-sink
        await page.waitForSelector('#go');
        await closeDialogs(page);
        round.refreshMidSink = { button: await page.textContent('#go'), resultsStored: (await state(page)).results, ms: Date.now() - t };
        round.accepted = ans;
      }

      const st = await page.evaluate(() => JSON.parse(localStorage.getItem('fishers.v1')).daily.results);
      const rec = st[r];
      round.recorded = rec ? { outcome: rec.outcome, name: rec.name || null, tier: rec.tier, points: rec.points } : null;
      if (rec) expectTotal.push(rec.points);
      if (round.accepted && rec) {
        const expectTier = o.tierOf(round.accepted);
        round.tierCorrect = expectTier == null ? 'unknown' : rec.tier === expectTier;
        round.pointsCorrect = rec.points === POINTS[rec.tier];
      }
      const s = await state(page);
      round.hudAfter = { m: s.hudM, score: s.hudScore };
      round.depthMatches = s.hudM == null || !/hud-on/.test(s.body) ? 'n/a (score panel hidden)' : metres(s.hudM) === expectTotal.reduce((a, b) => a + b, 0) * 10;
      round.cls = await page.evaluate(() => +(window.__cls || 0).toFixed(4));
      out.rounds.push(round);
    }

    // ---- end screen ----
    await pressKey(page, '#go');
    await page.waitForSelector('.end', { timeout: 15000 });
    await H.sleep(1500);
    await run.shot('end-screen');
    out.axe.push(await H.axeScan(page, 'end'));
    const end = await page.evaluate(() => ({
      score: document.querySelector('.end-big') && document.querySelector('.end-big').textContent,
      depth: document.querySelector('.end-depth') && document.querySelector('.end-depth').textContent,
      share: document.getElementById('share-card') && document.getElementById('share-card').textContent,
      until: document.getElementById('until') && document.getElementById('until').textContent,
      nextCast: document.querySelector('.next-cast') && document.querySelector('.next-cast').textContent,
      band: document.querySelector('.end-band') && document.querySelector('.end-band').textContent
    }));
    end.expected = expectTotal.reduce((a, b) => a + b, 0);
    end.totalsMatch = Number(end.score) === end.expected;
    end.shareFormatOk = /^Fishers #\d+ 🐟\n\d+ \/ 700\n\S+/u.test(end.share || '');
    await page.click('#copy');
    await H.sleep(300);
    end.copyButton = await page.textContent('#copy');
    end.clipboard = await page.evaluate(() => navigator.clipboard.readText().catch(() => null));
    await page.click('.catch-row[data-i="0"]');
    await page.click('.catch-row[data-i="1"]');
    end.expandedAtOnce = await page.$$eval('.catch-row[aria-expanded="true"]', (x) => x.length);
    await page.$eval('.catch-row[data-i="1"]', (el) => el.scrollIntoView({ block: 'start' }));
    await H.sleep(300);
    await run.shot('catch-expanded');
    out.end = end;

    // ---- daily locked, back button, navigation ----
    await page.reload();
    await page.waitForSelector('#go');
    await closeDialogs(page);
    out.checks.dailyLocked = { button: await page.textContent('#go') };
    await pressKey(page, '#go');
    await page.waitForSelector('.end', { timeout: 15000 });
    out.checks.dailyLocked.reopensResultsNotRound = true;
    out.checks.backButton = await page.goBack().then((r) => (r ? r.url() : 'no history entry (single page)')).catch((e) => 'error: ' + e.message);
    await page.goto(URL);
    await page.waitForSelector('#go');
    await closeDialogs(page);
    const nav = {};
    for (const [btn, sel] of [['endless', '#en-title'], ['archive', '#ar-title'], ['practice', '#pr-title']]) {
      await page.click('#' + btn);
      nav[btn] = !!(await page.waitForSelector(sel, { timeout: 5000 }).catch(() => null));
      await run.shot('nav-' + btn);
      await page.goto(URL); await page.waitForSelector('#go'); await closeDialogs(page);
    }
    out.checks.navigation = nav;
    out.checks.finalCls = await page.evaluate(() => +(window.__cls || 0).toFixed(4));
  } catch (e) {
    out.error = String(e && e.stack || e).slice(0, 800);
    await run.shot('error');
  }
  const fin = await run.finish();
  Object.assign(out, { media: { shots: fin.shots, video: fin.video, trace: fin.trace }, log: fin.log });
  return out;
}

// ---- Practice sink under CPU throttling or reduced motion ---------------------------------
async function practiceSink(viewport, { throttle, reducedMotion }) {
  const label = viewport + (throttle ? '-cpu' + throttle + 'x' : '') + (reducedMotion ? '-reduced-motion' : '');
  const run = await H.startRun('fishers', 'practice-' + label, { viewport, throttle, reducedMotion: reducedMotion ? 'reduce' : undefined, headed: A.headed });
  const { page } = run;
  const out = { label, sinks: [] };
  try {
    await page.goto(URL);
    await page.waitForSelector('#go');
    await closeDialogs(page);
    await page.click('#practice');
    await page.waitForSelector('#pr-go');
    await page.uncheck('#pr-timer');
    await page.click('#pr-go');
    for (let i = 0; i < 2; i++) {
      await waitReady(page, 20000);
      const text = await page.textContent('#prompt-text');
      const p = data.prompts.find((x) => x.prompt === text);
      const o = oracle(p);
      const ans = i === 0 ? (o.sheep || o.byTier[5]) : o.byTier[1];
      const res = await acceptAndSink(page, run, ans, 'practice-' + (i + 1));
      out.sinks.push({ prompt: p.id, answer: ans, tier: o.tierOf(ans), acceptToResultMs: res.acceptToResultMs, fps: res.fps });
      if (reducedMotion) out.veilUsed = await page.evaluate(() => !!document.querySelector('.veil'));
      if (i === 0) await pressNext(page);
    }
  } catch (e) { out.error = String(e).slice(0, 400); }
  const fin = await run.finish();
  out.media = { shots: fin.shots, video: fin.video };
  out.log = fin.log;
  return out;
}

(async () => {
  const server = await H.ensureServer(URL);
  const which = A.viewport === 'both' || !A.viewport ? ['phone', 'desktop'] : [A.viewport];
  const all = { game: 'fishers', date: H.stamp(), dailyIds, endless1Ids, runs: [] };
  for (const v of which) {
    console.log('Fishers daily on', v, '…');
    const r = await playDaily(v);
    all.runs.push(r);
    H.writeResult('fishers-' + v, r);
  }
  console.log('Practice sinks (phone, 4× CPU) …');
  all.throttled = await practiceSink('phone', { throttle: Number(A.throttle || 4) });
  console.log('Practice sinks (reduced motion) …');
  all.reducedMotion = await practiceSink('phone', { reducedMotion: true });
  const file = H.writeResult('fishers', all);
  console.log('Wrote', path.relative(H.REPO, file));
  if (server) server.kill();
})();
