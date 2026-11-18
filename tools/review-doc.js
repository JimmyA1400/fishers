#!/usr/bin/env node
/* Fishers: writes a readable review document of built prompts.
 *
 *     node tools/review-doc.js [built.json] [out.md] [--only id,id]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--only');
const input = path.resolve(pos[0] || path.join(ROOT, 'data', 'prompts.json'));
const output = path.resolve(pos[1] || path.join(ROOT, 'review', 'prompts.md'));
const d = JSON.parse(fs.readFileSync(input, 'utf8'));
const T = d.tiers;

// Which answers had a manual "tier:" line in content/.
const manual = new Set();
for (const f of fs.readdirSync(path.join(ROOT, 'content')).filter(f => f.endsWith('.txt'))) {
  let cur = null, last = null;
  for (const line of fs.readFileSync(path.join(ROOT, 'content', f), 'utf8').split(/\r?\n/)) {
    if (line.startsWith('@')) cur = line.slice(1).split('|')[0].trim();
    else if (/^[^\s#?]/.test(line) && line.includes('|')) last = cur + '|' + line.split('|')[0].split(';')[0].trim();
    else if (/^\s+tier:/.test(line) && last) manual.add(last);
  }
}

let md = '# Fishers: prompt bank for review\n\n' +
  'Built from `content/` by `tools/build-prompts.js`, checked by `tools/verify.js` (every name and alias is found at its cited verse in the WEB or KJV) and `tools/validate.js` (game rules and matcher).\n\n' +
  '**How tiers are set.** *verses* is how many verses in the WEB and KJV use the answer\'s name or aliases. The most frequent ~5% become Mustard Seed, the next ~7.5% Five Loaves, the next ~20% Lost Coin, the rest Hidden Treasure. Answers marked *(manual)* were moved by hand, for names that are famous but rare in the text, or common words that inflate the count. Prompts whose answers are descriptions or book titles are tiered entirely by hand. The Lost Sheep and Best Seat are hand-picked. All tiers are estimates.\n\n' +
  '**Accepted spellings.** *Aliases* are found in the Bible text. *Forms* (modern names, labels) and *short* forms (abbreviations, which are only suggested) are not text-checked; they are listed here for review.\n\n';

for (const p of d.prompts.filter(p => !only || only.has(p.id))) {
  const by = t => p.answers.filter(a => a.tier === t);
  md += '---\n\n## ' + p.prompt + '\n\n`' + p.id + '` · ' + p.category + ' · ' + p.answers.length + ' answers' +
    (p.closed ? ' · closed set' : '') + (p.books ? ' · book titles (checked against the 66)' : p.described ? ' · descriptions (anchor words checked)' : '') + '\n\n' +
    '| Tier | Count |\n| --- | --- |\n' + T.map(t => '| ' + t.emoji + ' ' + t.name + ' (' + t.points + ') | ' + by(t.id).length + ' |').join('\n') + '\n\n';
  const sheep = by(6)[0], seat = by(2)[0];
  md += '**🐑 The Lost Sheep:** ' + sheep.name + '. ' + sheep.fact + '\n\n' +
    (seat ? '**🪑 Best Seat:** ' + seat.name + '. ' + seat.fact + '\n\n' : '**🪑 Best Seat:** none\n\n');
  for (const t of T) {
    const list = by(t.id).slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length || t.id === 6 || t.id === 2) continue;
    md += '### ' + t.emoji + ' ' + t.name + ' (' + t.points + ')\n\n';
    for (const a of list) {
      const extra = [];
      if (a.aliases.length) extra.push((p.described || p.books ? 'labels: ' : 'aliases: ') + a.aliases.join(', '));
      if (a.forms) extra.push('forms: ' + a.forms.join(', '));
      if (a.short) extra.push('short: ' + a.short.join(', '));
      if (a.anchor) extra.push('anchor: ' + a.anchor.join(' / '));
      md += '- **' + a.name + '** · ' + a.refs.join('; ') + ' · ' + a.note +
        (p.described || p.books ? '' : ' · *' + a.seen + ' verses*') + (manual.has(p.id + '|' + a.name) ? ' *(manual)*' : '') +
        (extra.length ? '<br><small>' + extra.join(' · ') + '</small>' : '') + '\n';
    }
    md += '\n';
  }
  md += '### Near misses\n\n' + p.nearMisses.map(n => '- **' + [n.name].concat(n.aliases).join(', ') + '**: ' + n.message).join('\n') + '\n\n';
}
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, md);
console.log('Wrote ' + path.relative(ROOT, output));
