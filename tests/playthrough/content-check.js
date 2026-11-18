// Fishers content spot-check: 40 random answers checked against the WEB/KJV at
// their cited verses, plus per-prompt bank stats. Writes results/content.json.
//
//   node content-check.js [--n 40] [--seed any-text]
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const B = require(path.join(H.REPO, 'tools', 'lib', 'bible.js'));

const A = H.args();
const N = Number(A.n || 40);
const data = JSON.parse(fs.readFileSync(path.join(H.REPO, 'data', 'prompts.json'), 'utf8'));

// Small seeded RNG so a run can be repeated.
function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const rand = rng(String(A.seed || H.stamp()));

const all = [];
data.prompts.forEach((p) => p.answers.forEach((a) => all.push({ p, a })));
const sample = [];
const used = new Set();
while (sample.length < Math.min(N, all.length)) {
  const i = Math.floor(rand() * all.length);
  if (!used.has(i)) { used.add(i); sample.push(all[i]); }
}

const spot = sample.map(({ p, a }) => {
  const row = { prompt: p.id, answer: a.name, tier: a.tier, refs: a.refs, found: [], verse: null, problems: [] };
  for (const ref of a.refs || []) {
    try { B.verseKeys(ref); } catch (e) { row.problems.push('reference not in the 66 books: ' + ref); }
  }
  if (p.described || p.books) {
    row.note = p.books ? 'book-name prompt: checked against the 66 book names' : 'description prompt: checked by anchor words (see tools/verify.js)';
  } else {
    try {
      row.found = B.foundAt(a.name, a.refs || []);
      if (!row.found.length) {
        const alt = (a.aliases || []).find((al) => B.foundAt(al, a.refs || []).length);
        if (alt) row.foundVia = alt; else row.problems.push('name not found at its cited verses');
      }
      const first = (a.refs || [])[0];
      if (first) { const k = B.verseKeys(first)[0]; row.verse = (B.verseText(k, 'WEB') || '').slice(0, 220); }
    } catch (e) { row.problems.push(String(e.message || e)); }
  }
  return row;
});

const banks = data.prompts.map((p) => {
  const dist = [0, 0, 0, 0, 0, 0, 0];
  p.answers.forEach((a) => dist[a.tier]++);
  const flags = [];
  if (!p.closed && p.answers.length < 60) flags.push('bank under 60 and not closed');
  if (dist[6] !== 1) flags.push('Lost Sheep count is ' + dist[6]);
  if (dist[2] > 1) flags.push('Best Seat count is ' + dist[2]);
  return { id: p.id, category: p.category, prompt: p.prompt, closed: !!p.closed, size: p.answers.length, tiers: dist.slice(1), nearMisses: (p.nearMisses || []).length, flags };
});

const out = {
  date: H.stamp(), sampleSize: spot.length,
  spotCheck: spot,
  spotProblems: spot.filter((r) => r.problems.length),
  banks,
  bankFlags: banks.filter((b) => b.flags.length),
  totals: { prompts: data.prompts.length, answers: all.length, closed: banks.filter((b) => b.closed).length }
};
const file = H.writeResult('content', out);
console.log('Spot-checked', spot.length, 'answers;', out.spotProblems.length, 'with problems;', out.bankFlags.length, 'prompts flagged. Wrote', path.relative(H.REPO, file));
