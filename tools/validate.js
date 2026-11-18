#!/usr/bin/env node
/* Fishers: checks the structure of the prompt bank. Run after building:
 *
 *     node tools/validate.js [data/prompts.json]
 *
 * (tools/verify.js checks the answers against the Bible text; this checks the
 * game rules and the matcher.)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const M = require('../js/matcher.js');

const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data', 'prompts.json'));
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [], warnings = [];
const ids = new Set();
const byCategory = {};

for (const p of data.prompts) {
  const tag = '[' + p.id + '] ';
  if (ids.has(p.id)) errors.push(tag + 'duplicate prompt id');
  ids.add(p.id);
  byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  if (!data.themes[p.theme]) errors.push(tag + 'unknown theme "' + p.theme + '"');
  if (!p.rarity || typeof p.rarity.estimated !== 'boolean') errors.push(tag + 'missing rarity.estimated flag');

  const n = p.answers.length;
  if (n < 60 && !p.closed) errors.push(tag + 'only ' + n + ' answers; open prompts need 60 (or mark the prompt closed)');
  // Small fixed sets (the seven churches, the armor of God) are allowed down
  // to 6 answers. They still need a Mustard Seed and one Lost Sheep; the
  // middle tiers are optional when there are too few answers to fill them.
  const small = p.closed && n < 15;
  if (n < (p.closed ? 6 : 15)) errors.push(tag + 'only ' + n + ' answers');

  const count = t => p.answers.filter(a => a.tier === t).length;
  if (count(6) !== 1) errors.push(tag + 'needs exactly one Lost Sheep, has ' + count(6));
  if (count(2) > 1) errors.push(tag + 'has ' + count(2) + ' Best Seat answers (at most 1)');
  [1, 3, 4, 5].forEach(t => {
    if (!count(t)) (p.rarity.estimated === false || (small && t !== 1) ? warnings : errors).push(tag + 'no answer in tier ' + t);
  });
  if (count(1) > 12) warnings.push(tag + count(1) + ' Mustard Seed answers (aim for 2 to 12)');
  if (!small && count(5) < n * 0.4) warnings.push(tag + 'Hidden Treasure should be the bulk; it has ' + count(5) + ' of ' + n);

  let last = 0;
  const names = new Map();
  p.answers.forEach(a => {
    if (a.tier < last) errors.push(tag + '"' + a.name + '" is out of tier order');
    last = a.tier;
    if (!a.note) errors.push(tag + '"' + a.name + '" has no note');
    const k = M.keyOf(a.name, p.ignoreWords);
    if (names.has(k)) errors.push(tag + 'two answers share the name "' + a.name + '"');
    names.set(k, a.name);
  });

  const c = M.compile(p);
  c.collisions.forEach(l => errors.push(tag + 'near miss "' + l + '" collides with a valid answer'));

  // Every accepted label lands on its own answer, or on a more common one
  // that shares the spelling.
  p.answers.forEach((a, idx) => {
    [a.name].concat(a.aliases || [], a.forms || []).forEach(label => {
      const r = M.evaluate(label, c);
      if (r.type !== 'accept') errors.push(tag + '"' + label + '" is not accepted (' + r.type + ')');
      else if (r.index !== idx) {
        const o = p.answers[r.index];
        if (label === a.name) errors.push(tag + 'the name "' + label + '" lands on "' + o.name + '"');
        else if (o.tier > a.tier) errors.push(tag + '"' + label + '" lands on the rarer "' + o.name + '"');
        else warnings.push(tag + '"' + label + '" (' + a.name + ') is shared with "' + o.name + '" and lands there');
      }
    });
    (a.short || []).forEach(label => {
      const r = M.evaluate(label, c);
      if (r.type === 'accept' && r.index !== idx) warnings.push(tag + 'short form "' + label + '" is accepted as "' + r.answer.name + '"');
      else if (r.type !== 'accept' && (r.type !== 'suggest' || r.index !== idx)) {
        errors.push(tag + 'short form "' + label + '" does not suggest "' + a.name + '" (' + r.type + ')');
      }
    });
  });
  (p.nearMisses || []).forEach(nm => {
    if (!nm.message) errors.push(tag + 'near miss "' + nm.name + '" has no message');
    [nm.name].concat(nm.aliases || []).forEach(label => {
      const r = M.evaluate(label, c);
      if (r.type === 'accept') errors.push(tag + 'near miss "' + label + '" scores as "' + r.answer.name + '"');
      else if (r.type !== 'near') errors.push(tag + 'near miss "' + label + '" is not recognized');
    });
  });
}

const closed = data.prompts.filter(p => p.closed).length;
const total = data.prompts.reduce((s, p) => s + p.answers.length, 0);
console.log(data.prompts.length + ' prompts (' + closed + ' closed sets), ' + total + ' answers');
Object.keys(byCategory).sort().forEach(k => console.log('  ' + byCategory[k] + '  ' + k));
warnings.forEach(w => console.log('warning: ' + w));
errors.forEach(e => console.log('ERROR: ' + e));
console.log(errors.length + ' errors, ' + warnings.length + ' warnings');
process.exit(errors.length ? 1 : 0);
