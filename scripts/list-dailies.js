#!/usr/bin/env node
/* Lists the daily casts the current picker gives for the 14 days before and
 * after a date (default: today, Eastern), and every prompt that comes back
 * within 7 or 14 days of its last appearance.
 *     node scripts/list-dailies.js [YYYY-MM-DD] [--days 14]
 */
'use strict';
const D = require('../js/daily.js');
const data = require('../data/prompts.json');
const CFG = { epoch: '2026-11-17', promptsPerDay: 7 };
const args = process.argv.slice(2);
const today = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || D.dateKey(new Date());
const span = Number((args[args.indexOf('--days') + 1]) || 14) || 14;
const pick = global.FSH_PICK || ((k) => D.pickDaily(data, k, CFG).map((p) => p.id));
const last = {}, rows = [], repeats = [];
for (let i = -span; i <= span; i++) {
  const k = D.addDays(today, i);
  if (k < CFG.epoch) continue;
  const ids = pick(k);
  const back = ids.filter((id) => last[id] && D.dayNumber(k, last[id]) <= 14).map((id) => id + ' (' + D.dayNumber(k, last[id]) + 'd)');
  const prev = rows.length ? rows[rows.length - 1].ids : [];
  const shared = ids.filter((id) => prev.includes(id));
  rows.push({ k, ids });
  if (back.length) repeats.push({ k, back, shared });
  ids.forEach((id) => { last[id] = k; });
  console.log(k + (k === today ? ' *' : '  ') + ' ' + ids.join(', ') + (shared.length ? '   <- shares ' + shared.length + ' with the day before' : ''));
}
console.log('\nPrompts back within 14 days:');
repeats.forEach((r) => console.log('  ' + r.k + ': ' + r.back.join(', ')));
console.log(repeats.length + ' of ' + rows.length + ' days repeat a prompt from the last 14 days; ' +
  repeats.filter((r) => r.shared.length).length + ' share prompts with the day before.');
