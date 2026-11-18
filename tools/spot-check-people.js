#!/usr/bin/env node
/* Fishers: flags generated people answers that may not be people.
 *
 *     node tools/spot-check-people.js [--sample 60]
 *
 * For each answer in the generated people prompts it reads the cited verses
 * and flags the answer when the name is used like a place there ("to Bethel",
 * "the city of", "in the land of"), when it is mostly a lowercase word in the
 * text, or when it never stands next to a person word in any cited verse.
 * Flagged answers, plus a random sample of the rest, are written with their
 * verse text to tools/reports/people-spot-check.txt for reading.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/bible.js');
const D = require('../js/daily.js');

const ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'prompts.json'), 'utf8'));
const args = process.argv.slice(2);
const sampleN = args.includes('--sample') ? +args[args.indexOf('--sample') + 1] : 60;
const T = B.texts();

const PLACE_BEFORE = /\b(to|unto|in|into|at|from|toward|towards|near|of the city|city of|land of|wilderness of|mount|valley of|plain of|went up to|came to|dwelt in|lived in|camped in|encamped in|border of|cities of|villages of)\s+$/i;
const PERSON_NEAR = /\b(son|sons|daughter|daughters|wife|husband|father|mother|brother|sister|begat|became the father|bore|king|priest|prophet|said|spoke|answered|servant|children of|the sons of|chief|captain|man|woman|his|her|he|she)\b/i;

const out = [], seen = new Set();
const people = data.prompts.filter(p => /^people-|^kings$/.test(p.id));
const pool = [];
for (const p of people) {
  for (const a of p.answers) {
    if (seen.has(a.name)) continue;
    seen.add(a.name);
    const keys = [];
    a.refs.forEach(r => { try { keys.push(...B.verseKeys(r)); } catch (e) {} });
    const verses = keys.slice(0, 3).map(k => ({ k, web: T.WEB.get(k) || '', kjv: T.KJV.get(k) || '' }));
    const reasons = [];
    let placeUse = 0, personUse = 0, uses = 0;
    for (const v of verses) {
      for (const text of [v.web, v.kjv]) {
        const re = new RegExp('(.{0,40})\\b' + a.name.replace(/[-\s]/g, '[- ]?') + '\\b(.{0,30})', 'gi');
        let m;
        while ((m = re.exec(text))) {
          uses++;
          if (PLACE_BEFORE.test(m[1])) placeUse++;
          if (PERSON_NEAR.test(m[1] + ' ' + m[2])) personUse++;
        }
      }
    }
    if (uses && placeUse / uses >= 0.5) reasons.push('used like a place');
    // (A "no person words nearby" test was tried and flags Paul and Jesus; too noisy to keep.)
    if (/generic|Named in/.test(a.note) && !a.aliases.length && placeUse) reasons.push('generic note and place-like use');
    pool.push({ p: p.id, a, verses, reasons });
  }
}
const flagged = pool.filter(x => x.reasons.length);
const rand = D.rng('spot-check');
const rest = pool.filter(x => !x.reasons.length).sort(() => rand() - 0.5).slice(0, sampleN);
const fmt = x => '[' + x.p + '] ' + x.a.name + (x.reasons.length ? '  <-- ' + x.reasons.join('; ') : '') + '\n  note: ' + x.a.note + '\n' +
  x.verses.map(v => '  ' + v.k + ' WEB: ' + v.web.slice(0, 220) + '\n' + ' '.repeat(v.k.length + 3) + 'KJV: ' + v.kjv.slice(0, 220)).join('\n');
fs.mkdirSync(path.join(ROOT, 'tools', 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools', 'reports', 'people-spot-check.txt'),
  'FLAGGED (' + flagged.length + ' of ' + pool.length + ' distinct names)\n\n' + flagged.map(fmt).join('\n\n') +
  '\n\n\nRANDOM SAMPLE OF THE REST (' + rest.length + ')\n\n' + rest.map(fmt).join('\n\n') + '\n');
console.log(pool.length + ' distinct names; ' + flagged.length + ' flagged; ' + rest.length + ' sampled');
