#!/usr/bin/env node
/* Fishers: checks every answer against the Bible text. Fails on any mismatch.
 *
 *     node tools/verify.js [data/prompts.json]
 *
 * For each answer:
 *   - every reference must exist in the 66 books;
 *   - the name and every alias must appear, as whole words, in the WEB or the
 *     KJV at one of its cited references (description prompts check that one
 *     of their anchor words appears instead, and book prompts check the 66
 *     book names);
 *   - Scripture references inside notes, facts and near-miss messages must exist.
 * It also checks that every quoted verse in the game matches the WEB (or the
 * KJV where credited) word for word, and writes tools/reports/forms.txt: the
 * accepted forms and short forms that are not text-verified, for hand review.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/bible.js');

const ROOT = path.join(__dirname, '..');
const file = path.resolve(process.argv[2] || path.join(ROOT, 'data', 'prompts.json'));
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [], review = [];
const BOOK_NAMES = new Set(B.BOOKS.map(b => b[1].toLowerCase()));

const bookAlt = B.BOOKS.map(b => b[1]).concat(['Psalm', 'Song of Songs']).sort((a, b) => b.length - a.length)
  .map(s => s.replace(/ /g, '\\s')).join('|');
const inlineRef = new RegExp('\\b(' + bookAlt + ') (\\d+(?::\\d+(?:[–-]\\d+)?(?:, ?\\d+(?:[–-]\\d+)?)*)?(?:[–-]\\d+)?(?:; \\d+:\\d+(?:[–-]\\d+)?(?:, ?\\d+(?:[–-]\\d+)?)*)*)', 'g');

function checkInline(where, text) {
  for (const m of String(text || '').matchAll(inlineRef)) {
    try { B.verseKeys(m[1] + ' ' + m[2]); } catch (e) { errors.push(where + ': ' + e.message); }
  }
}

let checkedNames = 0;
for (const p of data.prompts) {
  const tag = '[' + p.id + '] ';
  const forms = [];
  for (const a of p.answers) {
    const at = tag + a.name;
    let refsOk = true;
    for (const r of a.refs) { try { B.verseKeys(r); } catch (e) { errors.push(at + ': ' + e.message); refsOk = false; } }
    if (!a.refs.length) errors.push(at + ': no Scripture reference');
    if (refsOk && a.refs.length) {
      if (p.books) {
        if (!BOOK_NAMES.has(a.name.toLowerCase())) errors.push(at + ': not one of the 66 book names');
        a.aliases.forEach(x => forms.push(a.name + ' <- ' + x + '  (book title)'));
      } else if (p.described || (a.anchor && a.anchor.length)) {
        // Description prompts, and single label answers in a name prompt
        // ("Pilate's wife"), are checked by an anchor word in the passage.
        if (!a.anchor || !a.anchor.length) errors.push(at + ': description answers need an anchor word');
        // Anchors are alternatives (the WEB and KJV may word it differently);
        // at least one must appear in the cited passage.
        checkedNames++;
        if ((a.anchor || []).length && !a.anchor.some(w => B.foundAt(w, a.refs).length)) {
          errors.push(at + ': none of the anchors (' + a.anchor.join(', ') + ') is in ' + a.refs.join('; '));
        }
        [a.name].concat(a.aliases).forEach(x => forms.push(a.name + ' <- ' + x + '  (label)'));
      } else {
        [a.name].concat(a.aliases).forEach(x => {
          checkedNames++;
          if (!B.foundAt(x, a.refs).length) errors.push(at + ': "' + x + '" does not appear in ' + a.refs.join('; ') + ' (WEB or KJV)');
        });
      }
    }
    (a.forms || []).forEach(x => forms.push(a.name + ' <- ' + x + '  (form)'));
    (a.short || []).forEach(x => forms.push(a.name + ' <- ' + x + '  (short, suggested only)'));
    checkInline(at + ' note', a.note);
    checkInline(at + ' fact', a.fact);
  }
  const sheep = p.answers.filter(a => a.tier === 6), seat = p.answers.filter(a => a.tier === 2);
  if (sheep.length !== 1) errors.push(tag + 'needs exactly one Lost Sheep, has ' + sheep.length);
  if (sheep[0] && !sheep[0].fact) errors.push(tag + 'the Lost Sheep needs a fact');
  if (seat.length > 1) errors.push(tag + 'has ' + seat.length + ' Best Seat answers');
  if (seat[0] && !seat[0].fact) errors.push(tag + 'the Best Seat needs a fact');
  p.nearMisses.forEach(n => checkInline(tag + 'near miss ' + n.name, n.message));
  if (forms.length) review.push('[' + p.id + '] ' + p.prompt + '\n  ' + forms.join('\n  '));
}

// Quoted verses: the themes in the data file, plus the quotations in the UI.
const T = B.texts();
const norm = s => B.words(s).join(' ');
function quoteMatches(ref, text, tr) {
  const keys = B.verseKeys(ref);
  const full = keys.map(k => T[tr].get(k)).join(' ');
  return norm(full).includes(norm(text));
}
for (const [theme, list] of Object.entries(data.themes || {})) {
  for (const v of list) {
    try {
      if (!quoteMatches(v.ref, v.text, v.translation === 'KJV' ? 'KJV' : 'WEB')) {
        errors.push('theme ' + theme + ': the quotation of ' + v.ref + ' does not match the ' + v.translation);
      }
    } catch (e) { errors.push('theme ' + theme + ': ' + e.message); }
  }
}
const UI_QUOTES = [
  { ref: 'Matthew 4:19', tr: 'KJV', text: 'Follow me, and I will make you fishers of men.' }
];
(data.markers || []).filter(m => m.ref).forEach(m => UI_QUOTES.push({ ref: m.ref, tr: m.translation, text: m.text }));
UI_QUOTES.forEach(q => {
  try { if (!quoteMatches(q.ref, q.text, q.tr)) errors.push('quotation of ' + q.ref + ' does not match the ' + q.tr); }
  catch (e) { errors.push(q.ref + ': ' + e.message); }
});

fs.mkdirSync(path.join(ROOT, 'tools', 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools', 'reports', 'forms.txt'),
  'Accepted forms that are not checked against the Bible text. Review by hand.\n\n' + review.join('\n\n') + '\n');

console.log(data.prompts.length + ' prompts; ' + checkedNames + ' names, aliases and anchors checked against the text; ' +
  UI_QUOTES.length + ' quotations checked');
errors.forEach(e => console.log('MISMATCH: ' + e));
console.log(errors.length ? errors.length + ' problems. Build FAILED.' : 'All verified.');
process.exit(errors.length ? 1 : 0);
