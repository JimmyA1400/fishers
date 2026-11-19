/* Fishers: the list of "things" for book-scoped prompts ("Name a person,
 * place, or thing named in the book of Exodus"), and the new noun lists in
 * tools/batches/. Every item is "Name; other spelling; ...". tools/derive.js
 * keeps only the items whose words appear in the prompt's books in the WEB or
 * KJV, and cites those verses.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// Kinds of building or structure.
const STRUCTURES = ['House', 'Tower; Watchtower', 'Wall', 'Gate', 'Temple', 'Tabernacle', 'Palace', 'Tent', 'Altar', 'Synagogue',
  'Prison; Dungeon', 'Barn', 'Storehouse; Treasure house; Store city', 'Treasury', 'Winepress', 'Cistern', 'Tomb; Sepulchre; Sepulcher',
  'Fortress; Stronghold; Fort', 'Citadel; Castle', 'Inn; Lodging place', 'Booth; Shelter', 'Court; Courtyard', 'Porch; Portico',
  'Roof; Housetop', 'Upper room', 'Chamber', 'Window', 'Stairs; Staircase; Steps', 'Pillar', 'Foundation', 'Cornerstone; Corner stone',
  'Highway', 'Street', 'Marketplace; Market', 'Theater; Theatre', 'Sheepfold; Fold', 'Stall', 'Manger', 'Hut; Cottage; Lodge',
  'Shrine', 'High place', 'Conduit; Aqueduct', 'Rampart; Bulwark', 'Battlement; Parapet', 'Threshing floor', 'Hall', 'Judgment hall; Praetorium',
  'School', 'Banqueting house; Banquet hall', 'Bedchamber; Bedroom', 'Draught house', 'Armory; Armoury', 'Threshold', 'Doorpost; Post',
  'Lintel', 'Beam', 'Rafter', 'Brick', 'Pavement', 'Ivory house; Ivory palace', 'Summer house', 'Winter house', 'Brickkiln; Brick kiln',
  'Pool', 'Fence; Hedge', 'Lattice', 'Ark', 'Furnace', 'Oven', 'Kiln', 'Vineyard tower', 'Garner; Granary', 'Ditch; Trench',
  'Siege works; Siegeworks; Mound', 'City of refuge', 'Fortified city; Fenced city', 'Hold', 'Pit', 'Dwelling; Habitation'];

// Features of land, sea and sky, and kinds of weather.
const NATURE = ['Sun', 'Moon', 'Star; Stars', 'Cloud; Clouds', 'Rain', 'Snow', 'Hail; Hailstones', 'Wind', 'Lightning', 'Thunder',
  'Rainbow', 'Dew', 'Frost', 'Ice', 'Whirlwind', 'Storm; Tempest', 'Earthquake', 'Flood', 'Drought', 'Fire', 'Smoke', 'Darkness',
  'Dawn; Daybreak', 'Morning star; Day star', 'Mist; Vapor; Vapour', 'Sky; Firmament; Expanse', 'Sea', 'River', 'Mountain', 'Hill',
  'Valley; Vale', 'Plain', 'Wilderness', 'Desert', 'Cave; Cavern', 'Rock', 'Sand', 'Dust', 'Mud; Mire; Clay', 'Field', 'Forest',
  'Spring; Fountain', 'Well', 'Brook; Stream', 'Lake', 'Island; Isle', 'Shore; Seashore', 'Cliff; Crag', 'Wave; Waves; Billows',
  'Deep; Depths', 'Pleiades', 'Orion', 'Arcturus', 'Brimstone; Sulfur', 'Marsh; Swamp; Fen', 'Meadow; Pasture', 'Breeze',
  'East wind', 'Gale; Squall', 'Heat', 'Cold', 'Shadow; Shade', 'Valley of salt; Salt', 'Hailstorm', 'Torrent', 'Ford',
  'Hillside; Slope', 'Ravine; Gorge', 'Pit', 'Cleft', 'Peak; Summit; Top of the mountain', 'Wadi', 'Morning', 'Evening', 'Twilight',
  'Midnight', 'Noon; Noonday'];

// Sins and vices the Bible names (the specific sin, not the word "sin").
const SINS = ['Adultery', 'Murder', 'Theft; Stealing', 'Lying; Lies; Falsehood', 'False witness', 'Covetousness; Coveting; Greed',
  'Envy', 'Jealousy', 'Pride; Arrogance', 'Idolatry', 'Sorcery; Witchcraft', 'Drunkenness', 'Gluttony', 'Fornication; Sexual immorality',
  'Lust', 'Lewdness; Lasciviousness', 'Hatred', 'Wrath', 'Anger', 'Malice', 'Slander; Backbiting', 'Gossip; Whispering', 'Strife',
  'Hypocrisy', 'Deceit; Guile', 'Blasphemy', 'Bribery; Bribe', 'Extortion', 'Usury', 'Rebellion', 'Stubbornness', 'Murmuring; Grumbling',
  'Boasting', 'Folly; Foolishness', 'Laziness; Slothfulness; Sloth', 'Bitterness', 'Selfish ambition', 'Divisions; Factions; Heresies',
  'Reveling; Revelings; Orgies; Carousing', 'Uncleanness; Impurity', 'Filthiness', 'Unbelief', 'Disobedience', 'Unthankfulness; Ingratitude',
  'Perjury; Perjurers', 'Oppression', 'Violence', 'Injustice', 'Cursing', 'Partiality; Favoritism', 'Flattery', 'Gluttony; Glutton; Gluttonous',
  'Scoffing; Mocking', 'Kidnapping; Menstealers', 'Revenge; Vengeance', 'Insolence', 'Haughtiness', 'Self-indulgence',
  'Love of money', 'Complaining', 'Contention', 'Sedition', 'Treachery; Treason', 'Conspiracy', 'Robbery', 'Bloodshed',
  'Cowardice', 'Covenant breaking; Covenantbreakers', 'Hardness of heart', 'Wantonness', 'Debauchery', 'Licentiousness',
  'Double-mindedness', 'Evil speaking', 'Idleness', 'Quarreling; Quarrels', 'Rivalry', 'Fraud', 'Dishonesty',
  'Obscenity; Filthy talk', 'Coarse jesting; Jesting', 'Presumption', 'Disrespect'];

// Virtues and good qualities the Bible commends.
const VIRTUES = ['Love', 'Joy', 'Peace', 'Patience; Longsuffering', 'Kindness', 'Gentleness', 'Goodness', 'Faithfulness', 'Faith',
  'Meekness', 'Self-control; Temperance', 'Humility', 'Hope', 'Mercy', 'Compassion', 'Forgiveness', 'Honesty', 'Integrity',
  'Righteousness', 'Holiness', 'Purity', 'Wisdom', 'Understanding', 'Knowledge', 'Prudence', 'Discretion', 'Diligence',
  'Courage; Boldness', 'Perseverance; Endurance; Steadfastness', 'Obedience', 'Contentment', 'Generosity; Liberality', 'Hospitality',
  'Thankfulness; Thanksgiving; Gratitude', 'Justice', 'Equity; Fairness', 'Sincerity', 'Godliness', 'Reverence', 'Zeal',
  'Loyalty', 'Brotherly love; Brotherly kindness', 'Charity', 'Grace', 'Virtue', 'Honor; Honour', 'Modesty',
  'Sobriety; Soberness', 'Uprightness', 'Innocence', 'Trust', 'Watchfulness', 'Repentance', 'Submission', 'Unity', 'Moderation',
  'Simplicity', 'Blamelessness', 'Truthfulness', 'Discernment', 'Sound judgment', 'Insight', 'Teachableness',
  'Goodwill', 'Tenderheartedness; Tender heart', 'Forbearance', 'Lowliness', 'Fidelity', 'Chastity', 'Devotion',
  'Readiness', 'Peaceableness', 'Industry', 'Valor; Valour', 'Fortitude'];

// Heavenly and spiritual beings: not people or places, but surely "things
// named in the book" to a player (Satan in Job, the seraphim in Isaiah).
// God is left out on purpose, as in the people prompts (see the near misses).
const BEINGS = ['Satan', 'Devil', 'Angel; Angels', 'Cherub; Cherubim; Cherubims', 'Seraph; Seraphim; Seraphims', 'Immanuel; Emmanuel',
  'Archangel', 'Demon; Demons', 'Unclean spirit', 'Leviathan', 'Behemoth'];

// Feasts and holy days, false gods and idols, and a few more things players
// reach for first (the burning bush, the wise men, Daniel's statue).
const FEASTS = ['Passover', 'Pentecost', 'Sabbath', 'Feast of Unleavened Bread', 'Feast of Tabernacles; Feast of Booths',
  'Day of Atonement', 'Jubilee', 'New moon', 'Feast of Weeks', 'Purim', 'Feast of Dedication', 'Feast of Trumpets'];
const GODS = ['Baal', 'Dagon', 'Ashtoreth; Ashtaroth', 'Molech; Moloch', 'Chemosh', 'Asherah; Asherim', 'Bel', 'Milcom', 'Tammuz',
  'Nisroch', 'Rimmon', 'Artemis; Diana', 'Zeus; Jupiter', 'Hermes; Mercury', 'Golden calf', 'Image; Statue', 'Idol'];
const MORE = ['Bush; Burning bush', 'Ashes', 'Coal; Coals; Live coal', 'Tree; Trees', 'Scarlet thread; Scarlet line', 'Sluggard', 'Fool',
  'Virgin', 'Widow', 'Orphan; Fatherless', 'Stranger; Foreigner; Sojourner', 'Wise men; Magi', 'Elders', 'Bones', 'Blood'];
// Abstract words, for the books that are mostly about them (wisdom books,
// letters): "wisdom" in Proverbs, "faith" and "grace" in Romans.
const THEOLOGY = ['Law', 'Covenant', 'Sin', 'Death', 'Life', 'Salvation', 'Gospel', 'Resurrection', 'Baptism', 'Circumcision',
  'Sacrifice', 'Promise', 'Kingdom', 'Glory', 'Praise', 'Prayer', 'Word', 'Truth', 'Spirit', 'Flesh', 'Heaven', 'Hell; Sheol; Hades',
  'Judgment', 'Redemption', 'Atonement; Propitiation', 'Reconciliation', 'Inheritance', 'Commandment; Commandments', 'Righteousness',
  'Wrath', 'Blessing', 'Curse', 'Oath', 'Vow', 'Instruction', 'Counsel', 'Rebuke; Correction', 'Discipline'];

// Words too vague to be "a thing in the book of ___" (times of day, "the
// deep", parts of a word list that stand for something else).
const DROP = new Set(['Line', 'Mail', 'Covering', 'Fan', 'Engine', 'Bar', 'Post', 'Hold', 'Fold', 'Heat', 'Cold', 'Morning', 'Evening',
  'Noon', 'Noonday', 'Midnight', 'Twilight', 'Shadow', 'Shade', 'Chamber', 'Hall', 'Court', 'Dwelling', 'Habitation', 'Deep', 'Depths',
  'Pit', 'Cleft', 'Top of the mountain', 'Herbs', 'Fowl', 'Weights', 'Plain']);

function namesFromHand(file) {
  const out = [];
  for (const line of fs.readFileSync(path.join(ROOT, 'content', file), 'utf8').split(/\r?\n/)) {
    if (!line || /^[#@?\s]/.test(line) || !line.includes('|')) continue;
    out.push(line.split('|')[0].trim());
  }
  return out;
}

// Concrete things: objects, clothing, instruments, stones, money, plants,
// birds, creatures, food, structures and nature, with generic words left out.
function things(abstract) {
  const nouns = require('../derive-nouns.js');
  // occupations count too: a shepherd, a potter or a servant is a "who" a player names
  const want = ['objects', 'clothing', 'instruments', 'stones-metals', 'measures-money', 'plants', 'birds', 'occupations', 'body-parts', 'diseases'];
  let items = [];
  for (const cfg of nouns) if (want.includes(cfg.id)) items = items.concat(cfg.items);
  items = items.concat(namesFromHand('creatures.txt'), namesFromHand('food.txt'), STRUCTURES, NATURE, BEINGS, FEASTS, GODS, MORE);
  if (abstract) items = items.concat(VIRTUES, SINS, THEOLOGY);
  const seen = new Set(), out = [];
  for (const it of items) {
    const parts = it.split(';').map((x) => x.trim()).filter((x) => x && !DROP.has(x));
    if (!parts.length) continue;
    const k = parts[0].toLowerCase();
    if (seen.has(k)) continue;
    parts.forEach((x) => seen.add(x.toLowerCase()));
    out.push(parts.join('; '));
  }
  return out;
}

module.exports = { STRUCTURES, NATURE, SINS, VIRTUES, BEINGS, FEASTS, GODS, MORE, THEOLOGY, things };
