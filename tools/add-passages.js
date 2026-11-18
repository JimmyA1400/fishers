#!/usr/bin/env node
/* Fishers: gives each prompt's Lost Sheep the WEB text of its first cited
 * passage, for the "Learn more" drawer on the reveal card.
 *
 *     node tools/add-passages.js           -> updates data/prompts.json (and prompts.js)
 *     node tools/add-passages.js --check   -> exits 1 if any passage is missing or
 *                                             differs from the pinned WEB text
 *
 * The text is copied verse by verse from the World English Bible (public
 * domain); nothing is paraphrased. Long passages stop after MAX verses and
 * the drawer points to the full reference.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/bible');

const MAX = 6;
const FILE = path.join(__dirname, '..', 'data', 'prompts.json');

// "JER 20:1" -> "Jeremiah 20:1" (or "Obadiah 1" for one-chapter books).
function longRef(k) {
  const m = k.match(/^(\w{3}) (\d+):(\d+)$/);
  const b = B.BY_CODE.get(m[1]);
  return /^(OBA|PHM|2JO|3JO|JUD)$/.test(m[1]) ? b[1] + ' ' + m[3] : b[1] + ' ' + m[2] + ':' + m[3];
}

function passageFor(ref) {
  const keys = B.verseKeys(ref);
  const verses = keys.slice(0, MAX).map((k) => ({ r: longRef(k), t: B.verseText(k, 'WEB') }));
  verses.forEach((v) => { if (!v.t) throw new Error(ref + ': no WEB text for ' + v.r); });
  return { ref, verses, more: keys.length > MAX };
}

function apply(data) {
  let n = 0;
  for (const p of data.prompts) {
    const a = p.answers.find((x) => x.tier === 6);
    if (!a) continue;
    a.passage = passageFor(a.refs[0]);
    n++;
  }
  return n;
}

module.exports = { apply, passageFor };

if (require.main === module) {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (process.argv.includes('--check')) {
    const before = JSON.stringify(data.prompts.map((p) => (p.answers.find((x) => x.tier === 6) || {}).passage || null));
    const copy = JSON.parse(JSON.stringify(data));
    const n = apply(copy);
    const after = JSON.stringify(copy.prompts.map((p) => (p.answers.find((x) => x.tier === 6) || {}).passage || null));
    if (before !== after) {
      console.error('Lost Sheep passages are missing or differ from the WEB text. Run: node tools/add-passages.js');
      process.exit(1);
    }
    console.log(n + ' Lost Sheep passages match the WEB text');
  } else {
    const n = apply(data);
    fs.writeFileSync(FILE, JSON.stringify(data) + '\n');
    require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'sync-data.js')], { stdio: 'inherit' });
    console.log('Added passages to ' + n + ' Lost Sheep');
  }
}
