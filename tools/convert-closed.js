#!/usr/bin/env node
/* One-off: turns the earlier hand-written name lists (the interim
 * data/prompts.json) into content/closed-sets.txt. Aliases that cannot be
 * found at the cited verses in the WEB or KJV become unverified forms.
 * Kept in the repo as a record of where content/closed-sets.txt came from.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/bible.js');
const ROOT = path.join(__dirname, '..');
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'reports', 'interim-prompts.json'), 'utf8'));

const SETS = {
  apostles: { cat: 'People', sheep: ['Jesus', 'Hebrews calls Jesus the Apostle and High Priest of our confession (Hebrews 3:1).'] },
  hebrews11: { cat: 'People', sheep: ['Barak', 'Barak is named in the closing list of the faithful with Gideon, Samson and Jephthah (Hebrews 11:32).'] },
  'matthew-genealogy': { cat: 'People', sheep: ['Zerah', 'Zerah, the twin of Perez, is named in the genealogy though the line runs through his brother (Matthew 1:3).'] },
  romans16: { cat: 'People', sheep: ['Tertius', 'Tertius wrote the letter down and added his own greeting (Romans 16:22).'] },
  'passion-people': { cat: 'People', sheep: ['Rufus', 'Rufus and Alexander were the sons of Simon of Cyrene, who carried the cross (Mark 15:21).'] },
  'esther-people': { cat: 'People', sheep: ['Hathach', 'Hathach carried messages between Esther and Mordecai (Esther 4:5-10).'] },
  'judges-people': { cat: 'People', sheep: ['Shamgar', 'Shamgar struck down six hundred Philistines with an ox goad (Judges 3:31).'] },
  'david-family': { cat: 'People', sheep: ['Nathan', 'Luke traces the line of Jesus through Nathan, a son of David (Luke 3:31).'] },
  'judah-kings': { cat: 'People', sheep: ['Athaliah', 'Athaliah reigned over Judah for six years, the only queen to rule it in her own name (2 Kings 11:3).'] },
  'israel-kings': { cat: 'People', sheep: ['Zimri', 'Zimri reigned seven days in Tirzah, the shortest reign of any king of Israel (1 Kings 16:15).'] },
  'ot-prophets': { cat: 'People', sheep: ['Huldah', 'Huldah the prophetess was consulted when the Book of the Law was found in the temple (2 Kings 22:14).'] },
  priests: { cat: 'Worship & Feasts', sheep: ['Melchizedek', 'Melchizedek, king of Salem, was priest of God Most High in the days of Abram (Genesis 14:18).'] },
  'altar-builders': { cat: 'Worship & Feasts', sheep: ['Saul', 'The altar Saul built after the battle at Michmash was the first altar he built to the LORD (1 Samuel 14:35).'] },
  'nt-women': { cat: 'People', sheep: ['Rhoda', 'Rhoda was so glad to hear Peter at the gate that she ran in without opening it (Acts 12:13-14).'] },
  'paul-coworkers': { cat: 'People', sheep: ['Epaphroditus', 'Epaphroditus nearly died for the work of Christ while bringing the gift of the Philippians to Paul (Philippians 2:25-30).'] },
  'nt-rulers': { cat: 'People', sheep: ['Erastus', 'Erastus, the treasurer of the city, sent greetings to the church in Rome (Romans 16:23).'] },
  'titles-of-jesus': { cat: 'Names & Titles', sheep: ['Dayspring', 'Zacharias sang that the dayspring from on high had visited his people (Luke 1:78).'] },
  'nt-letters': { cat: 'Books of the Bible', books: true, sheep: ['2 John', '2 John is addressed to the chosen lady and her children (2 John 1).'] },
  'ot-books': { cat: 'Books of the Bible', books: true, sheep: ['Obadiah', 'Obadiah is the shortest book of the Old Testament: a single chapter of twenty-one verses.'] },
  'nt-books': { cat: 'Books of the Bible', books: true, sheep: ['Philemon', 'Philemon, a single chapter, is the appeal Paul wrote for the runaway slave Onesimus (Philemon 10-16).'] },
  'feasts-times': { cat: 'Worship & Feasts', sheep: ['Feast of Dedication', 'Jesus walked in the temple in Solomon\'s porch at the winter Feast of Dedication (John 10:22-23).'] },
  offerings: { cat: 'Worship & Feasts', sheep: ['Red heifer', 'The ashes of a red heifer were kept for the water of cleansing (Numbers 19:2-9).'] },
  'tabernacle-items': { cat: 'Worship & Feasts', sheep: ['Urim and Thummim', 'The Urim and Thummim were placed in the breastpiece over Aaron\'s heart (Exodus 28:30).'] },
  'tabernacle-materials': { cat: 'Worship & Feasts', sheep: ['Onycha', 'Onycha was one of the four spices in the holy incense (Exodus 30:34).'] }
};

const T = B.texts();
const has = (n, ref) => { try { return B.foundAt(n, [ref]).length > 0; } catch (e) { return false; } };

let out = '# Closed sets: fixed lists under 60 answers. At most one appears in a daily cast.\n' +
  '# Converted from the earlier hand-written lists by tools/convert-closed.js, then checked by tools/verify.js.\n';
for (const [id, cfg] of Object.entries(SETS)) {
  const p = src.prompts.find(x => x.id === id);
  if (!p) { console.warn('missing ' + id); continue; }
  const flags = ['closed', cfg.books ? 'books' : '', p.ignoreWords && p.ignoreWords.length ? 'ignore=' + p.ignoreWords.join(',') : ''].filter(Boolean).join(' ');
  out += '\n@ ' + id + ' | ' + cfg.cat + ' | ' + p.prompt + ' | ' + p.theme + ' | ' + flags + '\n';
  let sheepFound = false;
  const entries = [];   // folded by name below
  for (const a of p.answers) {
    const refs = a.refs.join('; ');
    let name = a.name, aliases = [], forms = [];
    if (!cfg.books) {
      let named = [a.name].concat(a.aliases).filter(n => a.refs.some(r => has(n, r)));
      // "Joseph of Arimathea", "Herod Antipas": fall back to the bare name the text uses.
      const first = a.name.split(' ')[0];
      if (!named.length && cfg.cat === 'People' && a.name.includes(' ') && a.refs.some(r => has(first, r))) named = [first];
      if (!named.length) { forms = [a.name].concat(a.aliases); name = null; }
      else {
        if (!named.includes(a.name)) { forms.push(a.name); name = named[0]; }
        [a.name].concat(a.aliases).forEach(n => { if (n !== name && !named.includes(n) && !forms.includes(n)) forms.push(n); });
        aliases = named.filter(n => n !== name);
      }
    } else aliases = a.aliases;
    if (!name) { console.warn('  ' + id + ': dropped "' + a.name + '" (not found at ' + refs + ')'); continue; }
    if (!refs) continue;
    // Same name, one answer: fold a second "Mary" or "Herod" into the first.
    const key = B.words(name).join('');
    const same = entries.find(e => B.words(e.name).join('') === key);
    if (same) {
      same.refs += '; ' + refs;
      aliases.concat(forms).forEach(x => { if (!same.aliases.includes(x) && !same.forms.includes(x)) same.forms.push(x); });
      if (a.name === cfg.sheep[0]) same.sheep = true;
      continue;
    }
    entries.push({ name, aliases, forms, refs, note: a.note, tier: a.tier, sheep: a.name === cfg.sheep[0] || name === cfg.sheep[0] });
  }
  const names = new Set(entries.map(e => B.words(e.name).join('')));
  for (const e of entries) {
    // An alias that is another answer's name belongs to that answer.
    const aliases = e.aliases.filter(x => !names.has(B.words(x).join('')));
    out += [e.name].concat(aliases).join('; ') + ' | ' + e.refs + ' | ' + e.note + '\n';
    const forms = e.forms.filter(x => !names.has(B.words(x).join('')));
    if (forms.length) out += '  forms: ' + forms.join('; ') + '\n';
    if (e.sheep) { out += '  sheep: ' + cfg.sheep[1] + '\n'; sheepFound = true; }
    else if (cfg.books && e.tier && e.tier !== 6) out += '  tier: ' + e.tier + '\n';
  }
  if (!sheepFound) console.warn('  ' + id + ': Lost Sheep ' + cfg.sheep[0] + ' not found');
  for (const n of p.nearMisses) out += '? ' + [n.name].concat(n.aliases).join('; ') + ' | ' + n.message + '\n';
}
fs.writeFileSync(path.join(ROOT, 'content', 'closed-sets.txt'), out);
console.log('Wrote content/closed-sets.txt');
