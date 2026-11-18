#!/usr/bin/env node
/* Fishers: replace estimated tiers with tiers from real answer counts.
 *
 *     node backend/recalc-tiers.js counts.json [--min 200] [--write]
 *
 * counts.json is what the Worker's /export endpoint returns:
 *     { "matched": { "creatures": { "Lion": 412, "Hoopoe": 3, ... } },
 *       "unmatched": { "creatures": { "cat": 31, ... } } }
 *
 * For each prompt with at least --min accepted answers, every answer's tier
 * is set from its share of those answers:
 *
 *     10% or more   Mustard Seed        1% to 3%     Lost Coin
 *     3% to 10%     Five Loaves         under 1%     Hidden Treasure
 *
 * The hand-picked Lost Sheep and Best Seat keep their places. The result is
 * written to content/real-tiers.json, which tools/build-prompts.js applies
 * after its own estimate and uses to mark those prompts rarity.estimated =
 * false. Without --write it only prints what would change.
 *
 * It also lists the most common unmatched answers: the best way to find valid
 * answers, or near misses, that a bank is missing.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const countsFile = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a));
const min = args.includes('--min') ? Number(args[args.indexOf('--min') + 1]) : 200;
const write = args.includes('--write');
if (!countsFile) { console.error('usage: node backend/recalc-tiers.js counts.json [--min 200] [--write]'); process.exit(1); }

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'prompts.json'), 'utf8'));
const counts = JSON.parse(fs.readFileSync(countsFile, 'utf8'));
const outFile = path.join(ROOT, 'content', 'real-tiers.json');
const real = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};

function tierFor(share) {
  if (share >= 0.10) return 1;
  if (share >= 0.03) return 3;
  if (share >= 0.01) return 4;
  return 5;
}

let changed = 0;
for (const p of data.prompts) {
  const c = (counts.matched || {})[p.id] || {};
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  if (total < min) continue;
  const tiers = {};
  let moved = 0;
  for (const a of p.answers) {
    if (a.tier === 6 || a.tier === 2) continue;           // hand-picked: kept
    const t = tierFor((c[a.name] || 0) / total);
    if (t !== a.tier) { moved++; console.log(`[${p.id}] ${a.name}: tier ${a.tier} -> ${t} (${c[a.name] || 0}/${total})`); }
    tiers[a.name] = t;
  }
  real[p.id] = { sample: total, updated: new Date().toISOString().slice(0, 10), tiers };
  changed++;
  console.log(`[${p.id}] ${moved} answers would change tier, from ${total} answers`);
}

for (const [id, c] of Object.entries(counts.unmatched || {})) {
  const top = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).filter(e => e[1] >= 5);
  if (top.length) console.log(`[${id}] common unmatched answers: ` + top.map(e => `${e[0]} (${e[1]})`).join(', '));
}

console.log(changed + ' prompts had enough data (minimum ' + min + ').');
if (write && changed) {
  fs.writeFileSync(outFile, JSON.stringify(real, null, 1) + '\n');
  console.log('Wrote content/real-tiers.json. Now run the build: node tools/build-prompts.js && node tools/verify.js && node tools/validate.js && node tools/sync-data.js');
} else if (changed) console.log('Dry run. Add --write to save.');
