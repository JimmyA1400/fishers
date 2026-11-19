'use strict';
// The daily schedule: rules, freeze, fallback, ID permanence, Endless.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const D = require('../js/daily.js');
const S = require('../js/schedule.js');

const ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'prompts.json'), 'utf8'));
const sched = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'schedule.json'), 'utf8'));
const CFG = { epoch: '2026-11-17', promptsPerDay: 7 };

test('the days that aired before the schedule are exactly what the old picker gave', () => {
  for (const k of ['2026-11-17', '2026-11-18', '2026-11-19']) {
    assert.deepEqual(sched.days[k], D.pickDaily(data, k, CFG).map((p) => p.id), k);
  }
});

test('a simulated year with the real pool passes every hard rule in force', () => {
  const res = S.check(data, sched, { from: '2026-11-20' });
  assert.deepEqual(res.violations, []);
  const days = Object.keys(sched.days).filter((k) => k >= '2026-11-20');
  assert.ok(days.length >= 365, 'at least a year scheduled (' + days.length + ')');
  assert.ok(S.rulesFor(sched).cooldown >= S.FLOOR, 'cooldown at or above the floor');
});

test('the checker catches broken rules', () => {
  const bad = JSON.parse(JSON.stringify(sched));
  const a = bad.days['2026-12-01'], b = bad.days['2026-12-02'];
  b[3] = a[3];                                     // a repeat from yesterday
  const v = S.check(data, bad, { from: '2026-11-20' }).violations.join('\n');
  assert.match(v, /2026-12-02: .*also yesterday/);
  assert.match(v, /back after 1 days/);
});

test('every scheduled and every bank prompt ID is in the permanent ledger', () => {
  const ledger = fs.readFileSync(path.join(ROOT, 'content', 'prompt-ids.txt'), 'utf8')
    .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const bank = new Set(data.prompts.map((p) => p.id));
  assert.equal(new Set(ledger).size, ledger.length, 'no ID twice in the ledger');
  for (const id of ledger) assert.ok(bank.has(id), id + ' left the bank (retire it with "retired": true instead)');
  for (const id of bank) assert.ok(ledger.includes(id), id + ' is new: append it to content/prompt-ids.txt');
  for (const [k, ids] of Object.entries(sched.days)) for (const id of ids) assert.ok(bank.has(id), k + ': ' + id);
});

test('retired prompts are never picked for a future day, Endless or the fallback', () => {
  const copy = JSON.parse(JSON.stringify(data));
  const gone = sched.days['2026-11-25'][0];
  copy.prompts.find((p) => p.id === gone).retired = true;
  S._resetMemo();
  const v = S.check(copy, sched, { from: '2026-11-20' }).violations;
  assert.ok(v.some((m) => m.includes(gone + ' is retired')), 'the checker flags a retired prompt on a future day');
  for (let n = 1; n <= 5; n++) assert.ok(!S.endlessIds(copy, sched, n, '2026-11-20', CFG).includes(gone));
  assert.ok(!S.fallback(copy, sched, D.addDays(S.lastKey(sched), 2)).includes(gone));
  S._resetMemo();
});

test('the fallback picker is deterministic and keeps the hard rules', () => {
  S._resetMemo();
  const end = S.lastKey(sched);
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => D.addDays(end, n));
  const a = keys.map((k) => S.dailyIds(data, sched, k, CFG));
  S._resetMemo();
  const b = keys.slice().reverse().map((k) => S.dailyIds(data, sched, k, CFG)).reverse();
  assert.deepEqual(a, b, 'same answer whatever order the dates are asked in');
  // Extend the schedule with the fallback days and check the rules on them.
  const ext = JSON.parse(JSON.stringify(sched));
  keys.forEach((k, i) => { ext.days[k] = a[i]; });
  const v = S.check(data, ext, { from: keys[0] }).violations.filter((m) => !/shares \d prompts with/.test(m));
  assert.deepEqual(v, [], 'fallback days keep every rule (the pair rule is checked against 30 days only)');
  S._resetMemo();
});

test('regenerating never changes frozen dates', () => {
  const tmp = path.join(os.tmpdir(), 'fishers-sched-' + process.pid + '.json');
  fs.copyFileSync(path.join(ROOT, 'data', 'schedule.json'), tmp);
  try {
    // A later "today" and a different seed: everything on or before
    // tomorrow must stay; later dates may change.
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-schedule.js'), '--today', '2026-11-24', '--seed', 'other',
      '--restarts', '2', '--swaps', '0', '--days', '120', '--out', tmp], { stdio: 'pipe' });
    const next = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    for (let k = '2026-11-17'; k <= '2026-11-25'; k = D.addDays(k, 1)) assert.deepEqual(next.days[k], sched.days[k], k + ' is frozen');
    assert.deepEqual(S.check(data, next, { from: '2026-11-25' }).violations, []);
  } finally { fs.rmSync(tmp, { force: true }); }
});

test('Endless never uses a prompt due as a daily in the next 14 days (when the pool allows)', () => {
  // A schedule whose next 14 days use 40 prompts: Endless must avoid all of them.
  const ids = data.prompts.map((p) => p.id);
  const fake = { days: {} };
  const used = new Set();
  for (let d = 0; d < 14; d++) {
    const day = [];
    for (let k = 0; k < 7; k++) { const id = ids[(d * 7 + k) % 40]; day.push(id); used.add(id); }
    fake.days[D.addDays('2027-01-01', d)] = day;
  }
  S._resetMemo();
  for (let n = 1; n <= 30; n++) {
    const cast = S.endlessIds(data, fake, n, '2027-01-01', CFG);
    assert.equal(new Set(cast).size, 7, 'seven different prompts');
    for (const id of cast) assert.ok(!used.has(id), 'Endless #' + n + ' has ' + id);
    const fams = new Set(cast.map((id) => data.prompts.find((p) => p.id === id).family));
    assert.equal(fams.size, 7, 'one prompt per family');
  }
  S._resetMemo();
});

test('Endless on the real schedule keeps the furthest-out prompts and is the same for everyone that day', () => {
  S._resetMemo();
  const key = '2026-11-20';
  const soon = S.upcoming(data, sched, key, 14, CFG);
  for (let n = 1; n <= 10; n++) {
    const a = S.endlessIds(data, sched, n, key, CFG), b = S.endlessIds(data, sched, n, key, CFG);
    assert.deepEqual(a, b);
    assert.equal(new Set(a).size, 7);
    for (const id of a) assert.ok(!(id in soon) || soon[id] >= 7, 'Endless #' + n + ': ' + id + ' is due in ' + soon[id] + ' days');
  }
  S._resetMemo();
});
