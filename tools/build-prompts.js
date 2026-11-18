#!/usr/bin/env node
/* Fishers: builds the prompt bank from the plain-text sources in content/.
 *
 *     node tools/build-prompts.js                 -> data/prompts.json
 *     node tools/build-prompts.js --only a,b      -> just those prompts
 *     node tools/build-prompts.js --out file.json
 *
 * Source format (one file per prompt or several per file):
 *
 *   @ id | Category | Prompt text | theme | flags
 *   Name; KJV alias; other alias | Gen 1:1; Matt 2:3 | One-line note.
 *     forms: accepted names not found in the text (modern names, labels)
 *     short: abbreviations; these are suggested, never accepted outright
 *     tier: 1-6 (manual override after the mechanical pass)
 *     anchor: words, one of which must appear in the cited verses (description
 *             prompts, or a single label answer such as "Pilate's wife")
 *     sheep: one-sentence fact (marks the prompt's one Lost Sheep)
 *     seat: one-sentence fact (marks the prompt's Best Seat, if any)
 *   ? Near-miss name; alias | Teaching message.
 *
 * flags: closed (a fixed set), nouns (common nouns: singular and plural agree),
 *        phrase (description matching),
 *        described (names are labels; verify anchors), books (answers are the
 *        66 book names), ignore=word,word
 *
 * Tiers, mechanically: every answer gets a familiarity score, the number of
 * verses in the WEB and KJV that use its name or aliases (or its anchors).
 * The most familiar ~5% (2 to 12) are Mustard Seed, the next ~7.5% Five
 * Loaves, the next ~20% Lost Coin, and the rest Hidden Treasure. Manual
 * "tier:" lines then correct for answers that are famous but rare in the text
 * (Goliath, Eve) or frequent but forgettable (Asaph).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/bible.js');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('--out', path.join(ROOT, 'data', 'prompts.json')));
const ONLY = opt('--only', '') ? new Set(opt('--only').split(',')) : null;

const BOOK_NAME = new Map(B.BOOKS.map(b => [b[0], b[1]]));

// "Gen 17:15; 21:1-3" -> ["Genesis 17:15; 21:1–3"]; several books -> several refs.
function displayRefs(field) {
  if (!field.trim()) return [];
  const out = [];
  for (const seg of field.split(';').map(s => s.trim()).filter(Boolean)) {
    const m = seg.match(/^((?:[123] )?[A-Za-z][A-Za-z ]*?) (\d.*)$/);
    if (m) {
      const code = B.parseRef(seg)[0].code;   // throws on an unknown book
      out.push(BOOK_NAME.get(code).replace(/^Psalms$/, 'Psalm') + ' ' + m[2].replace(/-/g, '–'));
    } else if (out.length) out[out.length - 1] += '; ' + seg.replace(/-/g, '–');
    else throw new Error('Reference must start with a book: "' + field + '"');
  }
  return out;
}

function parse(text, file) {
  const prompts = [];
  let p = null, a = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const where = file + ':' + (i + 1);
    if (!raw.trim() || raw.trim().startsWith('#')) return;
    if (/^\s+\w+:/.test(raw)) {
      if (!a) throw new Error(where + ': attribute without an answer');
      const m = raw.trim().match(/^(\w+):\s*(.*)$/);
      const k = m[1], v = m[2].trim();
      if (k === 'forms' || k === 'short' || k === 'anchor') a[k] = v.split(';').map(s => s.trim()).filter(Boolean);
      else if (k === 'tier') a.tierOverride = Number(v);
      else if (k === 'sheep') { a.special = 6; a.fact = v; }
      else if (k === 'seat') { a.special = 2; a.fact = v; }
      else throw new Error(where + ': unknown attribute ' + k);
      return;
    }
    const line = raw.trim();
    if (line.startsWith('@')) {
      const f = line.slice(1).split('|').map(s => s.trim());
      if (f.length < 4) throw new Error(where + ': prompt line needs id | category | prompt | theme');
      const flags = (f[4] || '').split(/\s+/).filter(Boolean);
      const ignore = (flags.find(x => x.startsWith('ignore=')) || '').replace('ignore=', '').split(',').filter(Boolean);
      p = {
        id: f[0], category: f[1], prompt: f[2].replace(/(\d)-(\d)/g, '$1–$2'), theme: f[3],
        closed: flags.includes('closed'), described: flags.includes('described') || flags.includes('books'),
        books: flags.includes('books'), nouns: flags.includes('nouns'),
        match: flags.includes('phrase') ? 'phrase' : 'exact', ignoreWords: ignore,
        answers: [], nearMisses: [], file: where
      };
      prompts.push(p); a = null;
      return;
    }
    if (!p) throw new Error(where + ': content before the first @ prompt line');
    if (line.startsWith('?')) {
      const f = line.slice(1).split('|').map(s => s.trim());
      if (f.length !== 2) throw new Error(where + ': near miss needs "names | message"');
      const names = f[0].split(';').map(s => s.trim()).filter(Boolean);
      p.nearMisses.push({ name: names[0], aliases: names.slice(1), message: f[1] });
      a = null;
      return;
    }
    const f = line.split('|').map(s => s.trim());
    if (f.length !== 3) throw new Error(where + ': answer needs "names | refs | note"');
    const names = f[0].split(';').map(s => s.trim()).filter(Boolean);
    a = { name: names[0], aliases: names.slice(1), refsSrc: f[1], note: f[2], where };
    p.answers.push(a);
  });
  return prompts;
}

function familiarity(p, a) {
  if (p.books) return 0;
  const phrases = p.described ? (a.anchor || []) : [a.name].concat(a.aliases);
  return phrases.length ? B.verseCount(phrases) : 0;
}

function assignTiers(p) {
  const n = p.answers.length;
  p.answers.forEach(a => { a.seen = familiarity(p, a); });
  const pool = p.answers.filter(a => !a.special).sort((x, y) => y.seen - x.seen || x.name.localeCompare(y.name));
  const m = Math.max(2, Math.min(12, Math.round(n * 0.05)));
  const f = Math.round(n * 0.075), c = Math.round(n * 0.2);
  // Description prompts (parables, miracles) and book names have no text count
  // that tracks familiarity, so their tiers are set by hand: unmarked answers
  // default to Hidden Treasure.
  if (p.described) pool.forEach(a => { a.tier = 5; });
  else pool.forEach((a, i) => { a.tier = i < m ? 1 : i < m + f ? 3 : i < m + f + c ? 4 : 5; });
  p.answers.forEach(a => {
    if (a.special) a.tier = a.special;
    else if (a.tierOverride) a.tier = a.tierOverride;
  });
  // Bank order: tier, then most familiar first. That order breaks ties in play.
  p.answers.sort((x, y) => x.tier - y.tier || y.seen - x.seen || x.name.localeCompare(y.name));
}

// The type-ahead word list: every name the Bible capitalizes (WEB and KJV),
// plus every answer label in the bank, weighted by how many verses use it.
// Drawn from the whole Bible rather than the current prompt, it helps with
// spelling without telling the player which answers are valid.
function buildLexicon(prompts) {
  const ix = B.buildIndex();
  const weight = new Map();   // lowercase -> [display, weight]
  const add = (display, w) => {
    const k = display.toLowerCase();
    if (k.replace(/[^a-z0-9]/g, '').length < 3) return;
    const cur = weight.get(k);
    if (!cur || w > cur[1]) weight.set(k, [display, w]);
  };
  for (const [w, caps] of ix.caps) {
    const all = ix.all.get(w);
    if (!all || w.length < 3 || /\d/.test(w)) continue;
    if (caps.size >= all.size * 0.8) add(w[0].toUpperCase() + w.slice(1), all.size);
  }
  // Well-known answers (common tiers anywhere in the bank) rank above
  // obscure names that happen to occur more often: "zacc" -> Zacchaeus.
  const BOOST = { 1: 1000, 2: 600, 3: 300, 4: 60 };
  for (const p of prompts) {
    for (const a of p.answers) {
      [a.name].concat(a.aliases || [], a.forms || []).forEach(label => {
        if (/^\d/.test(label) && p.books) { add(label, 50); return; }
        add(label, (BOOST[a.tier] || 0) + Math.max(1, B.verseCount([label], /^[A-Z]/.test(label) && !p.nouns && !p.described)));
      });
    }
  }
  return [...weight.values()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
}

function main() {
  const dir = path.join(ROOT, 'content');
  let prompts = [];
  // people-hand.txt is a source for tools/derive.js, not a prompt of its own.
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') && f !== 'people-hand.txt').map(f => path.join(dir, f));
  const gen = path.join(dir, 'generated');
  if (fs.existsSync(gen)) fs.readdirSync(gen).filter(f => f.endsWith('.txt')).forEach(f => files.push(path.join(gen, f)));
  for (const file of files.sort()) {
    prompts = prompts.concat(parse(fs.readFileSync(file, 'utf8'), path.relative(ROOT, file)));
  }
  if (ONLY) prompts = prompts.filter(p => ONLY.has(p.id));
  const themes = JSON.parse(fs.readFileSync(path.join(dir, 'themes.json'), 'utf8'));
  const tiers = JSON.parse(fs.readFileSync(path.join(dir, 'tiers.json'), 'utf8'));
  const markers = JSON.parse(fs.readFileSync(path.join(dir, 'markers.json'), 'utf8'));

  // Tiers measured from real players (backend/recalc-tiers.js), if any.
  const realFile = path.join(dir, 'real-tiers.json');
  const real = fs.existsSync(realFile) ? JSON.parse(fs.readFileSync(realFile, 'utf8')) : {};

  const out = prompts.map(p => {
    assignTiers(p);
    const r = real[p.id];
    if (r) {
      p.answers.forEach(a => { if (r.tiers[a.name] && a.tier !== 6 && a.tier !== 2) a.tier = r.tiers[a.name]; });
      p.answers.sort((x, y) => x.tier - y.tier || y.seen - x.seen || x.name.localeCompare(y.name));
    }
    return {
      id: p.id, category: p.category, prompt: p.prompt, theme: p.theme,
      closed: p.closed || undefined, described: p.described || undefined, books: p.books || undefined, nouns: p.nouns || undefined,
      match: p.match, ignoreWords: p.ignoreWords,
      rarity: real[p.id] ? { estimated: false, sample: real[p.id].sample, updated: real[p.id].updated } : { estimated: true },
      answers: p.answers.map(a => {
        const o = { name: a.name, aliases: a.aliases, tier: a.tier, refs: displayRefs(a.refsSrc), note: a.note.replace(/(\d)-(\d)/g, '$1–$2') };
        if (a.forms) o.forms = a.forms;
        if (a.short) o.short = a.short;
        if (a.anchor) o.anchor = a.anchor;
        if (a.fact) o.fact = a.fact.replace(/(\d)-(\d)/g, '$1–$2');
        o.seen = a.seen;
        return o;
      }),
      nearMisses: p.nearMisses.map(n => ({ name: n.name, aliases: n.aliases, message: n.message.replace(/(\d)-(\d)/g, '$1–$2') }))
    };
  });

  const data = {
    version: 2,
    note: 'Generated by tools/build-prompts.js from content/. Edit content/, not this file. Tiers are estimates (rarity.estimated) from verse counts in the WEB and KJV plus a manual pass, until real answer data exists. "seen" is that verse count.',
    quoteTranslation: 'WEB',
    tiers, themes, markers, lexicon: buildLexicon(out), prompts: out
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // Compact on purpose: the game downloads this file. "seen" (the verse count
  // behind each tier) stays in the review build, not in the shipped data.
  if (OUT === path.join(ROOT, 'data', 'prompts.json')) data.prompts.forEach(p => p.answers.forEach(a => { delete a.seen; }));
  // Each Lost Sheep carries the WEB text of its first passage ("Learn more").
  require('./add-passages').apply(data);
  fs.writeFileSync(OUT, JSON.stringify(data) + '\n');
  console.log('Wrote ' + path.relative(ROOT, OUT) + ': ' + out.length + ' prompts, ' +
    out.reduce((s, p) => s + p.answers.length, 0) + ' answers');
}

module.exports = { parse, displayRefs };
if (require.main === module) {
  try { main(); } catch (e) { console.error('BUILD FAILED: ' + e.message); process.exit(1); }
}
