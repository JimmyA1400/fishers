#!/usr/bin/env node
/* Prints the next 7 dailies from data/schedule.json (Eastern dates).
 *     node scripts/print-week.js [YYYY-MM-DD]
 */
'use strict';
const D = require('../js/daily.js');
const S = require('../js/schedule.js');
const data = require('../data/prompts.json');
const sched = require('../data/schedule.json');
const byId = {};
data.prompts.forEach((p) => { byId[p.id] = p; });
const start = process.argv[2] || D.addDays(D.dateKey(new Date()), 1);
for (let i = 0; i < 7; i++) {
  const k = D.addDays(start, i);
  const ids = S.dailyIds(data, sched, k, { epoch: '2026-11-17' });
  console.log('Fishers #' + (D.dayNumber(k, '2026-11-17') + 1) + '  ' + k + (sched.days[k] ? '' : '  (fallback)'));
  ids.forEach((id, r) => {
    const p = byId[id];
    console.log('  ' + (r + 1) + '. ' + p.prompt + '  [' + id + ', ' + p.category + (p.closed ? ', closed' : '') + ', ' + p.family + ']');
  });
}
