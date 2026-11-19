#!/usr/bin/env node
/* Fishers: generates the large name and place prompts from the sources.
 *
 *     node tools/derive.js            -> content/generated/*.txt
 *
 * People come from Easton's Bible Dictionary (public domain), merged with the
 * hand-written people lists in content/people-hand.txt. A name is accepted for
 * a prompt only when Easton describes a person by that name AND one of the
 * verses Easton cites for that person, inside the prompt's books, actually
 * contains the name (capitalized) in the WEB or KJV. Verses that OpenBible
 * lists for a place of the same name are skipped, so "Gilead" the region does
 * not count as a person.
 *
 * Places come from OpenBible.info (CC BY 4.0), which lists every verse that
 * mentions each place. Names used by other translations are kept only if the
 * WEB or KJV uses them in one of those verses.
 *
 * The prompts, picks (Lost Sheep, Best Seat), manual tiers and exclusions are
 * configured in tools/derive-config.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/bible.js');
const S = require('./lib/sources.js');
// Live prompts, then any batches waiting for review (tools/batches/*.js).
// A batch's prompts carry `pending: 'batch-N'` and are written to
// content/pending/batch-N/, which tools/build-prompts.js leaves out unless
// asked (--pending batch-N), so nothing reaches the game before approval.
const BATCH_DIR = path.join(__dirname, 'batches');
const CONFIG = require('./derive-config.js').concat(...(fs.existsSync(BATCH_DIR) ? fs.readdirSync(BATCH_DIR).filter(f => f.endsWith('.js')).sort()
  .map(f => require(path.join(BATCH_DIR, f))) : []));
const { parse } = require('./build-prompts.js');
const M = require('../js/matcher.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'content', 'generated');
const PENDING = path.join(ROOT, 'content', 'pending');
const outDir = cfg => cfg.pending ? path.join(PENDING, cfg.pending) : OUT;
const ALL = B.BOOKS.map(b => b[0]);
const T = B.texts();

const byOrder = (a, b) => B.keyOrder(a) - B.keyOrder(b);
const keyOfName = s => B.words(s).join(' ');
const NOT_NAMES = new Set(['god', 'lord', 'jehovah', 'yahweh', 'christ', 'christian', 'christians', 'messiah', 'holy spirit',
  'satan', 'devil', 'beelzebub', 'abaddon', 'apollyon', 'lucifer', 'antichrist', 'immanuel', 'emmanuel', 'adversary',
  'false christs', 'gentiles', 'hebrews', 'jews', 'israel', 'israelites', 'pharisees', 'sadducees', 'herodians', 'nazarenes',
  'levites', 'zealots', 'samaritans', 'nethinim', 'rechabites', 'kenites', 'anakim', 'emims', 'zamzummims', 'rephaim',
  // titles, ordinary words, foreign words, gods and months that Easton lists as headwords
  'woman', 'father', 'prince', 'queen', 'duke', 'hebrew', 'greek', 'jewess', 'libertine', 'libertines', 'sabbath', 'passover',
  'thunder', 'knock', 'praetorium', 'abba', 'paradise', 'corban', 'ephphatha', 'talitha', 'hosanna', 'amen', 'selah', 'maranatha',
  'raca', 'mammon', 'rabbi', 'rabboni', 'messias', 'elohim', 'adonai', 'jah', 'master', 'belial', 'baal', 'dagon', 'nisroch', 'bel',
  'chemosh', 'milcom', 'molech', 'moloch', 'tammuz', 'ashtoreth', 'asherah', 'diana', 'artemis', 'jupiter', 'mercury', 'mercurius',
  'castor', 'pollux', 'nergal', 'adrammelech', 'anammelech', 'meni', 'abib', 'nisan',
  'adar', 'elul', 'chisleu', 'chislev', 'tebeth', 'sebat', 'zif', 'ziv', 'ethanim', 'bul', 'sivan', 'urim', 'thummim',
  'ariel', 'leviathan', 'behemoth', 'lucifer', 'kittim', 'chittim', 'pentecost', 'purim', 'hallelujah', 'galeed', 'jegar sahadutha',
  // found in the spot check (tools/spot-check-people.js): stars, gods, places, titles, names for a people
  'arcturus', 'pleiades', 'orion', 'mazzaroth', 'tartak', 'peor', 'kithlish', 'shenir', 'sihor', 'ammi', 'jew', 'chemarim',
  'muth labben', 'baali', 'hammelech', 'pergamos', 'chiun', 'remphan', 'nibhaz', 'ashima', 'succoth benoth', 'baal zebub',
  'baal berith', 'ashtaroth', 'nachon']);
// Kept even where the text also uses the word in lowercase.
const KEEP = new Set(['mark', 'lot', 'job', 'gad', 'gog', 'magog', 'rimmon', 'nebo']);

// ---------- places -------------------------------------------------------
const PLACE_PHRASE = {
  settlement: 'A town or city', mountain: 'A mountain', 'mountain range': 'A mountain range', hill: 'A hill',
  river: 'A river', 'body of water': 'A sea or lake', wadi: 'A brook', spring: 'A spring', pool: 'A pool',
  well: 'A well', region: 'A land or region', island: 'An island', valley: 'A valley', campsite: 'A camp on the wilderness journey',
  'natural area': 'A place', field: 'A field', gate: 'A gate', road: 'A road', ford: 'A ford', 'mountain ridge': 'A ridge',
  'mountain pass': 'A pass', cliff: 'A cliff', rock: 'A rock', tree: 'A tree', garden: 'A garden', forest: 'A forest',
  structure: 'A building', altar: 'An altar', 'stone heap': 'A heap of stones', 'district in settlement': 'A district',
  promontory: 'A headland', canal: 'A canal', 'people group': 'A people'
};

function placeRecords() {
  const out = new Map();   // display key -> {name, aliases:Set, keys:Set, types:Set}
  // A name that is some other place's own name is not an alias here
  // (OpenBible lists "Jerusalem" among the names for Zion).
  const primary = new Set(S.openbible().map(r => keyOfName(r.name)));
  for (const r of S.openbible()) {
    // Names this place goes by, kept only where the WEB or KJV uses them.
    const candidates = [r.name].concat(r.names.filter(n => keyOfName(n) === keyOfName(r.name) || !primary.has(keyOfName(n)))).filter(n => /^[A-Z]/.test(n) && !/\b(of the|land of|city of)\b/.test(n));
    const found = [];
    for (const n of candidates) {
      if (found.some(f => keyOfName(f) === keyOfName(n))) continue;
      const hits = r.keys.filter(k => ['WEB', 'KJV'].some(tr => T[tr].get(k) && B.phraseIn(n, T[tr].get(k))));
      if (hits.length) found.push(n);
    }
    if (!found.length) continue;
    const display = found[0];
    const k = keyOfName(display);
    let e = out.get(k);
    if (!e) out.set(k, e = { name: display, aliases: new Set(), keys: new Set(), types: new Set(), byType: new Map() });
    found.slice(1).forEach(a => e.aliases.add(a));
    r.types.forEach(t => {
      e.types.add(t);
      if (!e.byType.has(t)) e.byType.set(t, new Set());
      r.keys.forEach(x => e.byType.get(t).add(x));
    });
    r.keys.forEach(x => e.keys.add(x));
  }
  return out;
}

// ---------- people -------------------------------------------------------
function placeVerseSets(places) {
  const m = new Map();
  for (const [k, e] of places) m.set(k, e.keys);
  return m;
}

const PLACE_WORDS = /\b(valley of|city of|cities of|land of|wilderness of|mount|mountain of|plain of|border of|villages of|brook|river)\s+$/i;
function placeUse(name, key) {
  const re = new RegExp('(.{0,24})\\b' + name.replace(/[-\s]/g, '[- ]?') + '\\b', 'gi');
  let uses = 0, place = 0;
  for (const tr of ['WEB', 'KJV']) {
    const t = T[tr].get(key) || '';
    let m;
    while ((m = re.exec(t))) { uses++; if (PLACE_WORDS.test(m[1])) place++; }
  }
  return uses > 0 && place === uses;
}

function peopleRecords(places) {
  const placeVerses = placeVerseSets(places);
  const out = new Map();   // key -> {name, aliases:Set, senses:[{keys, text}]}
  for (const entry of S.easton()) {
    const term = entry.term.trim();
    if (!/^[A-Z][a-z]+(?:[- ][A-Z]?[a-z]+)*$/.test(term)) continue;
    const k = keyOfName(term);
    if (NOT_NAMES.has(k) || /(ites?|ians)$/.test(k)) continue;
    const appear = B.versesWith(term, true);
    // Mostly a lowercase word in the text ("thunder", "woman")? Then not a name.
    if (!KEEP.has(k)) {
      const any = B.versesWith(term, false).size;
      if (any - appear.size > appear.size * 0.5) continue;
    }
    const pv = placeVerses.get(k) || new Set();
    const senses = [];
    for (const p of entry.paras) {
      if (p.kind !== 'person') continue;
      if (/^(descendants|the descendants|a people|a tribe|a family|a clan)\b/i.test(p.text.replace(/^[^,]*,\s*/, ''))) continue;
      const keys = p.keys.filter(x => appear.has(x) && !pv.has(x) && !placeUse(term, x));
      if (keys.length) senses.push({ keys, text: p.text });
    }
    if (!senses.length) continue;
    out.set(k, { name: term, aliases: new Set(), senses, notes: [] });
  }
  return out;
}

// Hand lists add people Easton lacks, and carry better notes and aliases.
function mergeHand(people) {
  const files = ['people-hand.txt', 'people-women.txt'].map(f => path.join(ROOT, 'content', f)).filter(f => fs.existsSync(f));
  for (const file of files) for (const p of parse(fs.readFileSync(file, 'utf8'), path.basename(file))) {
    for (const a of p.answers) {
      const k = keyOfName(a.name);
      const keys = displayKeys(a.refsSrc);
      const named = keys.filter(x => [a.name].concat(a.aliases).some(n =>
        ['WEB', 'KJV'].some(tr => T[tr].get(x) && B.phraseIn(n, T[tr].get(x)))));
      let e = people.get(k);
      if (!e) { e = { name: a.name, aliases: new Set(), senses: [], notes: [] }; people.set(k, e); }
      a.aliases.forEach(x => e.aliases.add(x));
      if (named.length) e.senses.unshift({ keys: named, text: '', hand: true, scope: p.id });
      if (a.note) e.notes.push({ keys: named, note: a.note, scope: p.id });
      if (a.forms) e.forms = (e.forms || []).concat(a.forms);
    }
  }
}

function displayKeys(src) {
  let book = null, out = [];
  for (const seg of src.split(';').map(s => s.trim()).filter(Boolean)) {
    const ref = /^(?:[123] )?[A-Za-z]/.test(seg) ? seg : book + ' ' + seg;
    const m = ref.match(/^((?:[123] )?[A-Za-z][A-Za-z ]*?) \d/);
    book = m ? m[1] : book;
    try { out = out.concat(B.verseKeys(ref)); } catch (e) { /* reported by verify */ }
  }
  return out;
}

// ---------- notes --------------------------------------------------------
const REL = /\b(son|daughter|wife|husband|father|mother|brother|sister|grandson|king|queen|servant|prophet|priest) of ([A-Z][a-z]+)/;
function personNote(e, key, scope) {
  const hand = e.notes.find(n => n.scope === scope && n.keys.includes(key)) || e.notes.find(n => n.keys.includes(key)) ||
    e.notes.find(n => n.scope === scope);
  if (hand) return hand.note;
  const sense = e.senses.find(s => s.keys.includes(key));
  if (sense && sense.text) {
    const m = sense.text.slice(0, 200).match(REL);
    if (m) {
      const phrase = new RegExp('\\b' + m[1] + ' of ' + m[2] + '\\b', 'i');
      const said = ['WEB', 'KJV'].some(tr => { const t = T[tr].get(key) || ''; return phrase.test(t) && B.phraseIn(e.name, t); });
      if (said) return m[1][0].toUpperCase() + m[1].slice(1) + ' of ' + m[2] + '.';
    }
  }
  return null;
}


// ---------- tidying a prompt's answers -----------------------------------
// "Mount Heres" and "Heres", or "Sea of Jazer" and "Jazer", are one answer.
const TYPE_WORDS = /^(Mount|Mt\.?|Mountains? of|River|Brook|Sea of|Valley of|Waters of|Pool of|Well of|Hill of|Plain of|Wilderness of|Desert of|Land of|Fountain of|Spring of) /i;
// Compare names the way the game's matcher will (spaces, hyphens and the
// prompt's ignored words set aside).
let sk = n => M.keyOf(n.replace(TYPE_WORDS, '').replace(/ (River|Brook|Valley)$/i, ''), []);

function hasName(n, k) { return ['WEB', 'KJV'].some(tr => T[tr].get(k) && B.phraseIn(n, T[tr].get(k))); }

// One answer per name: KJV and WEB spellings of the same name, and a name
// with a qualifier ("Judas Iscariot", "Mary Magdalene"), fold into one.
const SPELLINGS = [
  ['Sarah', 'Sara', 'Sarai'], ['Rebekah', 'Rebecca'], ['Hagar', 'Agar'], ['Noah', 'Noe'], ['Elijah', 'Elias'], ['Elisha', 'Eliseus'],
  ['Isaiah', 'Esaias'], ['Jeremiah', 'Jeremy', 'Jeremias'], ['Hosea', 'Osee'], ['Jonah', 'Jonas'], ['Korah', 'Core'],
  ['Perez', 'Pharez', 'Phares'], ['Zerah', 'Zarah', 'Zara'], ['Hezron', 'Esrom'], ['Amminadab', 'Aminadab'], ['Nahshon', 'Naasson'],
  ['Boaz', 'Booz'], ['Rahab', 'Rachab'], ['Tamar', 'Thamar'], ['Rehoboam', 'Roboam'], ['Abijah', 'Abia', 'Abijam'],
  ['Jehoshaphat', 'Josaphat'], ['Joram', 'Jehoram'], ['Uzziah', 'Ozias'], ['Jotham', 'Joatham'], ['Ahaz', 'Achaz'],
  ['Hezekiah', 'Ezekias'], ['Manasseh', 'Manasses'], ['Josiah', 'Josias'], ['Jechoniah', 'Jeconiah', 'Jechonias', 'Coniah'],
  ['Zerubbabel', 'Zorobabel'], ['Shealtiel', 'Salathiel'], ['Uriah', 'Urias', 'Urijah'], ['Judah', 'Juda'],
  ['Zechariah', 'Zacharias', 'Zachariah'], ['Elizabeth', 'Elisabeth'], ['Quirinius', 'Cyrenius'], ['Clopas', 'Cleophas'],
  ['Pilate', 'Pontius Pilate'], ['Augustus', 'Caesar Augustus'], ['Timothy', 'Timotheus'], ['Mark', 'Marcus'], ['Luke', 'Lucas'],
  ['Silas', 'Silvanus'], ['Priscilla', 'Prisca'], ['Oholibamah', 'Aholibamah'], ['Basemath', 'Bashemath', 'Basmath'],
  ['Mahalalel', 'Mahalaleel', 'Maleleel'], ['Methuselah', 'Mathusala'], ['Enosh', 'Enos'], ['Kenan', 'Cainan'], ['Jared', 'Jered'],
  ['Arphaxad', 'Arpachshad'], ['Serug', 'Saruch'], ['Nahor', 'Nachor'], ['Terah', 'Thara'], ['Shelah', 'Sala', 'Salah'],
  ['Thaddaeus', 'Lebbaeus'], ['Dorcas', 'Tabitha'], ['Jehoiachin', 'Jechoniah'], ['Solomon', 'Jedidiah'],
  ['Peter', 'Simon Peter', 'Cephas'], ['Mary', 'Mary Magdalene', 'Mary the mother of James', 'Mary the wife of Clopas'],
  ['Judas', 'Judas Iscariot'], ['Simon', 'Simon Zelotes', 'Simon of Cyrene'], ['John', 'John the Baptist'],
  ['Matthew', 'Levi'], ['Bartimaeus', 'Timaeus']
].filter(g => !(g[0] === 'Matthew' || g[0] === 'Bartimaeus'));   // Levi and Timaeus are also other people

function foldNames(answers) {
  const byKey = new Map(answers.map(a => [keyOfName(a.name), a]));
  const fold = (into, from) => {
    if (!into || !from || into === from) return;
    into.aliases = new Set([...into.aliases, from.name, ...from.aliases]);
    into.keys = [...new Set((into.keys || []).concat(from.keys || []))].sort(byOrder);
    into.forms = (into.forms || []).concat(from.forms || []);
    from.folded = true;
  };
  for (const g of SPELLINGS) {
    const present = g.map(n => byKey.get(keyOfName(n))).filter(Boolean);
    if (present.length > 1) present.slice(1).forEach(f => fold(present[0], f));
  }
  return answers.filter(a => !a.folded);
}

function finalize(cfg, answers, books) {
  if (cfg.kind === 'person') answers = foldNames(answers);
  const ignore = ((cfg.flags || '').match(/ignore=(\S+)/) || [])[1];
  const words = ignore ? ignore.split(',') : [];
  sk = n => M.keyOf(n.replace(TYPE_WORDS, '').replace(/ (River|Brook|Valley)$/i, ''), words);
  const inBooks = k => books.has(k.split(' ')[0]);
  // Merge answers that share a name once type words are set aside.
  const merged = new Map();
  for (const a of answers) {
    const k = sk(a.name);
    const m = merged.get(k);
    if (!m) { merged.set(k, Object.assign({}, a, { aliases: new Set(a.aliases), keys: (a.keys || []).slice() })); continue; }
    a.aliases.forEach(x => m.aliases.add(x));
    if (keyOfName(a.name) !== keyOfName(m.name)) m.aliases.add(a.name);
    m.keys = [...new Set(m.keys.concat(a.keys || []))].sort(byOrder);
    m.forms = (m.forms || []).concat(a.forms || []);
  }
  const own = new Set(merged.keys());
  for (const [k, a] of merged) {
    const forms = new Set(a.forms || []);
    const aliases = [];
    for (const x of a.aliases) {
      const xk = sk(x);
      if (xk === k || own.has(xk)) continue;               // its own name, or another answer's
      if ((cfg.kind === 'place' || cfg.kind === 'book') && /(ites?|ians?)$/i.test(x)) continue;   // gentilics are not places
      aliases.push(x);
    }
    if (a.refs) { a.aliases = aliases; a.forms = [...forms]; continue; }   // hand-made extra
    // Cite a verse for the name and for each alias, so every one can be verified.
    // A book prompt cites one verse per answer; a noun prompt with a chosen
    // verse (prefer) cites that verse alone, so the reference shows the sense.
    const chosen = (cfg.batch || cfg.pending) && cfg.prefer && cfg.prefer[a.name];   // (new prompts only: live ones keep their citations)
    const cite = a.keys.slice(0, cfg.kind === 'noun' && !chosen ? 2 : 1);
    const citeFor = n => {
      let hit = a.keys.find(x => hasName(n, x));
      if (!hit) {
        const vs = [...B.versesWith(n, cfg.kind !== 'noun')].sort(byOrder);
        // A book prompt never cites outside its books: a spelling the book
        // does not use is still accepted, as a form.
        hit = vs.find(inBooks) || (cfg.kind === 'book' ? null : vs[0]);
      }
      return hit;
    };
    const nameHit = citeFor(a.name);
    if (!nameHit) {
      const swap = aliases.findIndex(x => citeFor(x));
      if (swap < 0) { a.drop = true; continue; }
      forms.add(a.name);
      a.name = aliases.splice(swap, 1)[0];
    }
    const kept = [];
    for (const n of [a.name].concat(aliases)) {
      const hit = citeFor(n);
      if (!hit) { forms.add(n); continue; }
      // With a chosen verse, another spelling that verse does not use is still
      // accepted (as a form) but does not pull in a verse of its own, which
      // could use the word in another sense ("the deep that lies beneath").
      if (chosen && n !== a.name && !cite.some(x => hasName(n, x))) { forms.add(n); continue; }
      if (n !== a.name) kept.push(n);
      if (!cite.some(x => hasName(n, x))) cite.push(hit);
    }
    a.aliases = kept;
    a.forms = [...forms].filter(f => !own.has(sk(f)) || sk(f) === k);
    a.refs = [...new Set(cite)].sort(byOrder).slice(0, 6).map(B.shortRef).join('; ');
  }
  // A name may have changed above (when the display name was not in the text).
  // Fold any answers that now share a name, then strip aliases that are some
  // other answer's name, and drop bare generic words ("Sea").
  // Labels the sources pair with a place that a player would never mean by it
  // (found by validate.js: they made one answer land on another).
  const NOT_ALIAS = {};
  [['Jerusalem', ['Jews', 'Judah']], ['Judea', ['Jews']], ['Crete', ['Philistines']],
    ['Beth-horon the nether', ['Lower']], ['Holy Place', ['Holiest of All']]]
    .forEach(([n, xs]) => { NOT_ALIAS[sk(n)] = xs; });
  const GENERIC = /^(sea|river|mount|mountain|valley|brook|hill|wilderness|desert|city|land|plain|lake|pool|spring|well|island)$/i;
  const out = new Map();
  for (const a of merged.values()) {
    if (a.drop || (cfg.kind !== 'noun' && cfg.kind !== 'book' && GENERIC.test(a.name))) continue;   // "Sea" is a fine thing to name
    const k = sk(a.name), prev = out.get(k);
    if (prev) { (a.forms || []).forEach(f => prev.forms.push(f)); continue; }
    out.set(k, a);
  }
  const names = new Set(out.keys());
  for (const [k, a] of out) {
    const bad = new Set((NOT_ALIAS[k] || []).map(sk));
    a.aliases = a.aliases.filter(x => (cfg.kind === 'noun' || cfg.kind === 'book' || !GENERIC.test(x)) && !bad.has(sk(x)) && (sk(x) === k || !names.has(sk(x))));
    a.forms = (a.forms || []).filter(f => !bad.has(sk(f)) && (!names.has(sk(f)) || sk(f) === k));
  }
  return [...out.values()];
}

// ---------- writing ------------------------------------------------------
function writePrompt(cfg, answers) {
  const exclude = new Set((cfg.exclude || []).map(keyOfName));
  answers = answers.filter(a => !exclude.has(keyOfName(a.name)));
  const lines = ['# GENERATED by tools/derive.js from ' + (cfg.batch ? 'tools/batches/' + cfg.batch + '.js' : 'tools/derive-config.js') + '. Do not edit by hand.',
    '@ ' + [cfg.id, cfg.category, cfg.prompt, cfg.theme, (cfg.flags || '')].join(' | ').replace(/ \| $/, ''), ''];
  const tiers = cfg.tiers || {};
  const tierKeys = new Map();
  Object.entries(tiers).forEach(([n, t]) => { tierKeys.set(keyOfName(n), t); tierKeys.set(sk(n), t); });
  const found = new Set();
  for (const a of answers.sort((x, y) => x.name.localeCompare(y.name))) {
    const k = keyOfName(a.name);
    const names = [a.name].concat([...a.aliases].filter(x => keyOfName(x) !== k));
    if (!a.note) a.note = 'Named in ' + a.refs.split(';')[0] + '.';
    // Picks and tiers may name the answer by any of its names ("Peniel" / "Penuel").
    const keys = names.map(keyOfName).concat(names.map(sk));
    const is = n => n && (keys.includes(keyOfName(n)) || keys.includes(sk(n)));
    lines.push(names.join('; ') + ' | ' + a.refs + ' | ' + a.note);
    if (a.forms && a.forms.length) lines.push('  forms: ' + a.forms.join('; '));
    const tk = keys.find(x => tierKeys.has(x));
    if (cfg.sheep && is(cfg.sheep.name)) { lines.push('  sheep: ' + cfg.sheep.fact); found.add('sheep'); }
    else if (cfg.seat && is(cfg.seat.name)) { lines.push('  seat: ' + cfg.seat.fact); found.add('seat'); }
    else if (tk) { lines.push('  tier: ' + tierKeys.get(tk)); keys.forEach(x => tierKeys.delete(x)); }
  }
  // A pending batch reports a missing pick and goes on (validate.js then
  // fails that prompt); a live prompt stops the build.
  const miss = m => { if (cfg.pending) console.warn('  ' + m); else throw new Error(m); };
  if (cfg.sheep && !found.has('sheep')) miss(cfg.id + ': Lost Sheep "' + cfg.sheep.name + '" is not in the bank');
  if (cfg.seat && !found.has('seat')) miss(cfg.id + ': Best Seat "' + cfg.seat.name + '" is not in the bank');
  if (tierKeys.size && cfg.warnTiers) console.warn('  ' + cfg.id + ': tier overrides not in the bank: ' + [...tierKeys.keys()].join(', '));
  (cfg.nearMisses || []).forEach(n => lines.push('? ' + n));
  fs.mkdirSync(outDir(cfg), { recursive: true });
  fs.writeFileSync(path.join(outDir(cfg), cfg.id + '.txt'), lines.join('\n') + '\n');
  return answers.length;
}

function personAnswers(cfg, people, inBooks) {
  const answers = [];
  // A book prompt takes every person whose name the book's verses use
  // (capitalized), not only the verses Easton happens to cite: Easton's
  // entry for Moses cites no verse in Numbers, but Numbers names him often.
  if (cfg.kind === 'book') {
    for (const [, e] of people) {
      let keys = [];
      // Not aliases that are also a nation or a title ("Israel" for Jacob).
      const aliases = [...e.aliases].filter(x => !NOT_NAMES.has(keyOfName(x)));
      for (const n of [e.name].concat(aliases)) keys = keys.concat([...B.versesWith(n, true)].filter(inBooks));
      keys = [...new Set(keys)].sort(byOrder);
      if (!keys.length) continue;
      const own = e.senses.some(s => s.keys.includes(keys[0]));
      const note = (own && personNote(e, keys[0], cfg.noteScope)) || 'Named in ' + fullRef(keys[0]) + '.';
      answers.push({ name: e.name, aliases: new Set(aliases), forms: e.forms, keys, note });
    }
    return answers;
  }
  {
      for (const [k, e] of people) {
        let keys = [];
        // On a filtered prompt (kings), a name on one of its own hand lists uses only
        // those senses: the king Jehu, not the prophet Jehu.
        const own = cfg.handScopes ? e.senses.filter(s => s.hand && cfg.handScopes.includes(s.scope)) : [];
        for (const s of (own.length ? own : e.senses)) {
          if (cfg.filter && !s.hand && !cfg.filter.test(s.text.slice(0, 220))) continue;
          if (cfg.filter && s.hand && !((cfg.handScopes || []).includes(s.scope) || (cfg.handOk || []).map(keyOfName).includes(k))) continue;
          keys = keys.concat(s.keys.filter(inBooks));
        }
        keys = [...new Set(keys)].sort(byOrder);
        if (!keys.length) continue;
        const note = personNote(e, keys[0], cfg.noteScope) || 'Named in ' + fullRef(keys[0]) + '.';
        answers.push({ name: e.name, aliases: e.aliases, forms: e.forms, keys, note });
      }
  }
  return answers;
}

function placeAnswers(cfg, places, inBooks) {
  const answers = [];
  {
      const types = cfg.types ? new Set(cfg.types) : null;
      for (const [k, e] of places) {
        let keys = [];
        for (const [t, set] of e.byType) {
          if (types && !types.has(t)) continue;
          if (!types && (t === 'special' || t === 'people group')) continue;
          keys = keys.concat([...set].filter(inBooks));
        }
        // Keep only verses where one of its names really appears.
        const names = [e.name].concat([...e.aliases]);
        keys = [...new Set(keys)].filter(x => names.some(n => ['WEB', 'KJV'].some(tr => T[tr].get(x) && B.phraseIn(n, T[tr].get(x))))).sort(byOrder);
        if (!keys.length) continue;
        const type = [...e.types].find(t => !types || types.has(t)) || [...e.types][0];
        const phrase = PLACE_PHRASE[type] || 'A place';
        // A book prompt says only where: OpenBible's types do not always fit one book.
        answers.push({ name: e.name, aliases: e.aliases, keys,
          note: (cfg.notes && cfg.notes[e.name]) || (cfg.kind === 'book' ? 'Named in ' + fullRef(keys[0]) + '.' : phrase + ' named in ' + fullRef(keys[0]) + '.') });
      }
  }
  return answers;
}

function nounAnswers(cfg, inBooks) {
  const answers = [];
  {
      // Common nouns: every verse that uses the word or one of its spellings.
      for (const item of cfg.items) {
        const names = item.split(';').map(x => x.trim()).filter(Boolean);
        let keys = [];
        names.forEach(n => { keys = keys.concat([...B.versesWith(n, false)].filter(inBooks)); });
        keys = [...new Set(keys)].sort(byOrder);
        if (!keys.length) { if (cfg.kind === 'noun') console.warn('  ' + cfg.id + ': "' + names[0] + '" is not in the WEB or KJV; left out'); continue; }
        if (cfg.prefer && cfg.prefer[names[0]]) keys = displayKeys(cfg.prefer[names[0]]).concat(keys.filter(k => !displayKeys(cfg.prefer[names[0]]).includes(k)));
        const note = (cfg.notes && cfg.notes[names[0]]) || 'Mentioned in ' + fullRef(keys[0]) + '.';
        answers.push({ name: names[0], aliases: new Set(names.slice(1)), keys, note, forms: (cfg.forms && cfg.forms[names[0]]) || [] });
      }
    }
  return answers;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
  for (const cfg of CONFIG) if (cfg.pending) fs.rmSync(outDir(cfg), { recursive: true, force: true });
  const places = placeRecords();
  const people = peopleRecords(places);
  mergeHand(people);
  console.log('Pool: ' + people.size + ' people, ' + places.size + ' places');

  for (const cfg of CONFIG) {
    const books = new Set(cfg.books || ALL);
    const inBooks = k => books.has(k.split(' ')[0]);
    let answers = [];
    // 'book': every person, place and listed thing named in the prompt's books.
    if (cfg.kind === 'person' || cfg.kind === 'book') answers = answers.concat(personAnswers(cfg, people, inBooks));
    if (cfg.kind === 'book') answers = foldNames(answers);
    if (cfg.kind === 'place' || cfg.kind === 'book') answers = answers.concat(placeAnswers(cfg, places, inBooks));
    if (cfg.kind === 'noun' || cfg.kind === 'book') answers = answers.concat(nounAnswers(cfg, inBooks));
    for (const x of cfg.extra || []) {
      if (!answers.some(a => keyOfName(a.name) === keyOfName(x.name))) answers.push(Object.assign({}, x, { aliases: new Set(x.aliases || []) }));
    }
    const n = writePrompt(cfg, finalize(cfg, answers, books));
    console.log((cfg.id).padEnd(26) + n + ' answers');
  }
}

function fullRef(key) {
  const [code, cv] = key.split(' ');
  const name = B.BY_CODE.get(code)[1].replace(/^Psalms$/, 'Psalm');
  return name + ' ' + cv;
}

main();
