#!/usr/bin/env node
/* Fishers: builds data/schedule.json, the daily cast for every date.
 *
 *     node scripts/build-schedule.js [--today YYYY-MM-DD] [--days 400] [--seed fishers] [--restarts 6] [--swaps 40000]
 *
 * - Frozen: every date on or before tomorrow (Eastern) that the existing
 *   schedule.json already has is kept exactly. Past dates it does not have
 *   are backfilled from the picker the game used before the schedule existed,
 *   so the Archive and old share results still match what aired.
 * - Later dates are rebuilt: a seeded greedy pass day by day under every hard
 *   rule in js/schedule.js (with backtracking and restarts), then a swap
 *   search on the soft goals that only touches unfrozen dates.
 * - Same seed + same pool + same frozen days = the same output.
 *
 * The rules are js/schedule.js RULES, with any overrides in
 * scripts/schedule-rules.json (used while the pool is too small for them).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../js/daily.js');
const S = require('../js/schedule.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'schedule.json');
const EPOCH = '2026-11-17';
const CFG = { epoch: EPOCH, promptsPerDay: 7 };

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
}

function load() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'prompts.json'), 'utf8'));
}
function overrides() {
  const f = path.join(__dirname, 'schedule-rules.json');
  if (!fs.existsSync(f)) return null;
  const o = JSON.parse(fs.readFileSync(f, 'utf8'));
  delete o._why;
  return o;
}

// ---------- soft goals ---------------------------------------------------
// Lower is better. Short gaps cost the most (this raises the minimum and
// evens out each prompt's appearances); pairs that meet twice within 90 days
// and lopsided weeks cost a little.
const TARGET = 30;
function gapCost(g) { return g >= TARGET ? 0 : (TARGET - g) * (TARGET - g); }

function softScore(days, ix, fromI) {
  const apps = {};
  days.forEach((ids, i) => ids.forEach((id) => (apps[id] = apps[id] || []).push(i)));
  let cost = 0;
  for (const id of Object.keys(apps)) {
    const tw = ix.twins[id] || [id];
    const all = [].concat(...tw.map((t) => apps[t] || [])).sort((a, b) => a - b);
    for (const i of apps[id]) {
      if (i < fromI) continue;
      let prev = -1;
      for (const j of all) if (j < i) prev = j;
      if (prev >= 0) cost += gapCost(i - prev);
    }
  }
  cost += pairRepeats(days, fromI) * 4;
  return cost;
}
function pairRepeats(days, fromI) {
  const seen = new Map();
  let n = 0;
  days.forEach((ids, i) => {
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      const k = ids[a] < ids[b] ? ids[a] + '|' + ids[b] : ids[b] + '|' + ids[a];
      const last = seen.get(k);
      if (last != null && i - last < 90 && i >= fromI) n++;
      seen.set(k, i);
    }
  });
  return n;
}

function pairCounts(h, i, ids, R) {
  const c = {};
  for (const id of ids) for (const a of h.apps[id] || []) if (a[0] < i && i - a[0] < R.pairWindow) c[a[0]] = (c[a[0]] || 0) + 1;
  return c;
}

// ---------- greedy construction --------------------------------------------
function buildFuture(ix, R, kept, start, endI, seed, reuse) {
  const h = new S.History(start);
  kept.forEach((ids) => h.push(ids));
  // reuse: the old schedule's later days, kept while they still pass every
  // rule (a fallback when a fresh build fails); the rest is built fresh.
  if (reuse) {
    for (const ids of reuse) {
      const i = h.days.length;
      if (i > endI || ids.some((id, k) => S.blocks(ix, R, h, i, ids.slice(0, k), id, pairCounts(h, i, ids.slice(0, k), R)))) break;
      if (!S.orderDay(ix, h, i, ids, null) || ids.length !== R.perDay) break;
      h.push(ids);
    }
  }
  const fromI = h.days.length, att = {};
  let i = fromI, backs = 0;
  while (i <= endI) {
    const key = h.key(i);
    const rnd = D.rng(seed + '|' + key + '|' + (att[i] || 0));
    const day = S.pickDay(ix, R, h, i, rnd, { nodes: 1500 });
    if (day) { h.push(day); i++; continue; }
    att[i] = (att[i] || 0) + 1;
    if (att[i] <= 3) continue;
    if (++backs > 400 || i === fromI) { if (process.env.SCHED_DEBUG) console.log("  stuck at " + h.key(i) + " after " + backs + " backtracks"); return null; }
    const back = Math.min(3 + Math.floor(backs / 25) * 3, i - fromI);   // reach further back the longer it is stuck
    for (let b = 0; b < back; b++) { h.pop(); i--; att[i] = (att[i] || 0) + 1; }
  }
  return h.days;
}

// ---------- swap search ----------------------------------------------------
// Replace one prompt on one unfrozen day with another, keeping every hard
// rule; accept if the soft cost falls (simulated annealing, cooling to zero).
function swapSearch(ix, R, days, fromI, seed, iters) {
  const rnd = D.rng(seed + '|swaps');
  const apps = {};
  days.forEach((ids, i) => ids.forEach((id) => (apps[id] = apps[id] || []).push(i)));
  const near = (id, i) => {                 // nearest days before and after i (any twin)
    let before = -1e9, after = 1e9;
    for (const t of ix.twins[id] || [id]) for (const j of apps[t] || []) {
      if (j < i && j > before) before = j;
      if (j > i && j < after) after = j;
    }
    return [before, after];
  };
  const roundOf = (id, j) => days[j].indexOf(id);
  const prevOwn = (id, i) => { let p = -1; for (const j of apps[id] || []) if (j < i) p = j; return p; };
  const nextOwn = (id, i) => { for (const j of apps[id] || []) if (j > i) return j; return -1; };
  const pairCost = (id, i, list) => {      // partners of id on day i that also meet it within 90 days
    let c = 0;
    for (const j of apps[id] || []) {
      if (j === i || Math.abs(j - i) >= 90) continue;
      for (const x of list) if (x !== id && days[j].includes(x)) c += 4;
    }
    return c;
  };
  const okAt = (q, i, s, without) => {     // can q take slot s of day i in place of `without`?
    const day = days[i], others = day.filter((x) => x !== without);
    if (others.includes(q)) return false;
    if (S.blocks(ix, Object.assign({}, R, { cooldown: 0 }), { last: () => null, apps: {}, key: () => '' }, i, others, q, null)) return false;
    const cats = new Set(others.map(ix.cat).concat([ix.cat(q)]));
    if (cats.size < R.minCategories) return false;
    const [b, a] = near(q, i);
    if (i - b < R.cooldown || a - i < R.cooldown) return false;
    const po = prevOwn(q, i), no = nextOwn(q, i);
    if (po >= 0 && roundOf(q, po) === s) return false;
    if (no >= 0 && roundOf(q, no) === s) return false;
    if (i > 0 && days[i - 1][s] && ix.fam(days[i - 1][s]) === ix.fam(q)) return false;
    if (i + 1 < days.length && days[i + 1][s] && ix.fam(days[i + 1][s]) === ix.fam(q)) return false;
    // `without` leaving: its next appearance must not repeat its previous round
    const wp = prevOwn(without, i), wn = nextOwn(without, i);
    if (wp >= 0 && wn >= 0 && roundOf(without, wp) === roundOf(without, wn)) return false;
    // pairs: the new day shares at most pairMax with any day in the window
    const counts = {};
    for (const x of others.concat([q])) for (const j of apps[x] || []) {
      if (j === i || Math.abs(j - i) >= R.pairWindow) continue;
      counts[j] = (counts[j] || 0) + 1;
      if (counts[j] > R.pairMax) return false;
    }
    return true;
  };
  let accepted = 0;
  const span = days.length - fromI;
  if (span <= 0) return 0;
  for (let it = 0; it < iters; it++) {
    const temp = 6 * (1 - it / iters);
    const i = fromI + Math.floor(rnd() * span), s = Math.floor(rnd() * days[i].length), p = days[i][s];
    const q = ix.active[Math.floor(rnd() * ix.active.length)];
    if (q === p || !okAt(q, i, s, p)) continue;
    const others = days[i].filter((x) => x !== p);
    // p leaves: its gaps b->i and i->a become one gap b->a; q arrives: the
    // reverse. Pairs: q's partners today that meet it again within 90 days.
    const split = (id) => {
      const [b, a] = near(id, i), hb = b > -1e9, ha = a < 1e9;
      return (hb ? gapCost(i - b) : 0) + (ha ? gapCost(a - i) : 0) - (hb && ha ? gapCost(a - b) : 0);
    };
    const delta = split(q) - split(p) + pairCost(q, i, others) - pairCost(p, i, others);
    days[i][s] = q;
    apps[p] = apps[p].filter((j) => j !== i);
    (apps[q] = apps[q] || []).push(i); apps[q].sort((a, b) => a - b);
    if (delta <= 0 || rnd() < Math.exp(-delta / Math.max(temp, 1e-9))) { accepted++; continue; }
    // undo
    days[i][s] = p;
    apps[q] = apps[q].filter((j) => j !== i);
    apps[p].push(i); apps[p].sort((a, b) => a - b);
  }
  return accepted;
}

// ---------- main ------------------------------------------------------------
function main() {
  const data = load();
  const today = arg('today', D.dateKey(new Date()));
  const horizon = Number(arg('days', 400));
  const seed = arg('seed', 'fishers');
  const restarts = Number(arg('restarts', 6));
  const swaps = Number(arg('swaps', 40000));
  const out = arg('out', OUT);
  const old = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
  const rules = Object.assign({}, overrides() || {});
  const sched0 = { rules };
  const R = S.rulesFor(sched0);
  if (R.cooldown < S.FLOOR) throw new Error('cooldown ' + R.cooldown + ' is below the absolute floor of ' + S.FLOOR);
  const twins = S.computeTwins(data, R.twinOverlap);
  const ix = S.index(data, { rules, twins });

  // Frozen: dates on or before tomorrow that the old schedule has; past
  // dates it lacks come from the old picker (what aired).
  const freeze = D.addDays(today, 1), end = D.addDays(today, horizon);
  const kept = [];
  for (let k = EPOCH; k <= freeze; k = D.addDays(k, 1)) {
    if (old && old.days[k]) kept.push(old.days[k].slice());
    else if (k <= today) kept.push(D.pickDaily(data, k, CFG).map((p) => p.id));
    else break;
  }
  const endI = D.dayNumber(end, EPOCH), fromI = kept.length;

  let best = null, bestCost = Infinity;
  for (let r = 0; r < restarts; r++) {
    const days = buildFuture(ix, R, kept, EPOCH, endI, seed + '|' + r);
    if (!days) { console.log('restart ' + r + ': no schedule'); continue; }
    const cost = softScore(days, ix, fromI);
    console.log('restart ' + r + ': soft cost ' + Math.round(cost));
    if (cost < bestCost) { best = days; bestCost = cost; }
  }
  if (!best && old) {
    // A fresh build failed: keep the old schedule's later days that still
    // pass every rule, build only what follows, and let the swap search
    // improve the kept part.
    const reuse = [];
    for (let k = D.addDays(EPOCH, fromI); old.days[k]; k = D.addDays(k, 1)) reuse.push(old.days[k].slice());
    for (let r = 0; r < restarts && !best; r++) {
      best = buildFuture(ix, R, kept, EPOCH, endI, seed + '|reuse|' + r, reuse);
      if (best) { bestCost = softScore(best, ix, fromI); console.log('fresh builds failed; kept the old schedule later days where they still pass and built the rest'); }
    }
  }
  if (!best) { console.error('Could not build a schedule under these rules. See scripts/check-schedule.js and PROGRESS.md (pool size).'); process.exit(1); }
  const acc = swapSearch(ix, R, best, fromI, seed, swaps);
  console.log('swap search: ' + acc + ' swaps kept; soft cost ' + Math.round(bestCost) + ' -> ' + Math.round(softScore(best, ix, fromI)));

  const days = {};
  best.forEach((ids, i) => { days[D.addDays(EPOCH, i)] = ids; });
  const sched = {
    version: old ? old.version : 1,
    generatedAt: new Date().toISOString(),
    timeZone: 'America/New_York',
    seed, frozenThrough: D.addDays(EPOCH, fromI - 1), rules, twins, days
  };
  const v = S.check(data, sched, { from: D.addDays(EPOCH, fromI) });
  if (v.violations.length) {
    console.error(v.violations.slice(0, 30).join('\n'));
    console.error(v.violations.length + ' rule violations; not written');
    process.exit(1);
  }
  if (!old || JSON.stringify(old.days) !== JSON.stringify(days) || JSON.stringify(old.rules) !== JSON.stringify(rules)) sched.version = (old ? old.version : 0) + 1;
  else sched.generatedAt = old.generatedAt;
  fs.writeFileSync(out, JSON.stringify(sched, null, 0).replace(/("\d{4}-\d{2}-\d{2}":)/g, '\n$1') + '\n');
  console.log('Wrote ' + path.relative(ROOT, out) + ' v' + sched.version + ': ' + Object.keys(days).length + ' days (' +
    EPOCH + ' to ' + end + '), frozen through ' + sched.frozenThrough);
}

if (require.main === module) main();
module.exports = { softScore, pairRepeats };
