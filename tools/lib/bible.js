/* Fishers: shared access to the WEB and KJV texts for the build tools.
 *
 * The texts are the public-domain verse-per-line files from ebible.org,
 * downloaded by tools/fetch-sources.js into tools/.cache/. Only the 66 books
 * of the Protestant canon are loaded.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, '..', '.cache');

// [code, name, short forms players might type]
const BOOKS = [
  ['GEN', 'Genesis', ['Gen', 'Gn']], ['EXO', 'Exodus', ['Ex', 'Exod']], ['LEV', 'Leviticus', ['Lev', 'Lv']],
  ['NUM', 'Numbers', ['Num', 'Nm']], ['DEU', 'Deuteronomy', ['Deut', 'Dt']], ['JOS', 'Joshua', ['Josh']],
  ['JDG', 'Judges', ['Judg', 'Jdg']], ['RUT', 'Ruth', ['Rth']], ['1SA', '1 Samuel', ['1 Sam', '1 Sm']],
  ['2SA', '2 Samuel', ['2 Sam', '2 Sm']], ['1KI', '1 Kings', ['1 Kgs', '1 Ki']], ['2KI', '2 Kings', ['2 Kgs', '2 Ki']],
  ['1CH', '1 Chronicles', ['1 Chr', '1 Chron']], ['2CH', '2 Chronicles', ['2 Chr', '2 Chron']], ['EZR', 'Ezra', ['Ezr']],
  ['NEH', 'Nehemiah', ['Neh']], ['EST', 'Esther', ['Esth', 'Est']], ['JOB', 'Job', []],
  ['PSA', 'Psalms', ['Ps', 'Psa', 'Pss']], ['PRO', 'Proverbs', ['Prov', 'Prv']], ['ECC', 'Ecclesiastes', ['Eccl', 'Eccles', 'Qoh']],
  ['SOL', 'Song of Solomon', ['Song', 'SOS']], ['ISA', 'Isaiah', ['Isa']], ['JER', 'Jeremiah', ['Jer']],
  ['LAM', 'Lamentations', ['Lam']], ['EZE', 'Ezekiel', ['Ezek', 'Ezk']], ['DAN', 'Daniel', ['Dan', 'Dn']],
  ['HOS', 'Hosea', ['Hos']], ['JOE', 'Joel', ['Jl']], ['AMO', 'Amos', ['Am']], ['OBA', 'Obadiah', ['Obad', 'Ob']],
  ['JON', 'Jonah', ['Jon', 'Jnh']], ['MIC', 'Micah', ['Mic']], ['NAH', 'Nahum', ['Nah']], ['HAB', 'Habakkuk', ['Hab']],
  ['ZEP', 'Zephaniah', ['Zeph', 'Zep']], ['HAG', 'Haggai', ['Hag']], ['ZEC', 'Zechariah', ['Zech', 'Zec']],
  ['MAL', 'Malachi', ['Mal']],
  ['MAT', 'Matthew', ['Matt', 'Mt']], ['MAR', 'Mark', ['Mk', 'Mrk']], ['LUK', 'Luke', ['Lk', 'Luk']],
  ['JOH', 'John', ['Jn', 'Jhn']], ['ACT', 'Acts', ['Ac']], ['ROM', 'Romans', ['Rom', 'Rm']],
  ['1CO', '1 Corinthians', ['1 Cor']], ['2CO', '2 Corinthians', ['2 Cor']], ['GAL', 'Galatians', ['Gal']],
  ['EPH', 'Ephesians', ['Eph']], ['PHI', 'Philippians', ['Phil', 'Php']], ['COL', 'Colossians', ['Col']],
  ['1TH', '1 Thessalonians', ['1 Thess', '1 Thes']], ['2TH', '2 Thessalonians', ['2 Thess', '2 Thes']],
  ['1TI', '1 Timothy', ['1 Tim']], ['2TI', '2 Timothy', ['2 Tim']], ['TIT', 'Titus', ['Tit']],
  ['PHM', 'Philemon', ['Phlm', 'Philem']], ['HEB', 'Hebrews', ['Heb']], ['JAM', 'James', ['Jas', 'Jm']],
  ['1PE', '1 Peter', ['1 Pet', '1 Pt']], ['2PE', '2 Peter', ['2 Pet', '2 Pt']], ['1JO', '1 John', ['1 Jn']],
  ['2JO', '2 John', ['2 Jn']], ['3JO', '3 John', ['3 Jn']], ['JUD', 'Jude', ['Jud']], ['REV', 'Revelation', ['Rev', 'Rv']]
];
const BY_CODE = new Map(BOOKS.map(b => [b[0], b]));
const NAME_TO_CODE = new Map();
BOOKS.forEach(([code, name, short]) => {
  NAME_TO_CODE.set(name.toLowerCase(), code);
  short.forEach(s => NAME_TO_CODE.set(s.toLowerCase(), code));
});
NAME_TO_CODE.set('psalm', 'PSA');
NAME_TO_CODE.set('song of songs', 'SOL');
const SINGLE_CHAPTER = new Set(['OBA', 'PHM', '2JO', '3JO', 'JUD']);

function load(tr) {
  const file = path.join(CACHE, tr, 'eng-' + tr + '_vpl.txt');
  if (!fs.existsSync(file)) {
    throw new Error('Missing ' + file + '. Run: node tools/fetch-sources.js');
  }
  const verses = new Map();          // "GEN 1:1" -> text
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(\w{3}) (\d+):(\d+) (.*)$/);
    if (!m || !BY_CODE.has(m[1])) continue;
    verses.set(m[1] + ' ' + m[2] + ':' + m[3], m[4].replace(/[[\]]/g, '').trim());
  }
  return verses;
}

let cache = null;
function texts() {
  if (!cache) cache = { WEB: load('web'), KJV: load('kjv') };
  return cache;
}

// "1 Kings 18:36–39; 19:2" -> [{code, ch, verses:[36..39]}, {code, ch:19, verses:[2]}]
// A bare chapter or chapter range ("Ruth 1–4") gives verses: null (whole chapter).
function parseRef(ref) {
  const s = ref.replace(/[–—]/g, '-').trim();
  const m = s.match(/^((?:[123] )?[A-Za-z][A-Za-z ]*?) (\d.*)$/);
  if (!m) throw new Error('Cannot read reference "' + ref + '"');
  const code = NAME_TO_CODE.get(m[1].toLowerCase());
  if (!code) throw new Error('Unknown book in "' + ref + '"');
  const out = [];
  for (const seg of m[2].split(';').map(x => x.trim()).filter(Boolean)) {
    let ch, vs;
    if (SINGLE_CHAPTER.has(code) && !seg.includes(':')) { ch = 1; vs = seg; }
    else if (/^\d+$/.test(seg)) { out.push({ code, ch: +seg, verses: null }); continue; }
    else if (/^\d+-\d+$/.test(seg)) {
      const [a, b] = seg.split('-').map(Number);
      for (let c = a; c <= b; c++) out.push({ code, ch: c, verses: null });
      continue;
    } else {
      const mm = seg.match(/^(\d+):(.+)$/);
      if (!mm) throw new Error('Cannot read "' + seg + '" in "' + ref + '"');
      ch = +mm[1]; vs = mm[2];
    }
    const verses = [];
    for (const part of vs.split(',').map(x => x.trim())) {
      const r = part.match(/^(\d+)(?:-(\d+))?$/);
      if (!r) throw new Error('Cannot read verses "' + vs + '" in "' + ref + '"');
      for (let v = +r[1]; v <= +(r[2] || r[1]); v++) verses.push(v);
    }
    out.push({ code, ch, verses });
  }
  return out;
}

// All verse keys a reference covers, or throws if any verse does not exist.
function verseKeys(ref) {
  const { WEB } = texts();
  const keys = [];
  for (const p of parseRef(ref)) {
    if (p.verses) {
      for (const v of p.verses) {
        const k = p.code + ' ' + p.ch + ':' + v;
        if (!WEB.has(k)) throw new Error(ref + ': ' + k + ' does not exist');
        keys.push(k);
      }
    } else {
      let v = 1, found = false;
      while (WEB.has(p.code + ' ' + p.ch + ':' + v)) { keys.push(p.code + ' ' + p.ch + ':' + v); v++; found = true; }
      if (!found) throw new Error(ref + ': chapter ' + p.ch + ' does not exist');
    }
  }
  return keys;
}

function chapterCount(code) {
  const { WEB } = texts();
  let c = 1;
  while (WEB.has(code + ' ' + (c + 1) + ':1')) c++;
  return c;
}

// Lowercase word tokens. Possessives and apostrophes fold away.
function words(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['‘’]s\b/g, '').replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}

// Does the phrase occur in the verse? Matches whole words in order; the last
// word may carry a plural ending; a spaced name also matches its joined KJV
// spelling ("Beth Horon" / "Bethhoron").
function phraseIn(phrase, verseText) {
  const p = words(phrase), v = words(verseText);
  if (!p.length) return false;
  const last = p.length - 1;
  const plural = (w, t) => t === w || t === w + 's' || t === w + 'es' ||
    (w.endsWith('y') && t === w.slice(0, -1) + 'ies') || (w.endsWith('f') && t === w.slice(0, -1) + 'ves') ||
    (w.endsWith('fe') && t === w.slice(0, -2) + 'ves');
  for (let i = 0; i + p.length <= v.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length && ok; j++) ok = j === last ? plural(p[j], v[i + j]) : v[i + j] === p[j];
    if (ok) return true;
  }
  if (p.length > 1) {
    const joined = p.join('');
    if (v.some(t => plural(joined, t))) return true;
  }
  // A joined name also matches its hyphenated or spaced spelling
  // ("Loruhamah" / "Lo-ruhamah", "vinedresser" / "vine dresser").
  if (p.length === 1) {
    for (let i = 0; i + 1 < v.length; i++) if (plural(p[0], v[i] + v[i + 1])) return true;
  }
  return false;
}

// A name of several words ("Simon the Zealot", "Mary the mother of James")
// also counts as present when every one of its words is in the same verse.
const SMALL = new Set(['the', 'of', 'a', 'an', 'and', 'son', 'daughter', 'wife', 'mother', 'father']);
function wordsIn(phrase, verseText) {
  const p = words(phrase).filter(w => !SMALL.has(w));
  if (p.length < 2) return false;
  const v = new Set(words(verseText));
  return p.every(w => v.has(w));
}

// Where in the cited references does the phrase appear? Returns the
// translations it was found in, e.g. ['WEB', 'KJV'], or [].
function foundAt(phrase, refs) {
  const T = texts(), hits = new Set();
  for (const ref of refs) {
    for (const k of verseKeys(ref)) {
      for (const tr of ['WEB', 'KJV']) {
        const t = T[tr].get(k);
        if (t && (phraseIn(phrase, t) || wordsIn(phrase, t))) hits.add(tr);
      }
    }
  }
  return [...hits];
}

// Word indexes over both translations: lowercased word -> verse keys, and the
// same for words written with a capital letter (names).
let index = null;
function buildIndex() {
  if (index) return index;
  const T = texts(), all = new Map(), caps = new Map();
  const add = (m, w, k) => { let s = m.get(w); if (!s) m.set(w, s = new Set()); s.add(k); };
  for (const tr of ['WEB', 'KJV']) {
    for (const [k, text] of T[tr]) {
      const raw = text.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/['‘’]s\b/g, '').replace(/['‘’]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
      for (const w of raw) {
        const lw = w.toLowerCase();
        add(all, lw, k);
        if (/^[A-Z]/.test(w)) add(caps, lw, k);
      }
    }
  }
  index = { all, caps };
  return index;
}

function candidates(phrase, capsOnly) {
  const ix = buildIndex(), m = capsOnly ? ix.caps : ix.all;
  const ws = words(phrase);
  if (!ws.length) return new Set();
  const forms = w => [w, w + 's', w + 'es', w.endsWith('y') ? w.slice(0, -1) + 'ies' : null].filter(Boolean);
  const setFor = (w, i) => {
    const u = new Set();
    for (const f of (i === ws.length - 1 ? forms(w) : [w])) for (const k of (m.get(f) || [])) u.add(k);
    // joined or hyphenated spellings fall back to a scan of the first word
    return u;
  };
  let acc = null;
  ws.forEach((w, i) => {
    const s = setFor(w, i);
    acc = acc ? new Set([...acc].filter(k => s.has(k))) : s;
  });
  acc = acc || new Set();
  // A hyphenated or spaced name may be written as one word ("Ebedmelech").
  if (ws.length > 1) for (const f of forms(ws.join(''))) for (const k of (m.get(f) || [])) acc.add(k);
  return acc;
}

// Verse keys (in either translation) where the phrase occurs. With capsOnly,
// the first word must be capitalized, which keeps names apart from ordinary
// words ("Mark" the name, not "mark" the verb).
function versesWith(phrase, capsOnly) {
  const T = texts(), out = new Set();
  for (const k of candidates(phrase, capsOnly)) {
    for (const tr of ['WEB', 'KJV']) {
      const t = T[tr].get(k);
      if (t && phraseIn(phrase, t)) { out.add(k); break; }
    }
  }
  return out;
}

// How many verses (WEB and KJV together) mention any of the phrases.
// This is the mechanical familiarity score.
const countMemo = new Map();
function verseCount(phrases, capsOnly) {
  const key = (capsOnly ? 'C:' : '') + phrases.map(p => words(p).join(' ')).sort().join('|');
  if (countMemo.has(key)) return countMemo.get(key);
  const hit = new Set();
  phrases.forEach(p => versesWith(p, capsOnly).forEach(k => hit.add(k)));
  countMemo.set(key, hit.size);
  return hit.size;
}

// Canonical order of verse keys, for picking the first mention.
const ORDER = new Map(BOOKS.map((b, i) => [b[0], i]));
function keyOrder(k) {
  const m = k.match(/^(\w{3}) (\d+):(\d+)$/);
  return ORDER.get(m[1]) * 1e6 + (+m[2]) * 1e3 + (+m[3]);
}
// "GEN 12:8" -> "Gen 12:8" in the short style the content files use.
function shortRef(k) {
  const m = k.match(/^(\w{3}) (\d+):(\d+)$/);
  const b = BY_CODE.get(m[1]);
  const name = b[2][0] || b[1];
  return SINGLE_CHAPTER.has(m[1]) ? name + ' ' + m[3] : name + ' ' + m[2] + ':' + m[3];
}

function verseText(key, tr) { return texts()[tr || 'WEB'].get(key); }

module.exports = {
  BOOKS, BY_CODE, CACHE, texts, parseRef, verseKeys, chapterCount, words, phraseIn, foundAt,
  verseCount, versesWith, keyOrder, shortRef, verseText, buildIndex
};
