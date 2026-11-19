#!/usr/bin/env node
/* Fishers: checks data/schedule.json against every hard rule.
 *
 *     node scripts/check-schedule.js [--today YYYY-MM-DD] [--base old-schedule.json] [--strict]
 *
 * Fails (exit 1) if:
 *   - any date after today (Eastern) breaks a rule in force (js/schedule.js
 *     RULES with the overrides recorded in the schedule);
 *   - fewer than 60 future days are scheduled;
 *   - a frozen date (on or before tomorrow in --base, the deployed schedule)
 *     differs, or a day aired before the schedule existed no longer matches
 *     what the old picker gave;
 *   - with --strict, any date breaks the target rules (no overrides).
 * Prints cooldowns, the worst overlap, per-day family and category counts,
 * appearance counts, and the days remaining.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../js/daily.js');
const S = require('../js/schedule.js');

const ROOT = path.join(__dirname, '..');
const EPOCH = '2026-11-17';
const LEGACY_THROUGH = '2026-11-19';   // the last day that aired before the schedule existed
const MIN_FUTURE = 60;

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; }
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'prompts.json'), 'utf8'));
const file = arg('file', path.join(ROOT, 'data', 'schedule.json'));
const sched = JSON.parse(fs.readFileSync(file, 'utf8'));
const today = arg('today', D.dateKey(new Date()));
const from = D.addDays(today, 1);
const strict = process.argv.includes('--strict');
const fail = [];

// 1. Hard rules in force.
const res = S.check(data, sched, { from });
res.violations.forEach((m) => fail.push('rule: ' + m));
const R = S.rulesFor(sched);
if (R.cooldown < S.FLOOR) fail.push('cooldown setting ' + R.cooldown + ' is below the absolute floor of ' + S.FLOOR);

// 2. Days remaining.
const last = S.lastKey(sched);
const remaining = D.dayNumber(last, today);
if (remaining < MIN_FUTURE) fail.push('only ' + remaining + ' future days scheduled (need ' + MIN_FUTURE + ')');

// 3. Frozen and aired days.
for (let k = EPOCH; k <= LEGACY_THROUGH; k = D.addDays(k, 1)) {
  const aired = D.pickDaily(data, k, { epoch: EPOCH, promptsPerDay: 7 }).map((p) => p.id);
  if (JSON.stringify(sched.days[k]) !== JSON.stringify(aired)) fail.push('frozen: ' + k + ' differs from what aired');
}
const basePath = arg('base', '');
if (basePath) {
  if (fs.existsSync(basePath) && fs.statSync(basePath).size > 0) {
    const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
    const until = D.addDays(today, 1);
    let n = 0;
    for (const k of Object.keys(base.days).sort()) {
      if (k > until) break;
      n++;
      if (JSON.stringify(base.days[k]) !== JSON.stringify(sched.days[k])) fail.push('frozen: ' + k + ' changed from the deployed schedule');
    }
    console.log('Frozen dates checked against ' + path.basename(basePath) + ': ' + n + ' (through ' + until + ')');
  } else console.log('No deployed schedule to compare (first schedule)');
}

// 4. Stats.
const st = res.stats;
if (st) {
  const h = st.history, fromI = D.dayNumber(from, st.keys[0]);
  const gapsAll = [];
  const per = [];
  for (const id of Object.keys(st.gaps)) {
    const g = st.gaps[id];
    if (!g.length) continue;
    const s = g.slice().sort((a, b) => a - b);
    per.push({ id, min: s[0], med: s[Math.floor(s.length / 2)], max: s[s.length - 1], n: g.length });
    gapsAll.push(...g);
  }
  gapsAll.sort((a, b) => a - b);
  const avg = gapsAll.reduce((a, b) => a + b, 0) / (gapsAll.length || 1);
  console.log('\nRules in force: cooldown ' + R.cooldown + ', pairs <= ' + R.pairMax + ' in ' + R.pairWindow + ' days, closed sets <= ' + R.closedMax +
    ', People <= ' + R.categoryMax.People + ', Places <= ' + R.categoryMax.Places + ', categories >= ' + R.minCategories);
  console.log('Checked ' + (h.days.length - fromI) + ' future days (' + from + ' to ' + last + '); ' + remaining + ' days of schedule left');
  console.log('Cooldown (days since the prompt or a twin last aired), over future days:');
  console.log('  min ' + gapsAll[0] + ', median ' + gapsAll[Math.floor(gapsAll.length / 2)] + ', average ' + avg.toFixed(1) + ', max ' + gapsAll[gapsAll.length - 1]);
  per.sort((a, b) => a.min - b.min || a.med - b.med);
  console.log('  per prompt (min / median / max):');
  for (let k = 0; k < per.length; k += 3) {
    console.log('    ' + per.slice(k, k + 3).map((p) => (p.id + ' ').padEnd(24) + (p.min + '/' + p.med + '/' + p.max).padEnd(10)).join(''));
  }
  // Worst overlap between any two days in the window.
  let worst = 0, worstPair = '';
  for (let i = fromI; i < h.days.length; i++) {
    const c = {};
    for (const id of h.days[i]) for (const a of h.apps[id]) if (a[0] < i && i - a[0] < 365) c[a[0]] = (c[a[0]] || 0) + 1;
    for (const e of Object.keys(c)) if (c[e] > worst) { worst = c[e]; worstPair = h.key(+e) + ' & ' + h.key(i); }
  }
  console.log('Worst overlap between two days within 365 days: ' + worst + ' prompts (' + worstPair + ')');
  // Per-day family and category counts.
  const closedHist = {}, catHist = {}, famMax = {};
  const ix = S.index(data, sched);
  for (let i = fromI; i < h.days.length; i++) {
    const ids = h.days[i];
    const closed = ids.filter(ix.closed).length;
    closedHist[closed] = (closedHist[closed] || 0) + 1;
    const cats = new Set(ids.map(ix.cat)).size;
    catHist[cats] = (catHist[cats] || 0) + 1;
    const fams = {};
    ids.forEach((id) => { fams[ix.fam(id)] = (fams[ix.fam(id)] || 0) + 1; });
    const m = Math.max(...Object.values(fams));
    famMax[m] = (famMax[m] || 0) + 1;
  }
  const fmt = (o) => Object.keys(o).sort().map((k) => k + ': ' + o[k] + ' days').join(', ');
  console.log('Closed sets per day: ' + fmt(closedHist));
  console.log('Categories per day: ' + fmt(catHist));
  console.log('Most prompts from one family in a day: ' + fmt(famMax));
  // Appearances over the next 365 days.
  const yearEnd = Math.min(h.days.length, fromI + 365), count = {};
  ix.active.forEach((id) => { count[id] = 0; });
  for (let i = fromI; i < yearEnd; i++) h.days[i].forEach((id) => { count[id] = (count[id] || 0) + 1; });
  const cs = Object.entries(count).sort((a, b) => a[1] - b[1]);
  console.log('Appearances in the next ' + (yearEnd - fromI) + ' days: fewest ' + cs.slice(0, 3).map((e) => e[0] + ' ' + e[1]).join(', ') +
    '; most ' + cs.slice(-3).map((e) => e[0] + ' ' + e[1]).join(', ') + '; active prompts ' + ix.active.length);
}

// 5. Target rules (the spec), reported always, enforced with --strict.
const target = S.check(data, Object.assign({}, sched, { rules: {} }), { from });
const tv = target.violations.length;
if (Object.keys(sched.rules || {}).length) {
  console.log('\nTarget rules (cooldown ' + S.RULES.cooldown + ', closed sets <= ' + S.RULES.closedMax + '): ' + (tv ? tv + ' breaks; the pool is too small for them (see PROGRESS.md)' : 'all met'));
  if (strict && tv) target.violations.slice(0, 20).forEach((m) => fail.push('target: ' + m));
}

if (fail.length) {
  console.error('\nFAIL (' + fail.length + '):\n  ' + fail.slice(0, 40).join('\n  ') + (fail.length > 40 ? '\n  ...' : ''));
  process.exit(1);
}
console.log('\nSchedule OK');
