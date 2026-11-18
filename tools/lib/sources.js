/* Fishers: readers for the reference sources in tools/.cache/.
 *
 *   easton()    Easton's Bible Dictionary (1897, public domain): one record per
 *               headword, split into paragraphs, each with the verse keys it
 *               cites and a rough reading of whether it describes a person or a place.
 *   openbible() OpenBible.info Bible Geocoding Data (CC BY 4.0): one record per
 *               place, with its types, the names translations use for it, and
 *               every verse that mentions it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./bible.js');

const OSIS = {
  Gen: 'GEN', Exod: 'EXO', Lev: 'LEV', Num: 'NUM', Deut: 'DEU', Josh: 'JOS', Judg: 'JDG', Ruth: 'RUT',
  '1Sam': '1SA', '2Sam': '2SA', '1Kgs': '1KI', '2Kgs': '2KI', '1Chr': '1CH', '2Chr': '2CH', Ezra: 'EZR',
  Neh: 'NEH', Esth: 'EST', Job: 'JOB', Ps: 'PSA', Prov: 'PRO', Eccl: 'ECC', Song: 'SOL', Isa: 'ISA',
  Jer: 'JER', Lam: 'LAM', Ezek: 'EZE', Dan: 'DAN', Hos: 'HOS', Joel: 'JOE', Amos: 'AMO', Obad: 'OBA',
  Jonah: 'JON', Mic: 'MIC', Nah: 'NAH', Hab: 'HAB', Zeph: 'ZEP', Hag: 'HAG', Zech: 'ZEC', Mal: 'MAL',
  Matt: 'MAT', Mark: 'MAR', Luke: 'LUK', John: 'JOH', Acts: 'ACT', Rom: 'ROM', '1Cor': '1CO', '2Cor': '2CO',
  Gal: 'GAL', Eph: 'EPH', Phil: 'PHI', Col: 'COL', '1Thess': '1TH', '2Thess': '2TH', '1Tim': '1TI',
  '2Tim': '2TI', Titus: 'TIT', Phlm: 'PHM', Heb: 'HEB', Jas: 'JAM', '1Pet': '1PE', '2Pet': '2PE',
  '1John': '1JO', '2John': '2JO', '3John': '3JO', Jude: 'JUD', Rev: 'REV'
};

// "1Sam.22.20-1Sam.22.23" or "Gen.4.17" -> verse keys (ranges capped at 40 verses)
function osisKeys(osis) {
  const out = [];
  const [a, b] = osis.split('-');
  const pa = a.split('.'), code = OSIS[pa[0]];
  if (!code || pa.length < 2) return out;
  const ch = +pa[1], v1 = pa[2] ? +pa[2] : 1;
  let v2 = v1;
  if (b) {
    const pb = b.split('.');
    if (pb.length === 3 && +pb[1] === ch) v2 = +pb[2];
    else if (pb.length === 1 && /^\d+$/.test(pb[0])) v2 = +pb[0];
  }
  for (let v = v1; v <= Math.min(v2, v1 + 40); v++) out.push(code + ' ' + ch + ':' + v);
  return out;
}

const PERSON = /\b(son|sons|daughter|daughters|wife|wives|husband|father|mother|brother|sister|grandson|granddaughter|nephew|uncle|descendant|king|queen|prince|princess|prophet|prophetess|priest|Levite|chief|captain|commander|servant|apostle|disciple|governor|judge|warrior|officer|scribe|singer|porter|eunuch|steward|chamberlain|centurion|merchant|patriarch|concubine|widow|nurse|midwife|tetrarch|emperor|proconsul|deputy|tribune|physician|convert|Christian|lawyer|one of the sons|one of David's|a Benjamite|an Ephraimite|a Gileadite|a Gadite|a Gershonite|a Merarite|a Kohathite|a Simeonite|a Reubenite|a Danite|a Levite|man|evangelist|name given|called also|surnamed|an Israelite|a Jew|a Hebrew|a Christian|a disciple|one who)\b/i;
const DEITY = /\b(a|the|an) (god|goddess|deity|idol|Phoenician god|Syrian god)\b/;
const PLACE = /\b(city|cities|town|towns|village|place|places|mountain|mount|hill|river|brook|stream|valley|plain|district|region|country|province|island|sea|lake|fountain|spring|well|wilderness|desert|station|encampment|camp|gate|pool|tower|port|harbour|harbor|capital|territory|tract|range|fortress|stronghold|land of|haven|ford|plateau)\b/i;

function stripTags(s) {
  return s.replace(/<scripRef[^>]*>([\s\S]*?)<\/scripRef>/g, '$1').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

let eastonCache = null;
function easton() {
  if (eastonCache) return eastonCache;
  const file = path.join(B.CACHE, 'easton', 'ebd2.xml');
  if (!fs.existsSync(file)) throw new Error('Missing ' + file + '. Run: node tools/fetch-sources.js');
  const xml = fs.readFileSync(file, 'utf8');
  const out = [];
  const re = /<term[^>]*>([\s\S]*?)<\/term>\s*<def[^>]*>([\s\S]*?)<\/def>/g;
  let m;
  while ((m = re.exec(xml))) {
    const term = stripTags(m[1]);
    const paras = [];
    const pre = /<p[^>]*>([\s\S]*?)<\/p>/g;
    let pm;
    while ((pm = pre.exec(m[2]))) {
      const raw = pm[1];
      const text = stripTags(raw);
      const keys = [];
      raw.replace(/osisRef="Bible:([^"]+)"/g, (x, o) => { keys.push(...osisKeys(o)); return x; });
      // A new sense starts the entry or opens with "(2.)". Judge it by
      // whichever kind of word comes first; follow-on paragraphs inherit it.
      const startsSense = !paras.length || /^\(\d+\.?\)/.test(text);
      let kind;
      if (startsSense) {
        const head = text.slice(0, 220);
        const pp = head.search(PERSON), pl = head.search(PLACE);
        kind = pp < 0 && pl < 0 ? 'other' : pl < 0 || (pp >= 0 && pp < pl) ? 'person' : 'place';
        if (kind === 'person' && DEITY.test(head.slice(0, 140))) kind = 'other';
      } else kind = paras[paras.length - 1].kind;
      paras.push({ text, keys, kind, startsSense });
    }
    out.push({ term, paras });
  }
  eastonCache = out;
  return out;
}

// OpenBible uses USX book codes; the ebible.org text files use their own.
const USX = { SNG: 'SOL', EZK: 'EZE', JOL: 'JOE', NAM: 'NAH', MRK: 'MAR', JHN: 'JOH', PHP: 'PHI', JAS: 'JAM', '1JN': '1JO', '2JN': '2JO', '3JN': '3JO' };
let obCache = null;
function openbible() {
  if (obCache) return obCache;
  const file = path.join(B.CACHE, 'openbible', 'ancient.jsonl');
  if (!fs.existsSync(file)) throw new Error('Missing ' + file + '. Run: node tools/fetch-sources.js');
  obCache = fs.readFileSync(file, 'utf8').trim().split('\n').map(l => {
    const o = JSON.parse(l);
    return {
      id: o.id,
      name: o.friendly_id.replace(/\s+\d+$/, ''),
      types: o.types || [],
      names: Object.keys(o.translation_name_counts || {}),
      keys: (o.verses || []).map(v => v.usx && v.usx.replace(/^(\w{3}) (\d+):(\d+)$/, (m, b, c, x) => (USX[b] || b) + ' ' + c + ':' + x)).filter(Boolean),
      comment: (o.comment || '').replace(/<[^>]+>/g, '')
    };
  });
  return obCache;
}

module.exports = { easton, openbible, osisKeys };
