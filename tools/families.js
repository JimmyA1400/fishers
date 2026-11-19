#!/usr/bin/env node
/* Fishers: the family of every prompt, and retired prompts.
 *
 * A family groups prompts that feel alike ("a person in Genesis", "a person
 * in Acts"). The daily schedule allows one prompt per family per day, and two
 * prompts in the same family that share half their answers count as the same
 * prompt for the cooldown (see js/schedule.js).
 *
 * Prompt IDs are permanent: never rename or reuse one. To retire a prompt,
 * add its ID to RETIRED; it stays in the bank (past days still need it) but
 * no future day, Endless cast or Practice draw uses it.
 *
 *     node tools/families.js           -> writes family/retired into data/prompts.json (and prompts.js)
 *     node tools/families.js --check   -> exits 1 if a prompt has no family or the data is stale
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FAMILIES = {
  'books-of-the-bible': ['books', 'ot-books', 'nt-books', 'nt-letters'],
  'book-scoped': ['revelation'],
  'people-broad': ['people-all', 'people-ot', 'people-nt'],
  'people-by-book': ['people-genesis', 'people-law', 'people-joshua-ruth', 'people-samuel', 'people-kings',
    'people-chronicles', 'people-exile', 'people-prophets', 'people-gospels', 'people-acts', 'people-letters'],
  'people-women': ['women', 'nt-women'],
  'people-in-a-passage': ['hebrews11', 'matthew-genealogy', 'romans16', 'passion-people', 'esther-people',
    'judges-people', 'david-family'],
  'people-who': ['who-wept', 'who-ran', 'who-fasted', 'dreams-visions', 'angel-encounters', 'prisoners', 'giants',
    'altar-builders'],
  'church-people': ['apostles', 'paul-coworkers'],
  'kings-rulers': ['kings', 'judah-kings', 'israel-kings', 'nt-rulers'],
  'prophets-priests-writers': ['ot-prophets', 'priests', 'psalm-writers'],
  'places-broad': ['places-all'],
  'places-by-book': ['places-genesis', 'places-law', 'places-joshua', 'places-judges-samuel', 'places-kings',
    'places-prophets', 'places-gospels', 'places-acts'],
  'places-kinds': ['cities', 'regions', 'waters-mountains'],
  'places-lists': ['seven-churches', 'cities-of-refuge', 'eden'],
  'creatures': ['creatures', 'birds'],
  'body': ['body-parts'],
  'food-plants': ['food', 'plants'],
  'objects': ['objects', 'clothing', 'instruments', 'stones-metals', 'measures-money'],
  'colors': ['colors'],
  'worship': ['tabernacle-items', 'tabernacle-materials', 'solomons-temple', 'offerings', 'feasts-times'],
  'names-titles': ['titles-of-jesus', 'names-of-god', 'holy-spirit-names', 'new-names'],
  'jesus-sayings': ['i-am-sayings', 'cross-sayings', 'kingdom-is-like'],
  'parables-miracles': ['parables-miracles'],
  'signs-wonders': ['plagues', 'diseases', 'blindness', 'from-heaven', 'raised-from-dead'],
  'virtues-gifts': ['fruit-of-the-spirit', 'armor-of-god', 'spiritual-gifts'],
  'nations': ['nations'],
  'trades': ['occupations', 'shepherds']
};
const RETIRED = [];

const FAMILY_OF = {};
for (const [f, ids] of Object.entries(FAMILIES)) for (const id of ids) {
  if (FAMILY_OF[id]) throw new Error(id + ' is in two families');
  FAMILY_OF[id] = f;
}

function apply(data) {
  const missing = [];
  for (const p of data.prompts) {
    if (!FAMILY_OF[p.id]) { missing.push(p.id); continue; }
    p.family = FAMILY_OF[p.id];
    if (RETIRED.includes(p.id)) p.retired = true; else delete p.retired;
  }
  if (missing.length) throw new Error('No family for: ' + missing.join(', ') + ' (add them in tools/families.js)');
  const known = new Set(data.prompts.map((p) => p.id));
  const stray = Object.keys(FAMILY_OF).filter((id) => !known.has(id));
  if (stray.length) throw new Error('tools/families.js names prompts that are not in the bank: ' + stray.join(', '));
  return data;
}

module.exports = { apply, FAMILIES, RETIRED };

if (require.main === module) {
  const FILE = path.join(__dirname, '..', 'data', 'prompts.json');
  const raw = fs.readFileSync(FILE, 'utf8');
  const data = apply(JSON.parse(raw));
  const out = JSON.stringify(data) + '\n';
  if (process.argv.includes('--check')) {
    if (out !== raw) { console.error('data/prompts.json families are stale. Run: node tools/families.js'); process.exit(1); }
    console.log(data.prompts.length + ' prompts in ' + Object.keys(FAMILIES).length + ' families; ' + RETIRED.length + ' retired');
  } else {
    fs.writeFileSync(FILE, out);
    require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'sync-data.js')], { stdio: 'inherit' });
    console.log('Families written for ' + data.prompts.length + ' prompts');
  }
}
