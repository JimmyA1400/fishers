/* Fishers: new prompts, batch 1 (waiting for review; see PROGRESS.md).
 *
 * Everything here is written to content/pending/batch-1/ by tools/derive.js
 * and stays out of the game until approved. To approve, set PENDING below to
 * null (the prompts then go to content/generated/), append the IDs to
 * content/prompt-ids.list, and rebuild.
 *
 * 16 book-scoped prompts ("a person, place, or thing named in the book of
 * ___": every person and place the derivation finds in that book, plus the
 * concrete things in tools/lib/things.js that the book's verses name) and 4
 * noun prompts (sins, virtues, buildings, land and sky).
 */
'use strict';
const B = require('../lib/bible.js');
const L = require('../lib/things.js');

// Approved 2026-11-19: the prompts are live (content/generated/).
const BATCH = 'batch-1', PENDING = null;

// ---------- book-scoped -----------------------------------------------------
const THINGS = L.things(false), ABSTRACT = L.things(true);
// Words that are also common verbs or adjectives ("bow down", "they saw",
// "lead them", "it is well"). In a book prompt the text match cannot tell
// the senses apart, so these stay out unless the book's `keep` gives a verse
// where the word is the thing.
const AMBIGUOUS = new Set(['saw', 'bow', 'lead', 'well', 'bear', 'fly', 'spring', 'palm', 'date', 'dates', 'kid', 'row', 'rush', 'mint',
  'rue', 'cane', 'ash', 'box', 'pine', 'hind', 'seal', 'press', 'rose', 'hail', 'wave', 'waves', 'cross', 'saddle', 'plow', 'plough',
  'couch', 'bridle', 'quiver', 'sail', 'pound', 'swallow', 'ford', 'peak', 'slope', 'light', 'sling', 'plane', 'bay', 'cock', 'hart',
  'cast', 'fan', 'lot', 'mark', 'post', 'fold', 'hold', 'top', 'deep', 'plain', 'way']);
function bookThings(keep, abstract) {
  const kept = new Set(Object.keys(keep || {}).map((k) => k.toLowerCase()));
  return (abstract ? ABSTRACT : THINGS).map((it) => {
    const parts = it.split(';').map((x) => x.trim()).filter((x) => kept.has(x.toLowerCase()) || !AMBIGUOUS.has(x.toLowerCase()));
    return parts.join('; ');
  }).filter(Boolean);
}
function book(id, code, name, theme, sheep, tiers, nearMisses, extra) {
  const codes = Array.isArray(code) ? code : [code];
  const keep = (extra && extra.keep) || {};
  return Object.assign({
    id, kind: 'book', batch: BATCH, pending: PENDING, category: 'Books of the Bible', theme, books: codes,
    flags: 'nouns within=' + codes.join(',') + ' ignore=the,a,an,of,in,mount,' + name.toLowerCase().split(' ').filter((w) => !/^\d$/.test(w)).join(','),
    prompt: 'Name a person, place, or thing named in the book of ' + name + '.',
    items: bookThings(keep, extra && extra.abstract), prefer: keep, sheep, tiers,
    nearMisses: nearMisses.concat(['God; the LORD; Lord; Yahweh; Jehovah | God is not one of the answers in this net; name someone or something he made, called or spoke to.']),
    // Compass words OpenBible lists as regions ("the king of the north").
    exclude: ['North', 'South', 'East', 'West']
  }, extra || {});
}

const BOOKS = [
  book('exodus-anything', 'EXO', 'Exodus', 'remembrance',
    { name: 'Aholiab', fact: 'Oholiab of the tribe of Dan worked beside Bezalel on the tabernacle (Exodus 31:6); the KJV calls him Aholiab.' },
    { Moses: 1, Pharaoh: 1, Aaron: 1, Egypt: 1, Manna: 3, Sinai: 3, Miriam: 3, Jethro: 3, 'Red Sea': 3 },
    ['Noah; Noah\'s ark | Noah is in Genesis; the ark in Exodus is the ark of the covenant (Exodus 25:10).',
      'Ten Commandments | Exodus gives them (Exodus 20:1-17) but never uses that name; try the tablets of stone.',
      'Golden calf | Exodus calls it a molded calf (Exodus 32:4); try "calf".'],
    { keep: { Bush: 'Exod 3:2', Rod: 'Exod 4:2', Staff: 'Exod 4:2', Hail: 'Exod 9:23', Rock: 'Exod 17:6', Cloud: 'Exod 13:21', Fire: 'Exod 3:2' } }),
  book('numbers-anything', 'NUM', 'Numbers', 'remembrance',
    { name: 'Eldad', fact: 'Eldad and Medad stayed in the camp and prophesied there, and Moses wished all the LORD\'s people were prophets (Numbers 11:26-29).' },
    { Moses: 1, Aaron: 1, Balaam: 3, Caleb: 3, Joshua: 3, Korah: 3, Miriam: 3 },
    ['Talking donkey; Balaam\'s donkey | Numbers just calls her a donkey (Numbers 22:28); try "donkey".',
      'Goliath; David | They come much later, in 1 Samuel.'],
    { keep: { Rod: 'Num 17:8', Cloud: 'Num 9:15' } }),
  book('joshua-anything', 'JOS', 'Joshua', 'courage',
    { name: 'Achsah', fact: 'Caleb gave his daughter Achsah to Othniel, who took Kiriath Sepher, and she asked her father for springs of water (Joshua 15:16-19).' },
    { Joshua: 1, Jericho: 1, Rahab: 1, Jordan: 1, Caleb: 3, Achan: 3, Ai: 3 },
    ['Moses\' staff; burning bush | That is Exodus; in Joshua, Moses has died (Joshua 1:1-2).',
      'Gideon; Samson; Deborah | They come in Judges, after Joshua.'],
    { keep: { Hail: 'Josh 10:11' }, forms: { 'Scarlet thread': ['Scarlet cord', 'Scarlet rope'] } }),
  book('1samuel-anything', '1SA', '1 Samuel', 'kingdom',
    { name: 'Ichabod', fact: 'Phinehas\'s wife named her son Ichabod, saying the glory had departed from Israel, because the ark was taken (1 Samuel 4:21-22).' },
    { Samuel: 1, David: 1, Saul: 1, Goliath: 1, Hannah: 3, Eli: 3, Jonathan: 3, Sling: 3 },
    ['Bathsheba; Solomon; Absalom | They come in 2 Samuel, after Saul\'s death.',
      'Ruth; Boaz | That is the book of Ruth, just before 1 Samuel.'],
    { keep: { Sling: '1 Sam 17:40', Staff: '1 Sam 17:40', Bear: '1 Sam 17:34', Bow: '1 Sam 18:4', Rock: '1 Sam 24:2' } }),
  book('job-anything', 'JOB', 'Job', 'wisdom',
    { name: 'Jemimah', fact: 'After his trials Job had three daughters, Jemimah, Keziah and Keren-happuch, the fairest women in the land (Job 42:14-15).' },
    { Job: 1, Satan: 1, Eliphaz: 3, Bildad: 3, Zophar: 3, Elihu: 3, Leviathan: 3, Behemoth: 3, Uz: 3 },
    ['Job\'s wife | She speaks in Job 2:9, but the book never gives her name.',
      'Jonah; Nineveh | That is the book of Jonah.'],
    { abstract: true, keep: { Hail: 'Job 38:22', Rock: 'Job 39:28' } }),
  book('psalms-anything', 'PSA', 'Psalms', 'worship',
    { name: 'Doeg', fact: 'Psalm 52 is titled for the time Doeg the Edomite told Saul that David had come to Ahimelech\'s house (Psalm 52:1).' },
    { David: 1, Shepherd: 1, Lion: 3, Zion: 1, Harp: 3, Jerusalem: 3 },
    ['Goliath | David\'s fight with Goliath is in 1 Samuel 17; the Psalms never name him.',
      'Selah | A word in the Psalms whose meaning is uncertain, not a person, place, or thing.'],
    { abstract: true, keep: { Rock: 'Ps 18:2', Staff: 'Ps 23:4', Rod: 'Ps 23:4', Bow: 'Ps 7:12', Cup: 'Ps 23:5' } }),
  book('proverbs-anything', 'PRO', 'Proverbs', 'wisdom',
    { name: 'Lemuel', fact: 'Proverbs 31 is the words of King Lemuel, which his mother taught him (Proverbs 31:1).' },
    { Solomon: 1, Ant: 1, Gold: 3, Silver: 3, Honey: 3, Wine: 3 },
    ['Proverbs 31 woman; wife of noble character | Proverbs 31 describes her (Proverbs 31:10) but gives her no name.',
      'Ecclesiastes; the Preacher | That is the book of Ecclesiastes.'],
    { abstract: true, extra: [{ name: 'Agur', aliases: [], refs: 'Prov 30:1', note: 'Son of Jakeh; Proverbs 30 is his.' }] }),
  book('isaiah-anything', 'ISA', 'Isaiah', 'word',
    { name: 'Shear-jashub', fact: 'Isaiah took his son Shear-jashub, whose name means a remnant will return, to meet King Ahaz (Isaiah 7:3).' },
    { Isaiah: 1, Hezekiah: 1, Immanuel: 1, Jerusalem: 1, Zion: 3, Cyrus: 3, Seraphim: 3 },
    ['Jeremiah; Ezekiel | Prophets with books of their own, after Isaiah.',
      'Suffering Servant | A later label for the servant of Isaiah 52-53; try "servant".'],
    { keep: { Rock: 'Isa 32:2' } }),
  book('jeremiah-anything', 'JER', 'Jeremiah', 'word',
    { name: 'Ebed-melech', fact: 'Ebed-melech the Ethiopian drew Jeremiah out of the cistern with ropes and rags (Jeremiah 38:7-13).' },
    { Jeremiah: 1, Baruch: 3, Zedekiah: 3, Nebuchadnezzar: 1, Jerusalem: 1, Babylon: 1, Potter: 3 },
    ['Lamentations | A book of its own after Jeremiah.',
      'Daniel; Shadrach | They come in the book of Daniel.'],
    { keep: { Rod: 'Jer 1:11' } }),
  book('ezekiel-anything', 'EZE', 'Ezekiel', 'word',
    { name: 'Jaaz-aniah', fact: 'In his vision of the temple, Ezekiel saw Jaazaniah son of Shaphan standing among seventy elders, each with a censer in his hand (Ezekiel 8:11).' },
    { Ezekiel: 1, Bones: 1, Wheel: 1, Cherubim: 3, Jerusalem: 3, Babylon: 3, Gog: 3 },
    ['Valley of dry bones | Ezekiel says the valley was full of bones (Ezekiel 37:1); try "bones" or "valley".',
      'Lions\' den | That is the book of Daniel, though Ezekiel does name Daniel (Ezekiel 14:14).']),
  book('daniel-anything', 'DAN', 'Daniel', 'courage',
    { name: 'Melzar', fact: 'The KJV names Melzar as the steward who let Daniel and his friends eat vegetables and drink water for ten days (Daniel 1:11-16).' },
    { Daniel: 1, Lion: 1, Nebuchadnezzar: 1, Shadrach: 1, Meshach: 1, Abednego: 1, Furnace: 3, Belshazzar: 3, Babylon: 3 },
    ['Esther; Mordecai | They are in the book of Esther, in Persia.',
      'Writing on the wall; handwriting | Daniel 5:5 says the fingers of a man\'s hand wrote on the wall; try "wall" or "hand".'],
    { keep: { Bear: 'Dan 7:5' }, extra: [{ name: 'Meshach', aliases: [], refs: 'Dan 1:7; 3:12', note: 'The name given to Mishael in Babylon.' }] }),
  book('matthew-anything', 'MAT', 'Matthew', 'kingdom',
    { name: 'Azor', fact: 'Azor, son of Eliakim and father of Zadok, is a link in Jesus\' genealogy after the exile (Matthew 1:13-14).' },
    { Jesus: 1, Peter: 1, Mary: 1, Herod: 3, Bethlehem: 1, Galilee: 3, Cross: 3 },
    ['Zacchaeus; Good Samaritan; Prodigal son | Only Luke tells those stories (Luke 19; 10; 15).',
      'Nicodemus | Only John tells of him.'],
    { keep: { Cross: 'Matt 27:32', Rock: 'Matt 7:24' } }),
  book('john-anything', 'JOH', 'John', 'light',
    { name: 'Salim', fact: 'John baptized at Aenon near Salim, because there was much water there (John 3:23).' },
    { Jesus: 1, Peter: 1, Lazarus: 1, Nicodemus: 3, Thomas: 3, Bethany: 3, Jerusalem: 3, Water: 3 },
    ['Zacchaeus; Good Samaritan | Only Luke tells those stories.',
      'Good shepherd | Jesus calls himself the good shepherd (John 10:11); try "shepherd".'],
    { keep: { Cross: 'John 19:17', Fish: 'John 21:9' } }),
  book('acts-anything', 'ACT', 'Acts', 'mission',
    { name: 'Rhoda', fact: 'A servant girl named Rhoda was so glad to hear Peter at the gate that she ran in without opening it (Acts 12:13-14).' },
    { Paul: 1, Peter: 1, Jerusalem: 1, Stephen: 3, Barnabas: 3, Silas: 3, Antioch: 3, Ship: 3 },
    ['Philemon; Onesimus | Paul\'s letter to Philemon names them; Acts does not.'],
    { keep: { Fire: 'Acts 2:3', Sail: 'Acts 27:40' } }),
  book('romans-anything', 'ROM', 'Romans', 'church',
    { name: 'Tertius', fact: 'Tertius, who wrote the letter down for Paul, adds his own greeting (Romans 16:22).' },
    { Paul: 1, Abraham: 1, Adam: 3, Phoebe: 3, Rome: 3, Israel: 3 },
    ['Timothy\'s mother; Lois; Eunice | They are named in 2 Timothy 1:5.',
      'Corinth; Galatia | Paul wrote other letters to those churches; Romans does not name them.'],
    { abstract: true }),
  book('hebrews-anything', 'HEB', 'Hebrews', 'faithfulness',
    { name: 'Salem', fact: 'Hebrews explains that Melchizedek was king of Salem, which means king of peace (Hebrews 7:1-2).' },
    { Jesus: 1, Moses: 1, Abraham: 1, Melchizedek: 1, Noah: 3, Rahab: 3, Tabernacle: 3 },
    ['Paul | Hebrews never names its writer.',
      'Hall of faith | A later nickname for Hebrews 11, not a phrase in the book.'],
    { abstract: true })
];

// ---------- noun prompts ------------------------------------------------------
// Cite, where it can, a verse from a passage that lists the item as a sin (or
// a virtue), so the answer's reference shows it in that sense.
function preferFrom(passages, items) {
  const keys = [];
  passages.forEach((r) => keys.push(...B.verseKeys(r)));
  const out = {};
  for (const it of items) {
    const names = it.split(';').map((x) => x.trim());
    for (const k of keys) {
      if (names.some((n) => B.versesWith(n, false).has ? B.versesWith(n, false).has(k) : [...B.versesWith(n, false)].includes(k))) {
        const [code, cv] = k.split(' ');
        out[names[0]] = B.BY_CODE.get(code)[1] + ' ' + cv;   // full book name: the short forms do not all parse back
        break;
      }
    }
  }
  return out;
}
const VICE_LISTS = ['Exod 20:13-17', 'Prov 6:16-19', 'Mark 7:21-22', 'Rom 1:29-31', 'Rom 13:13', '1 Cor 5:10-11', '1 Cor 6:9-10',
  '2 Cor 12:20-21', 'Gal 5:19-21', 'Eph 4:25-31', 'Eph 5:3-5', 'Col 3:5-9', '1 Tim 1:9-10', '1 Tim 6:4-10', '2 Tim 3:2-5',
  'Titus 3:3', 'Jas 3:14-16', '1 Pet 2:1', '1 Pet 4:3', 'Rev 21:8', 'Rev 22:15', 'Prov 16:18', 'Jude 1:16', 'Phil 2:14'];
const VIRTUE_LISTS = ['Gal 5:22-23', '2 Pet 1:5-7', 'Col 3:12-15', 'Phil 4:8', '1 Tim 6:11', '2 Tim 2:22', '2 Tim 3:10', 'Mic 6:8',
  '1 Cor 13:4-7', '1 Cor 13:13', 'Eph 4:2-3', 'Eph 4:32', 'Prov 1:2-4', 'Titus 2:2-12', 'Jas 3:17', 'Rom 5:3-5', 'Rom 12:8-21',
  '1 Pet 3:8', 'Heb 13:1-2', '1 Tim 3:2-3', '2 Cor 6:6', 'Phil 1:9'];

const NOUNS = [
  { id: 'sins', kind: 'noun', batch: BATCH, pending: PENDING, category: 'Words & Virtues', theme: 'mercy', flags: 'nouns ignore=the,a,an,of,sin,sins,being',
    prompt: 'Name a sin or vice the Bible warns against.',
    items: L.SINS, prefer: Object.assign(preferFrom(VICE_LISTS, L.SINS), {
      // Checked by hand (2026-11-19): a verse where the word is the sin.
      Revenge: 'Leviticus 19:18', Oppression: 'Psalms 62:10', Robbery: 'Psalms 62:10', Uncleanness: 'Galatians 5:19',
      Divisions: 'Romans 16:17', Rebellion: '1 Samuel 15:23', Contention: 'Proverbs 13:10', Cursing: 'Psalms 10:7',
      'Hardness of heart': 'Mark 16:14', Gluttony: 'Proverbs 23:21', Lying: 'Proverbs 6:17', Theft: 'Mark 7:21' }),
    tiers: { Adultery: 1, Murder: 1, Pride: 1, 'Lying': 1, Theft: 1, Envy: 3, Greed: 3, Idolatry: 3, Lust: 3, Anger: 3, Jealousy: 3 },
    sheep: { name: 'Menstealers', fact: 'Paul\'s list of the lawless includes kidnappers, "menstealers" in the KJV (1 Timothy 1:10).' },
    nearMisses: ['Sin; iniquity; transgression; wickedness; evil | That is the word for sin itself; name a particular one.',
      'Seven deadly sins | The "seven deadly sins" are a later list, not a passage of Scripture; Proverbs 6:16-19 lists seven things the LORD hates.'] },
  { id: 'virtues', kind: 'noun', batch: BATCH, pending: PENDING, category: 'Words & Virtues', theme: 'light', flags: 'nouns ignore=the,a,an,of,being',
    prompt: 'Name a virtue or good quality the Bible commends.',
    items: L.VIRTUES, prefer: Object.assign(preferFrom(VIRTUE_LISTS, L.VIRTUES), {
      // Checked by hand (2026-11-19): a verse where the word is commended.
      Trust: 'Proverbs 3:5', Patience: 'Galatians 5:22', Thankfulness: 'Colossians 3:15', Faithfulness: '1 Samuel 26:23',
      Repentance: 'Matthew 3:8', Zeal: '2 Corinthians 7:11', Obedience: 'Romans 6:16', Submission: '1 Timothy 2:11',
      Modesty: '1 Timothy 2:9', Contentment: '1 Timothy 6:6', Simplicity: '2 Corinthians 11:3' }),
    tiers: { Love: 1, Faith: 1, Hope: 1, Joy: 1, Peace: 1, Patience: 3, Kindness: 3, Humility: 3, Mercy: 3 },
    sheep: { name: 'Simplicity', fact: 'Paul feared the Corinthians would be led away from the simplicity that is in Christ (2 Corinthians 11:3, KJV).' },
    nearMisses: ['Optimism; self-esteem; tolerance | Not a word the WEB or KJV uses for a virtue.',
      'Cardinal virtues; prudence, justice, fortitude, temperance | That list comes from Greek philosophy, but several of the words are in Scripture; name one.'] },
  { id: 'structures', kind: 'noun', batch: BATCH, pending: PENDING, category: 'Objects & Treasures', theme: 'kingdom', flags: 'nouns ignore=the,a,an,of',
    prompt: 'Name a kind of building or structure mentioned in the Bible.',
    items: L.STRUCTURES.filter((x) => !/^(Pit|Hold|Ark|Pool|Dwelling)/.test(x)),
    prefer: { Tower: 'Gen 11:4', Temple: '1 Kgs 6:1', Tabernacle: 'Exod 26:1', Synagogue: 'Luke 4:16', Manger: 'Luke 2:7', 'Upper room': 'Acts 1:13',
      Inn: 'Luke 2:7', Prison: 'Gen 39:20', Tomb: 'Matt 27:60', Theater: 'Acts 19:29' },
    tiers: { Temple: 1, Tower: 1, Tabernacle: 1, House: 1, Wall: 1, Altar: 3, Palace: 3, Tent: 3, Synagogue: 3, Manger: 3, Prison: 3, Tomb: 3 },
    sheep: { name: 'Draught house', fact: 'Jehu\'s men broke down the house of Baal and made it a draught house, a latrine, "to this day" (2 Kings 10:27, KJV).' },
    nearMisses: ['Church building; cathedral | The New Testament church met in homes (Romans 16:5); try "house" or "synagogue".',
      'Pyramid; ziggurat | The Bible never names them; try the tower of Babel\'s "tower".'] },
  { id: 'land-and-sky', kind: 'noun', batch: BATCH, pending: PENDING, category: 'Creation', theme: 'deep', flags: 'nouns ignore=the,a,an,of',
    prompt: 'Name a feature of the land, sea or sky, or a kind of weather, mentioned in the Bible.',
    items: L.NATURE.filter((x) => !/^(Pit|Cleft|Shadow|Heat|Cold|Valley of salt|Peak|Morning$|Evening|Twilight|Midnight|Noon)/.test(x)),
    prefer: { Rainbow: 'Gen 9:13', Flood: 'Gen 7:17', Whirlwind: '2 Kgs 2:11', Earthquake: 'Matt 28:2', Hail: 'Exod 9:23', Pleiades: 'Job 38:31',
      Orion: 'Job 38:31', Arcturus: 'Job 38:32', 'Morning star': 'Rev 22:16', Sea: 'Exod 14:21', Storm: 'Mark 4:37', Snow: 'Isa 1:18', Dew: 'Judg 6:37' },
    tiers: { Sun: 1, Moon: 1, Star: 1, Rain: 1, Sea: 1, Mountain: 1, River: 3, Cloud: 3, Flood: 3, Rainbow: 3, Wind: 3, Wilderness: 3 },
    sheep: { name: 'Arcturus', fact: 'God asks Job whether he can guide Arcturus with its sons (Job 38:32, KJV; the WEB says the Bear).' },
    nearMisses: ['Ocean | The Bible says "sea" and "the deep"; try one of those.',
      'Volcano; tornado; comet | Not named in the Bible; try "whirlwind" or "earthquake".'] }
];

module.exports = BOOKS.concat(NOUNS);
