/* Fishers: new prompts, batch 2 (waiting for review; see PROGRESS.md).
 *
 * Everything here is written to content/pending/batch-2/ by tools/derive.js
 * and stays out of the game until approved. To approve, set PENDING below to
 * null (the prompts then go to content/generated/), move the families in
 * tools/families.js from PENDING into FAMILIES, append the IDs to
 * content/prompt-ids.list, and rebuild.
 *
 * Batch 2 adds new families, because a family airs at most once a day and the
 * book-scoped family already has 17 prompts:
 *  - 9 story prompts ("a person, place, or thing in the story of Joseph"),
 *    built like the book prompts but scoped to chapters;
 *  - 4 people and 4 places by first letter;
 *  - 3 word prompts (family words, feelings, times and seasons).
 */
'use strict';
const L = require('../lib/things.js');

// Approved 2026-11-19: the prompts are live (content/generated/).
const BATCH = 'batch-2', PENDING = null;

// ---------- stories ---------------------------------------------------------
const THINGS = L.things(false), ABSTRACT = L.things(true);
// As in batch 1: words that are also common verbs or adjectives stay out of
// a scoped prompt unless `keep` gives a verse where the word is the thing.
const AMBIGUOUS = new Set(['saw', 'bow', 'lead', 'well', 'bear', 'fly', 'spring', 'palm', 'date', 'dates', 'kid', 'row', 'rush', 'mint',
  'rue', 'cane', 'ash', 'box', 'pine', 'hind', 'seal', 'press', 'rose', 'hail', 'wave', 'waves', 'cross', 'saddle', 'plow', 'plough',
  'couch', 'bridle', 'quiver', 'sail', 'pound', 'swallow', 'ford', 'peak', 'slope', 'light', 'sling', 'plane', 'bay', 'cock', 'hart',
  'cast', 'fan', 'lot', 'mark', 'post', 'fold', 'hold', 'top', 'deep', 'plain', 'way']);
function storyThings(keep, abstract) {
  const kept = new Set(Object.keys(keep || {}).map((k) => k.toLowerCase()));
  return (abstract ? ABSTRACT : THINGS).map((it) => {
    const parts = it.split(';').map((x) => x.trim()).filter((x) => kept.has(x.toLowerCase()) || !AMBIGUOUS.has(x.toLowerCase()));
    return parts.join('; ');
  }).filter(Boolean);
}
const GOD = 'God; the LORD; Lord; Yahweh; Jehovah | God is not one of the answers in this net; name someone or something he made, called or spoke to.';
function story(id, scope, prompt, theme, sheep, tiers, nearMisses, extra) {
  const keep = (extra && extra.keep) || {};
  return Object.assign({
    id, kind: 'book', batch: BATCH, pending: PENDING, category: 'Bible Stories', theme, books: scope,
    flags: 'nouns within=' + scope.join(',') + ' ignore=the,a,an,of,in,mount',
    prompt, items: storyThings(keep, extra && extra.abstract), prefer: keep, sheep, tiers,
    nearMisses: nearMisses.concat([GOD]),
    exclude: ['North', 'South', 'East', 'West']
  }, extra || {});
}

const STORIES = [
  story('creation-to-flood', ['GEN:1-9'], 'Name a person, place, or thing in the Bible\'s first chapters, from the Creation to the Flood (Genesis 1–9).', 'deep',
    null, { Adam: 1, Eve: 1, Noah: 1, Eden: 1, Ark: 1, Serpent: 1, Cain: 3, Abel: 3, Rainbow: 3, Dove: 3, Flood: 3 }, []),
  story('abraham-story', ['GEN:12-25'], 'Name a person, place, or thing in the story of Abraham (Genesis 12–25).', 'faithfulness',
    null, { Abraham: 1, Sarah: 1, Isaac: 1, Lot: 1, Ishmael: 3, Hagar: 3, Sodom: 3, Canaan: 3, Ram: 3 }, []),
  story('jacob-story', ['GEN:25-36'], 'Name a person, place, or thing in the story of Jacob and Esau (Genesis 25–36).', 'faithfulness',
    null, { Jacob: 1, Esau: 1, Isaac: 1, Rebekah: 1, Rachel: 3, Leah: 3, Laban: 3, Ladder: 3, Bethel: 3 }, []),
  story('joseph-story', ['GEN:37-50'], 'Name a person, place, or thing in the story of Joseph (Genesis 37–50).', 'remembrance',
    null, { Joseph: 1, Jacob: 1, Egypt: 1, Pharaoh: 1, Benjamin: 3, Reuben: 3, Judah: 3, Potiphar: 3, Coat: 3, Cup: 3 }, []),
  story('david-solomon', ['2SA', '1KI:1-11'], 'Name a person, place, or thing in the reigns of David and Solomon (2 Samuel to 1 Kings 11).', 'kingdom',
    null, { David: 1, Solomon: 1, Bathsheba: 1, Jerusalem: 1, Absalom: 3, Nathan: 3, Joab: 3, Temple: 3 }, []),
  story('elijah-elisha', ['1KI:17-22', '2KI:1-13'], 'Name a person, place, or thing in the stories of Elijah and Elisha (1 Kings 17 to 2 Kings 13).', 'courage',
    null, { Elijah: 1, Elisha: 1, Ahab: 1, Jezebel: 1, Baal: 3, Carmel: 3, Naaman: 3, Chariot: 3, Jordan: 3 }, []),
  story('christmas-story', ['MAT:1-2', 'LUK:1-2'], 'Name a person, place, or thing in the Christmas story (Matthew 1–2 and Luke 1–2).', 'light',
    null, { Jesus: 1, Mary: 1, Joseph: 1, Bethlehem: 1, Manger: 1, Herod: 3, Shepherd: 3, Angel: 3, Gold: 3, Frankincense: 3, Myrrh: 3, Star: 3 }, []),
  story('sermon-on-the-mount', ['MAT:5-7'], 'Name a person, place, or thing Jesus speaks of in the Sermon on the Mount (Matthew 5–7).', 'wisdom',
    null, { Salt: 1, Lamp: 1, Rock: 1, Sand: 1, Lilies: 3, Birds: 3, Treasure: 3, Moth: 3, Pearls: 3 }, [], { abstract: true }),
  story('passion-week', ['LUK:19-24'], 'Name a person, place, or thing in Luke\'s account of Jesus\' last week, from Palm Sunday to the empty tomb (Luke 19–24).', 'remembrance',
    null, { Jesus: 1, Peter: 1, Judas: 1, Pilate: 1, Jerusalem: 1, Herod: 3, Colt: 3, Cross: 3, Tomb: 3, Emmaus: 3 }, [])
];

// ---------- by first letter -------------------------------------------------
function person(letter, theme, tiers) {
  return { id: 'people-' + letter.toLowerCase(), kind: 'person', batch: BATCH, pending: PENDING, initial: letter, category: 'People', theme,
    prompt: 'Name a person in the Bible whose name begins with ' + letter + '.', tiers, sheep: null,
    nearMisses: [] };
}
function place(letter, theme, tiers) {
  return { id: 'places-' + letter.toLowerCase(), kind: 'place', batch: BATCH, pending: PENDING, initial: letter, category: 'Places', theme,
    flags: 'nouns ignore=mount,mt,mountain,mountains,hill,river,brook,sea,lake,valley,land,city,island,pool,spring,well',
    prompt: 'Name a place in the Bible whose name begins with ' + letter + '.', tiers, sheep: null,
    extra: letter === 'I' ? [{ name: 'Israel', aliases: [], refs: 'Matt 2:20-21; 1 Sam 13:19', note: 'The land God promised to the descendants of Abraham.' }] : [],
    nearMisses: [] };
}

const LETTERS = [
  person('A', 'faithfulness', { Abraham: 1, Adam: 1, Aaron: 1, Abel: 3, Absalom: 3, Andrew: 3, Ahab: 3 }),
  person('J', 'calling', { Jesus: 1, John: 1, Joseph: 1, Jacob: 1, James: 3, Joshua: 3, Jonah: 3, Judas: 3, Job: 3 }),
  person('M', 'calling', { Moses: 1, Mary: 1, Matthew: 1, Mark: 3, Martha: 3, Miriam: 3, Methuselah: 3 }),
  person('S', 'kingdom', { Samuel: 1, Saul: 1, Solomon: 1, Sarah: 1, Simon: 3, Samson: 3, Stephen: 3, Silas: 3 }),
  place('B', 'mission', { Bethlehem: 1, Babylon: 1, Bethany: 3, Bethel: 3, Beersheba: 3 }),
  place('C', 'mission', { Canaan: 1, Capernaum: 1, Corinth: 3, Cana: 3, Calvary: 3, Carmel: 3 }),
  place('A', 'mission', { Assyria: 1, Antioch: 1, Athens: 1, Ai: 3, Ararat: 3, Arabia: 3, Armageddon: 3 }),
  place('S', 'mission', { 'Mount Sinai': 1, Samaria: 1, Sodom: 3, Shiloh: 3, Sidon: 3 })
];

// ---------- words -----------------------------------------------------------
const FAMILY = ['Father; Fathers', 'Mother; Mothers', 'Son; Sons', 'Daughter; Daughters', 'Brother; Brothers; Brethren', 'Sister; Sisters',
  'Husband', 'Wife; Wives', 'Child; Children', 'Grandmother', 'Grandchildren; Grandchild', 'Uncle', 'Aunt', 'Cousin', 'Nephew; Nephews',
  'Father-in-law', 'Mother-in-law', 'Son-in-law; Sons-in-law', 'Daughter-in-law; Daughters-in-law', 'Sister-in-law', 'Brother-in-law',
  'Twins', 'Firstborn', 'Heir; Heirs', 'Kinsman; Kinsmen; Near kinsman', 'Widow; Widows', 'Fatherless', 'Orphan; Orphans',
  'Bride', 'Bridegroom', 'Concubine', 'Household', 'Family; Families', 'Clan', 'Tribe', 'Forefathers', 'Ancestors', 'Descendants',
  'Offspring', 'Only son', 'Adoption', 'Grandfather', 'Stepmother', 'Kinswoman',
  'Parents', 'Relative; Relatives', 'Kindred', 'Kinsfolk', 'Posterity', 'Patriarch; Patriarchs', 'Elder brother', 'Younger brother',
  'Eldest son', 'Youngest son', 'Grandson; Grandsons', 'Granddaughter', "Mother's brother", "Father's brother",
  "Brother's wife", "Husband's brother", "Wife's sister", "Father's sister", 'Only child', 'Firstborn son',
  "Children's children", "Sons' sons", 'Spouse', 'Betrothed', 'Birthright', 'Half-brother', 'Stepson', 'Matriarch', 'Foster'];
const FEELINGS = ['Joy', 'Gladness', 'Sorrow', 'Grief', 'Fear', 'Anger', 'Wrath', 'Love', 'Hatred', 'Jealousy', 'Envy', 'Shame', 'Pride',
  'Guilt', 'Anguish', 'Distress', 'Despair', 'Delight', 'Pity', 'Compassion', 'Bitterness', 'Anxiety', 'Courage', 'Hope', 'Peace',
  'Contentment', 'Terror', 'Dread', 'Amazement', 'Astonishment', 'Wonder', 'Boldness', 'Longing', 'Desire', 'Sadness', 'Happiness',
  'Mourning', 'Indignation', 'Zeal', 'Loneliness', 'Worry', 'Gratitude', 'Thankfulness', 'Disgust', 'Rage', 'Panic',
  'Trembling', 'Heaviness', 'Rejoicing', 'Weariness', 'Discouragement', 'Embarrassment',
  'Laughter', 'Affection', 'Fury', 'Resentment', 'Malice', 'Grudge', 'Scorn', 'Contempt', 'Lust', 'Pleasure', 'Confidence', 'Doubt',
  'Perplexity', 'Horror', 'Agony', 'Misery', 'Sighing', 'Yearning', 'Gloom', 'Melancholy', 'Cheer', 'Exultation', 'Hostility',
  'Regret', 'Remorse', 'Humiliation', 'Fearfulness', 'Bitterness of soul', 'Broken heart; Brokenhearted', 'Vexation'];
const TIMES = ['Day', 'Night', 'Morning', 'Evening', 'Noon', 'Midnight', 'Dawn', 'Twilight', 'Hour', 'Week', 'Month', 'Year', 'Sabbath',
  'Season', 'Generation', 'Age', 'Moment', 'Instant', 'Eternity', 'Forever', 'Today', 'Tomorrow', 'Yesterday', 'Winter', 'Summer',
  'Harvest', 'Seedtime', 'New moon', 'Jubilee', 'Daybreak', 'Sunrise', 'Sunset', 'Cockcrowing', 'Third hour', 'Sixth hour', 'Ninth hour',
  'Last days', 'Day of the Lord', 'End of the age', 'Lifetime', 'Decade', 'Century', 'Fortnight', 'Weekday', 'Daytime', 'Nighttime',
  'Watch of the night; Night watches', 'Fourth watch', 'Cool of the day', 'Seven days', 'Forty days', 'Thousand years',
  'Dusk', 'First day of the week', "Lord's day", 'Day of Preparation; Preparation day', 'Day of Atonement', 'Autumn', 'Former rain',
  'Latter rain', 'Vintage', 'Seventh day', 'Eighth day', 'Seventh year', 'Fullness of time', 'Old age', 'Youth', 'Days of old',
  'Morning watch', 'Second watch', 'Third watch', 'Middle watch', 'Eleventh hour', 'Day of judgment', 'Last day', 'Times and seasons',
  'Evermore', 'Everlasting', 'Three days', 'Daylight', 'Nightfall', 'Hour of prayer', 'Time of harvest', 'Early morning'];

const WORDS = [
  { id: 'family-words', kind: 'noun', batch: BATCH, pending: PENDING, category: 'Family & Home', theme: 'faithfulness', flags: 'nouns ignore=the,a,an,of,my,his,her',
    prompt: 'Name a family relationship the Bible mentions (like brother or mother-in-law).',
    items: FAMILY, prefer: { Betrothed: 'Deut 22:23' }, tiers: { Father: 1, Mother: 1, Son: 1, Daughter: 1, Brother: 1, Sister: 1, Husband: 1, Wife: 1 }, sheep: null, nearMisses: [] },
  { id: 'feelings', kind: 'noun', batch: BATCH, pending: PENDING, category: 'Words & Virtues', theme: 'mercy', flags: 'nouns ignore=the,a,an,of',
    prompt: 'Name a feeling or emotion the Bible mentions.',
    items: FEELINGS, prefer: { Wonder: 'Acts 3:10', Boldness: 'Acts 4:13', Cheer: 'Matt 9:2', Agony: 'Luke 22:44', Doubt: 'Matt 14:31' }, tiers: { Joy: 1, Love: 1, Fear: 1, Anger: 1, Sorrow: 1, Peace: 3, Grief: 3, Hope: 3, Jealousy: 3, Shame: 3 }, sheep: null, nearMisses: [] },
  { id: 'times-seasons', kind: 'noun', batch: BATCH, pending: PENDING, category: 'Days & Seasons', theme: 'remembrance', flags: 'nouns ignore=the,a,an,of',
    prompt: 'Name a time of day, a season, or a span of time the Bible mentions (like dawn or a year).',
    items: TIMES, prefer: { Age: 'Matt 12:32', Sunrise: 'Ps 50:1', "Lord's day": 'Rev 1:10', 'Last day': 'John 6:39' }, tiers: { Day: 1, Night: 1, Morning: 1, Evening: 1, Year: 1, Sabbath: 3, Hour: 3, Month: 3, Week: 3, Summer: 3, Winter: 3 }, sheep: null, nearMisses: [] }
];

// ---------- Lost Sheep, more tiers, near misses ------------------------------
// The Lost Sheep is one rare answer with a fact worth learning (checked by
// hand against the WEB and KJV, 2026-11-19).
const SHEEP = {
  'creation-to-flood': ['Gopher wood', 'God told Noah to build the ark of gopher wood (Genesis 6:14); no one now knows for certain what wood that was.'],
  'abraham-story': ['Beer-lahai-roi', 'After the angel found her in the wilderness, Hagar called the LORD "a God who sees," and the well was named Beer-lahai-roi (Genesis 16:13-14).'],
  'jacob-story': ['Penuel', 'After wrestling until daybreak, Jacob named the place Peniel, "for I have seen God face to face," and left it limping (Genesis 32:30-31).'],
  'joseph-story': ['Asenath', 'Pharaoh gave Joseph Asenath, daughter of Potiphera priest of On, as his wife; she bore Manasseh and Ephraim (Genesis 41:45, 50-52).'],
  'david-solomon': ['Rizpah', 'Rizpah spread sackcloth on a rock and kept the birds and beasts from her sons\' bodies from the beginning of harvest until the rain came (2 Samuel 21:10).'],
  'elijah-elisha': ['Zarephath', 'Elijah stayed with a widow of Zarephath whose jar of flour and jug of oil did not run out (1 Kings 17:9-16).'],
  'christmas-story': ['Anna', 'Anna, a prophetess of the tribe of Asher who never left the temple, gave thanks when she saw the infant Jesus (Luke 2:36-38).'],
  'sermon-on-the-mount': ['Bushel', 'No one lights a lamp to put it under a bushel (Matthew 5:15, KJV; the WEB says a measuring basket).'],
  'passion-week': ['Joanna', 'Joanna was among the women who told the apostles the tomb was empty (Luke 24:10).'],
  'people-a': ['Agabus', 'The prophet Agabus bound his own hands and feet with Paul\'s belt to show what awaited Paul in Jerusalem (Acts 21:10-11).'],
  'people-j': ['Jabez', 'Jabez was more honorable than his brothers, and God granted his prayer to enlarge his border (1 Chronicles 4:9-10).'],
  'people-m': ['Mahlon', 'Mahlon, a son of Naomi, was Ruth\'s first husband; he died in Moab (Ruth 1:2-5; 4:10).'],
  'people-s': ['Shamgar', 'Shamgar son of Anath struck down six hundred Philistines with an ox goad (Judges 3:31).'],
  'places-b': ['Bochim', 'When the angel of the LORD rebuked Israel, the people wept aloud and named the place Bochim, "weepers" (Judges 2:1-5).'],
  'places-c': ['Cenchreae', 'Paul cut his hair at Cenchreae because of a vow (Acts 18:18), and Phoebe served the church there (Romans 16:1).'],
  'places-a': ['Abel-meholah', 'Elisha son of Shaphat came from Abel-meholah; Elijah was told to anoint him prophet in his place (1 Kings 19:16).'],
  'places-s': ['Shunem', 'A woman of Shunem made Elisha a little room on her roof (2 Kings 4:8-10).'],
  'family-words': ['Sister-in-law', 'Naomi told Ruth, "Your sister-in-law has gone back to her people" (Ruth 1:15).'],
  'feelings': ['Heaviness', 'Isaiah promises "the garment of praise for the spirit of heaviness" (Isaiah 61:3, KJV).'],
  'times-seasons': ['Cockcrowing', 'Watch, Jesus said, for the master may come at evening, at midnight, at the cockcrowing, or in the morning (Mark 13:35, KJV).']
};
// The ranking counts verses, so common words ("hand", "house") and
// namesakes rise above the answers a player reaches for first.
const MORE_TIERS = {
  'creation-to-flood': { Water: 4, Lamech: 3, Enoch: 3, Fruit: 1, 'Tree of life': 3 },
  'abraham-story': { Servant: 4, House: 4, Water: 4, Hand: 4, Eye: 5, Field: 5, Abimelech: 3, Hagar: 1, Ishmael: 1 },
  'jacob-story': { Servant: 4, Hamor: 4, Shechem: 3, Edom: 3, Rachel: 1, Laban: 1 },
  'joseph-story': { Hand: 4, Servant: 4, House: 4, Goshen: 3, Manasseh: 3, Benjamin: 1, 'Coat of many colours': 3 },
  'david-solomon': { House: 4, Servant: 4, Abner: 3, Goliath: 3 },
  'elijah-elisha': { King: 4, House: 4, Servant: 4, Hand: 4, Syria: 3, Judah: 3, Joram: 3, 'Ben-hadad': 3, Jehoshaphat: 3, Jehu: 3, Naaman: 1, Raven: 3, Mantle: 3 },
  'christmas-story': { 'Wise men': 1, Inn: 3, Gabriel: 3, Judea: 3 },
  'sermon-on-the-mount': { Eye: 3, House: 3 },
  'passion-week': { Chief: 4, Hand: 4, Galilee: 3, Calvary: 3, Barabbas: 3, Juda: 5 },
  'people-a': { Abel: 1, Abimelech: 3, Asa: 3, Azariah: 4, Abner: 3, Absalom: 3, Andrew: 3 },
  'people-j': { Joshua: 1, Judah: 3, Jeremiah: 3 },
  'people-m': { Moab: 4, Midian: 4, Manasseh: 3, Mordecai: 3, Mark: 3 },
  'people-s': { Shechem: 4, Simon: 1, Samson: 3 },
  'places-b': { 'Baalath-beer': 5, 'Beautiful Gate': 4, Bashan: 3, Beer: 4, Bela: 4, Bilhah: 5, Bethuel: 5, 'Beyond the River': 5, Bethel: 1, Bethany: 1, Bethsaida: 3, Beersheba: 3 },
  'places-c': { Chaldea: 4, 'City of David': 4, Cherub: 5, Cain: 5, Calvary: 1, Corinth: 3, Cana: 3, Carmel: 3, Caesarea: 3, Cyprus: 3 },
  'places-a': { Adam: 5, Arabah: 4, Amalek: 3, Addar: 5, 'Abel-beth-maacah': 4 },
  'places-s': { 'Mount Sinai': 1, Sin: 4, Sela: 4, Sheba: 3, Sina: 5, Straight: 5, Sodom: 1, 'Sea of Galilee': 1, Shiloh: 3, Sidon: 3 }
};
const NEAR = {
  'creation-to-flood': ['Apple | Genesis never names the fruit; it is "the fruit of the tree" (Genesis 3:3); try "fruit".',
    'Satan; Devil; Lucifer | Genesis 3 calls him the serpent; try "serpent".'],
  'christmas-story': ['Three kings; Caspar; Melchior; Balthasar | Matthew calls them wise men and gives no names or number (Matthew 2:1); try "wise men".',
    'Donkey | The Christmas accounts mention no donkey.', 'Innkeeper | Luke mentions no innkeeper, only that there was no room in the inn (Luke 2:7); try "inn".'],
  'passion-week': ['Gethsemane | Luke says the Mount of Olives (Luke 22:39); only Matthew and Mark name Gethsemane.',
    'Palm branches; palms | Luke mentions no palms; people spread their cloaks on the road (Luke 19:36).'],
  'sermon-on-the-mount': ['Lord\'s Prayer | That is the prayer in Matthew 6:9-13; name something in it, like bread.'],
  'joseph-story': ['Dreamcoat; technicolor coat | Genesis calls it a coat of many colours (Genesis 37:3, KJV); try "coat".'],
  'people-j': ['Jehovah; God | God is not one of the answers in this net; name a person.'],
  'people-m': ['Magi | The WEB and KJV say wise men (Matthew 2:1), not a name.']
};
const FORMS = { 'jacob-story': { Ladder: ['Jacob\'s ladder', 'Stairway'] } };
const EXTRA = {
  'creation-to-flood': [
    { name: 'Fruit', aliases: [], refs: 'Gen 3:2-3', note: 'The fruit of the tree in the middle of the garden.' },
    { name: 'Tree of life', aliases: [], refs: 'Gen 2:9; 3:22', note: 'In the middle of the garden (Genesis 2:9).' },
    { name: 'Tree of the knowledge of good and evil', aliases: ['Tree of knowledge'], refs: 'Gen 2:9, 17', note: 'The one tree Adam was told not to eat from (Genesis 2:17).' },
    { name: 'Fig leaves', aliases: ['Fig leaf'], refs: 'Gen 3:7', note: 'Sewn together by Adam and Eve to cover themselves.' }]
};

// From typing the first answers a player would try (2026-11-19): words the
// ambiguity list drops, phrases the lists lack, and spellings to accept.
const KEEP = {
  'creation-to-flood': { Light: 'Gen 1:3' },
  'abraham-story': { Well: 'Gen 21:19' },
  'elijah-elisha': { Bear: '2 Kgs 2:24' },
  'sermon-on-the-mount': { Light: 'Matt 5:14' },
  'passion-week': { Cross: 'Luke 23:26' }
};
const MORE_EXTRA = {
  'creation-to-flood': [{ name: 'Light', aliases: [], refs: 'Gen 1:3', note: 'The first thing God said: "Let there be light."' }],
  'abraham-story': [{ name: 'Pillar of salt', aliases: [], refs: 'Gen 19:26', note: 'What Lot\'s wife became when she looked back.' }],
  'jacob-story': [{ name: 'Birthright', aliases: [], refs: 'Gen 25:31', note: 'Esau sold it to Jacob for bread and lentil stew.' }],
  'joseph-story': [
    { name: 'Dream', aliases: [], refs: 'Gen 37:5', note: 'Joseph\'s dreams of sheaves and stars, and Pharaoh\'s of cattle and grain.', forms: ['Dreams'] },
    { name: 'Famine', aliases: [], refs: 'Gen 41:27', note: 'Seven years of famine after seven of plenty.' },
    { name: 'Pit', aliases: [], refs: 'Gen 37:24', note: 'The empty pit his brothers threw Joseph into.', forms: ['Cistern'] }],
  'sermon-on-the-mount': [
    { name: 'Light', aliases: [], refs: 'Matt 5:14-16', note: 'You are the light of the world.' },
    { name: 'Birds', aliases: ['Fowls'], refs: 'Matt 6:26', note: 'They do not sow or reap, yet the Father feeds them.', forms: ['Bird'] },
    { name: 'Treasure', aliases: ['Treasures'], refs: 'Matt 6:19-21', note: 'Lay up treasures in heaven.' },
    { name: 'Rust', aliases: [], refs: 'Matt 6:19', note: 'Moth and rust destroy treasures on earth.' },
    { name: 'Wolves', aliases: [], refs: 'Matt 7:15', note: 'False prophets in sheep\'s clothing.', forms: ['Wolf'] },
    { name: 'Speck', aliases: ['Mote'], refs: 'Matt 7:3', note: 'The speck in your brother\'s eye (the mote, in the KJV).' },
    { name: 'City', aliases: [], refs: 'Matt 5:14', note: 'A city on a hill cannot be hidden.', forms: ['City on a hill', 'City on a hill', 'City set on a hill'] },
    { name: 'Narrow gate', aliases: ['Strait gate'], refs: 'Matt 7:13', note: 'Enter by the narrow gate.' },
    { name: 'Thieves', aliases: [], refs: 'Matt 6:19', note: 'They break in and steal treasures on earth.', forms: ['Thief'] }],
  'passion-week': [{ name: 'Simon of Cyrene', aliases: [], refs: 'Luke 23:26', note: 'Made to carry the cross after Jesus.' }]
};
const ADD_FORMS = {
  'elijah-elisha': { Chariot: ['Chariot of fire', 'Chariots of fire', 'Fiery chariot'], Axe: ['Axe head', 'Ax head', 'Axhead'], Shunem: ['Shunammite', 'Shunammite woman'] },
  'david-solomon': { Sheba: ['Queen of Sheba'] },
  'jacob-story': { Jacob: ['Israel'] },
  'joseph-story': { Cattle: ['Cows', 'Kine'] },
  'passion-week': { Joseph: ['Joseph of Arimathea', 'Joseph of Arimathaea'] },
  'family-words': { Bridegroom: ['Groom'] }
};
const MORE_NEAR = {
  'creation-to-flood': ['Sun | Genesis 1 calls it the greater light (Genesis 1:16); try "light".'],
  'abraham-story': ['Lot\'s wife | Genesis never names her; she became a pillar of salt (Genesis 19:26).'],
  'sermon-on-the-mount': ['Log; plank | The WEB and KJV say beam (Matthew 7:3); try "beam".'],
  'christmas-story': ['Sheep | Luke says the shepherds kept watch over their flock (Luke 2:8); try "shepherds".'],
  'passion-week': ['Donkey | Luke says a colt (Luke 19:30); try "colt".',
    'Thirty pieces of silver | Only Matthew gives the sum (Matthew 26:15); Luke says money (Luke 22:5).'],
  'family-words': ['Grandfather; stepmother; stepfather; in-laws | Not a word the WEB or KJV uses; try "grandmother", "father-in-law" or "mother-in-law".'],
  'feelings': ['Happiness; loneliness; gratitude | Not a word the WEB or KJV uses; try "gladness", "joy" or "thankfulness".'],
  'times-seasons': ['Spring; fall | The Bible speaks of seedtime and harvest, summer and winter (Genesis 8:22); try one of those.',
    'Dusk | Not a word the WEB or KJV uses; try "twilight" or "evening".']
};

const ALL = STORIES.concat(LETTERS, WORDS);
for (const cfg of ALL) {
  const sh = SHEEP[cfg.id];
  if (sh) cfg.sheep = { name: sh[0], fact: sh[1] };
  Object.assign(cfg.tiers, MORE_TIERS[cfg.id] || {});
  cfg.nearMisses = (NEAR[cfg.id] || []).concat(cfg.nearMisses);
  if (FORMS[cfg.id]) cfg.forms = Object.assign({}, cfg.forms || {}, FORMS[cfg.id]);
  if (EXTRA[cfg.id]) cfg.extra = (cfg.extra || []).concat(EXTRA[cfg.id]);
  if (KEEP[cfg.id]) { cfg.prefer = Object.assign({}, cfg.prefer, KEEP[cfg.id]); cfg.items = storyThings(cfg.prefer, cfg.abstract); }
  if (MORE_EXTRA[cfg.id]) cfg.extra = (cfg.extra || []).concat(MORE_EXTRA[cfg.id]);
  if (ADD_FORMS[cfg.id]) cfg.addForms = ADD_FORMS[cfg.id];
  if (MORE_NEAR[cfg.id]) cfg.nearMisses = MORE_NEAR[cfg.id].concat(cfg.nearMisses);
  if (cfg.initial) cfg.exclude = (cfg.exclude || []).concat(['North', 'South', 'East', 'West', 'Mede', 'Medes']);
}

module.exports = ALL;
