/* Fishers: the generated prompts. tools/derive.js reads this file.
 *
 *   kind     'person' or 'place'
 *   books    VPL book codes the answer must appear in (default: all 66)
 *   types    OpenBible place types to include (places only)
 *   filter   person prompts: regex a person's Easton entry must match (e.g. kings)
 *   handOk   person prompts with a filter: hand-list names that also qualify
 *   sheep    { name, fact }  the one Lost Sheep
 *   seat     { name, fact }  the Best Seat, if any
 *   tiers    { Name: tier }  manual corrections after the verse-count pass
 *   exclude  names to leave out (false positives found in review)
 *   nearMisses  lines in the content format: "Name; alias | message"
 */
'use strict';
const OT = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST',
  'JOB', 'PSA', 'PRO', 'ECC', 'SOL', 'ISA', 'JER', 'LAM', 'EZE', 'DAN', 'HOS', 'JOE', 'AMO', 'OBA', 'JON', 'MIC', 'NAH', 'HAB',
  'ZEP', 'HAG', 'ZEC', 'MAL'];
const NT = ['MAT', 'MAR', 'LUK', 'JOH', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHI', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT',
  'PHM', 'HEB', 'JAM', '1PE', '2PE', '1JO', '2JO', '3JO', 'JUD', 'REV'];
const PROPHETS = OT.slice(OT.indexOf('ISA'));
const LETTERS = NT.slice(NT.indexOf('ROM'), NT.indexOf('REV'));

const FAMOUS_OT = { Adam: 1, Eve: 1, Noah: 1, Abraham: 1, Moses: 1, David: 1, Isaac: 3, Jacob: 3, Joseph: 3, Solomon: 3, Samson: 3,
  Goliath: 3, Daniel: 3, Jonah: 3, Elijah: 3, Ruth: 3, Esther: 3, Sarah: 3, Cain: 3, Abel: 3, Aaron: 3, Joshua: 3, Saul: 3,
  Samuel: 3, Gideon: 4, Elisha: 4, Isaiah: 4, Jeremiah: 4, Methuselah: 4, Job: 3, Delilah: 4, Jezebel: 4, Lot: 4, Esau: 4,
  Rachel: 4, Leah: 4, Rebekah: 4, Miriam: 4, Deborah: 4, Boaz: 4, Naomi: 4, Hannah: 4, Eli: 4, Jonathan: 4, Absalom: 4,
  Bathsheba: 4, Nebuchadnezzar: 4, Pharaoh: 4, Ezra: 4, Nehemiah: 4, Mordecai: 4, Haman: 4, Ezekiel: 4, Hosea: 4,
  Shadrach: 4, Meshach: 4, Abednego: 4, Ham: 4, Shem: 4, Japheth: 4, Seth: 4, Enoch: 4, Benjamin: 4, Judah: 4, Reuben: 4,
  Levi: 4, Hezekiah: 4, Josiah: 4, Rahab: 4, Caleb: 4, Uriah: 4, Nathan: 4, Ahab: 4, Balaam: 4, Laban: 4, Hagar: 4, Ishmael: 4,
  Zipporah: 4, Jethro: 4, Korah: 4, Achan: 4, Jephthah: 4, Melchizedek: 4, Michal: 4, Abigail: 4 };
const FAMOUS_NT = { Jesus: 1, Mary: 1, Peter: 1, Paul: 1, John: 1, Joseph: 3, Judas: 3, Matthew: 3, Mark: 3, Luke: 3, James: 3,
  Andrew: 3, Thomas: 3, Philip: 3, Pilate: 3, Herod: 3, Lazarus: 3, Martha: 3, Zacchaeus: 3, Nicodemus: 4, Barnabas: 4,
  Timothy: 4, Silas: 4, Stephen: 4, Elizabeth: 4, Zechariah: 4, Simon: 3, Bartholomew: 4, Thaddaeus: 4, Caiaphas: 4,
  Barabbas: 4, Saul: 4, Cornelius: 4, Lydia: 4, Priscilla: 4, Aquila: 4, Titus: 4, Apollos: 4, Philemon: 4, Onesimus: 4,
  Ananias: 4, Sapphira: 4, Dorcas: 4, Tabitha: 4, Gabriel: 4, Anna: 4, Simeon: 4, Jairus: 4, Bartimaeus: 4, Matthias: 4,
  Felix: 4, Festus: 4, Agrippa: 4, Gamaliel: 4, Salome: 4, Joanna: 4, Cleopas: 4, Malchus: 4, Levi: 4, Zebedee: 4, Abraham: 3,
  Moses: 3, David: 3, Elijah: 3 };

module.exports = [
  // ---------------- People ----------------
  { id: 'people-all', kind: 'person', category: 'People', theme: 'faithfulness', prompt: 'Name a person named in the Bible.', warnTiers: true,
    tiers: Object.assign({}, FAMOUS_OT, FAMOUS_NT, { Jesus: 1, Peter: 1, Paul: 1, Mary: 1, John: 3 }),
    sheep: { name: 'Maher-shalal-hash-baz', fact: 'Isaiah\'s son carries the longest name in the Bible; it means the spoil hastens, the prey speeds (Isaiah 8:1-3).' },
    seat: { name: 'Methuselah', fact: 'Methuselah lived 969 years, longer than anyone else in Scripture (Genesis 5:27).' },
    nearMisses: ['Lot\'s wife; Lots wife; Noah\'s wife; Job\'s wife; Potiphar\'s wife | Scripture never gives her name.',
      'Caspar; Melchior; Balthazar; Balthasar; Gaspar | A name from later tradition: Matthew gives the wise men neither names nor a number (Matthew 2:1).',
      'Dismas | A name from later tradition for the criminal who asked Jesus to remember him; Luke does not name him (Luke 23:39-43).',
      'Longinus | A name from later tradition for the soldier with the spear; John does not name him (John 19:34).',
      'Veronica | A name from later tradition; the Gospels do not mention a Veronica.',
      'God; the LORD; Yahweh; Holy Spirit | God is not one of the people in this net. Try someone God called.'] },

  { id: 'people-ot', kind: 'person', books: OT, category: 'People', theme: 'faithfulness', prompt: 'Name a person named in the Old Testament.',
    tiers: FAMOUS_OT,
    sheep: { name: 'Shamgar', fact: 'Shamgar struck down six hundred Philistines with an ox goad, and saved Israel (Judges 3:31).' },
    seat: { name: 'Methuselah', fact: 'Methuselah lived 969 years, longer than anyone else in Scripture (Genesis 5:27).' },
    nearMisses: ['Lot\'s wife; Noah\'s wife; Job\'s wife; Potiphar\'s wife | Scripture never gives her name.',
      'Jesus | Jesus is promised throughout the Old Testament, but his name appears in the New.'] },

  { id: 'people-nt', kind: 'person', books: NT, category: 'People', theme: 'calling', prompt: 'Name a person named in the New Testament.',
    tiers: FAMOUS_NT,
    sheep: { name: 'Onesiphorus', fact: 'Onesiphorus searched Rome for Paul in prison and often refreshed him, unashamed of his chains (2 Timothy 1:16-17).' },
    seat: { name: 'Zacchaeus', fact: 'Zacchaeus, a chief tax collector and short in stature, climbed a sycamore tree to see Jesus (Luke 19:2-4).' },
    nearMisses: ['Caspar; Melchior; Balthazar; Balthasar | A name from later tradition: Matthew does not name the wise men (Matthew 2:1).',
      'Dismas; Longinus; Veronica | A name from later tradition, not found in the New Testament.'] },

  { id: 'people-genesis', kind: 'person', books: ['GEN'], category: 'People', theme: 'faithfulness', prompt: 'Name a person named in the book of Genesis.',
    tiers: FAMOUS_OT,
    sheep: { name: 'Tubal-cain', fact: 'Tubal-cain is the first named worker in bronze and iron (Genesis 4:22).' },
    seat: { name: 'Methuselah', fact: 'Methuselah lived 969 years, longer than anyone else in Scripture (Genesis 5:27).' },
    nearMisses: ['Lot\'s wife; Noah\'s wife; Potiphar\'s wife | She is in Genesis, but the text never gives her name.',
      'Moses; Aaron; Miriam | One book too late: that story begins in Exodus.'] },

  { id: 'people-law', kind: 'person', books: ['EXO', 'LEV', 'NUM', 'DEU'], category: 'People', theme: 'remembrance',
    prompt: 'Name a person named in Exodus, Leviticus, Numbers or Deuteronomy.', tiers: FAMOUS_OT,
    sheep: { name: 'Bezalel', fact: 'Bezalel was filled with the Spirit of God to craft the tabernacle in gold, silver and bronze (Exodus 31:2-5).' },
    seat: { name: 'Balaam', fact: 'Balaam set out to curse Israel, and his donkey saw the angel before he did (Numbers 22:22-31).' },
    nearMisses: ['Pharaoh\'s daughter; Pharaohs daughter | She drew Moses out of the water (Exodus 2:5-10), but is not named there.'] },

  { id: 'people-joshua-ruth', kind: 'person', books: ['JOS', 'JDG', 'RUT'], category: 'People', theme: 'courage',
    prompt: 'Name a person named in Joshua, Judges or Ruth.', tiers: FAMOUS_OT,
    sheep: { name: 'Eglon', fact: 'Eglon, the very fat king of Moab, was killed by the left-handed judge Ehud (Judges 3:17-22).' },
    seat: { name: 'Jael', fact: 'Jael, the wife of Heber the Kenite, killed the Canaanite commander Sisera (Judges 4:21).' },
    nearMisses: ['Samuel; Eli | He did judge Israel, but in 1 Samuel.'] },

  { id: 'people-samuel', kind: 'person', books: ['1SA', '2SA'], category: 'People', theme: 'kingdom',
    prompt: 'Name a person named in 1 or 2 Samuel.', tiers: FAMOUS_OT,
    sheep: { name: 'Benaiah', fact: 'Benaiah went down into a pit on a snowy day and killed a lion (2 Samuel 23:20).' },
    seat: { name: 'Goliath', fact: 'Goliath of Gath stood six cubits and a span, and fell to David\'s sling (1 Samuel 17:4, 49).' } },

  { id: 'people-kings', kind: 'person', books: ['1KI', '2KI'], category: 'People', theme: 'kingdom',
    prompt: 'Name a person named in 1 or 2 Kings.', tiers: FAMOUS_OT,
    sheep: { name: 'Obadiah', fact: 'Obadiah, over Ahab\'s household, hid a hundred prophets in two caves and fed them bread and water (1 Kings 18:3-4).' },
    seat: { name: 'Jezebel', fact: 'Jezebel, Ahab\'s queen, sought Elijah\'s life after Mount Carmel (1 Kings 19:1-2).' } },

  { id: 'people-chronicles', kind: 'person', books: ['1CH', '2CH'], category: 'People', theme: 'remembrance',
    prompt: 'Name a person named in 1 or 2 Chronicles.', tiers: FAMOUS_OT,
    sheep: { name: 'Jabez', fact: 'Jabez called on the God of Israel to bless him and enlarge his border, and God granted his request (1 Chronicles 4:9-10).' } },

  { id: 'people-exile', kind: 'person', books: ['EZR', 'NEH', 'EST', 'DAN'], category: 'People', theme: 'courage',
    prompt: 'Name a person named in Ezra, Nehemiah, Esther or Daniel.', tiers: FAMOUS_OT,
    sheep: { name: 'Hegai', fact: 'Hegai, keeper of the women, showed Esther kindness and gave her the best place in the house (Esther 2:8-9).' },
    seat: { name: 'Belshazzar', fact: 'Belshazzar saw a hand write on the wall at his feast, and Daniel read it (Daniel 5:5, 25-28).' } },

  { id: 'people-prophets', kind: 'person', books: PROPHETS, category: 'People', theme: 'word',
    prompt: 'Name a person named in the books of the prophets (Isaiah to Malachi).', tiers: FAMOUS_OT,
    sheep: { name: 'Ebed-melech', fact: 'Ebed-melech the Ethiopian drew Jeremiah out of the cistern with ropes and worn-out rags (Jeremiah 38:7-13).' },
    seat: { name: 'Nebuchadnezzar', fact: 'Nebuchadnezzar dreamed of a great statue, and later of a great tree (Daniel 2:31; 4:10).' } },

  { id: 'people-gospels', kind: 'person', books: ['MAT', 'MAR', 'LUK', 'JOH'], category: 'People', theme: 'calling',
    prompt: 'Name a person named in the four Gospels.', tiers: FAMOUS_NT,
    sheep: { name: 'Cleopas', fact: 'Cleopas walked the road to Emmaus with the risen Jesus and did not recognize him until the bread was broken (Luke 24:18, 30-31).' },
    seat: { name: 'Zacchaeus', fact: 'Zacchaeus, a chief tax collector and short in stature, climbed a sycamore tree to see Jesus (Luke 19:2-4).' },
    nearMisses: ['Caspar; Melchior; Balthazar; Balthasar | A name from later tradition: Matthew does not name the wise men (Matthew 2:1).',
      'Dismas; Longinus; Veronica | A name from later tradition, not found in the Gospels.'] },

  { id: 'people-acts', kind: 'person', books: ['ACT'], category: 'People', theme: 'mission',
    prompt: 'Name a person named in the book of Acts.', tiers: FAMOUS_NT,
    sheep: { name: 'Eutychus', fact: 'Eutychus fell asleep during Paul\'s long sermon, fell from a third-story window, and was restored to life (Acts 20:9-12).' },
    seat: { name: 'Gamaliel', fact: 'Gamaliel, a respected teacher of the law, counseled the council to leave the apostles alone (Acts 5:34-39).' },
    // People named in Acts whom the dictionary classification missed.
    extra: [
      { name: 'Aeneas', aliases: ['Eneas'], keys: ['ACT 9:33', 'ACT 9:34'], note: 'Bedridden for eight years at Lydda; Peter said, "Jesus Christ heals you."' },
      { name: 'Theophilus', aliases: [], keys: ['ACT 1:1'], note: 'The book of Acts is addressed to him.' },
      { name: 'Herod', aliases: [], keys: ['ACT 12:1', 'ACT 12:21'], note: 'Killed James and arrested Peter; struck down at Caesarea.' },
      { name: 'Nicanor', aliases: [], keys: ['ACT 6:5'], note: 'One of the seven chosen to serve the tables.' },
      { name: 'Prochorus', aliases: ['Procorus'], keys: ['ACT 6:5'], note: 'One of the seven chosen to serve the tables.' },
      { name: 'Timon', aliases: [], keys: ['ACT 6:5'], note: 'One of the seven chosen to serve the tables.' },
      { name: 'Parmenas', aliases: [], keys: ['ACT 6:5'], note: 'One of the seven chosen to serve the tables.' },
      { name: 'Nicolas', aliases: ['Nicolaus'], keys: ['ACT 6:5'], note: 'A proselyte of Antioch, one of the seven.' },
      { name: 'Theudas', aliases: [], keys: ['ACT 5:36'], note: 'Gamaliel recalled his failed uprising.' },
      { name: 'Gaius', aliases: [], keys: ['ACT 19:29', 'ACT 20:4'], note: 'A companion of Paul seized in the Ephesus riot.' },
      { name: 'Elymas', aliases: [], keys: ['ACT 13:8'], note: 'The sorcerer on Cyprus, struck blind for a season.' },
      { name: 'David', aliases: [], keys: ['ACT 2:25', 'ACT 13:22'], note: 'Peter quoted him at Pentecost.' },
      { name: 'Solomon', aliases: [], keys: ['ACT 7:47'], note: '"But Solomon built him a house."' },
      { name: 'Samuel', aliases: [], keys: ['ACT 3:24', 'ACT 13:20'], note: 'Named by Peter among the prophets.' },
      { name: 'Aaron', aliases: [], keys: ['ACT 7:40'], note: 'Stephen recalled the golden calf.' },
      { name: 'Isaac', aliases: [], keys: ['ACT 7:8'], note: 'Stephen traced the covenant through him.' },
      { name: 'Jesse', aliases: [], keys: ['ACT 13:22'], note: '"David the son of Jesse, a man after my heart."' },
      { name: 'Isaiah', aliases: ['Esaias'], keys: ['ACT 8:28', 'ACT 28:25'], note: 'The Ethiopian was reading Isaiah in his chariot.' },
      { name: 'Joel', aliases: [], keys: ['ACT 2:16'], note: 'Peter quoted Joel at Pentecost.' }
    ] },

  { id: 'people-letters', kind: 'person', books: LETTERS, category: 'People', theme: 'church',
    prompt: 'Name a person named in the New Testament letters (Romans to Jude).', tiers: FAMOUS_NT,
    sheep: { name: 'Tertius', fact: 'Tertius wrote down the letter to the Romans and added his own greeting (Romans 16:22).' },
    seat: { name: 'Onesimus', fact: 'Onesimus, once useless to Philemon, became useful to both him and Paul (Philemon 10-11).' } },

  { id: 'kings', kind: 'person', category: 'People', theme: 'kingdom', prompt: 'Name a king named in the Bible (of any nation).',
    filter: /\b(king) (of|over)\b|\bwas (the )?(\w+ )?king\b|\breigned\b|\bking in\b|\bthe last king\b|\bfirst king\b/i,
    handScopes: ['judah-kings', 'israel-kings'],
    handOk: ['Herod', 'Agrippa', 'Herod Agrippa I', 'Aretas', 'Eglon', 'Jabin', 'Ahasuerus', 'David', 'Solomon', 'Saul', 'Archelaus'],
    // Not kings (queens, judges, officials, sons and fathers of kings) that the dictionary text pulled in.
    exclude: ['Benjamin', 'Elisha', 'Esther', 'Queen', 'Micaiah', 'Maaseiah', 'Nebat', 'Maachah', 'Jezebel', 'Naaman', 'Athaliah',
      'Bernice', 'Candace', 'Drusilla', 'Nehushta', 'Zeruah', 'Naamah', 'Deborah', 'Hanani', 'Ammihud', 'Urijah', 'Vashti', 'Ehud',
      'Zabad', 'Javan', 'Zippor', 'Ebed-melech', 'Malluch', 'Malchi-shua', 'Hadoram', 'Zophar', 'Adrammelech', 'Sharezer',
      'Nergal-sharezer', 'Ludim', 'Phicol', 'Genubath', 'Hezion', 'Jozachar', 'Maoch', 'Tabrimon', 'Shalman', 'Debir'],
    extra: [
      { name: 'Darius', aliases: [], refs: 'Dan 6:1, 25; Ezra 6:1', note: 'Made Daniel one of three presidents over his kingdom.' },
      { name: 'Belshazzar', aliases: [], refs: 'Dan 5:1', note: 'Gave the feast where a hand wrote on the wall.' },
      { name: 'Sennacherib', aliases: [], refs: '2 Kgs 18:13; 19:36', note: 'King of Assyria who besieged Jerusalem in the days of Hezekiah.' },
      { name: 'Sihon', aliases: [], refs: 'Num 21:21, 26', note: 'King of the Amorites, defeated by Israel at Jahaz.' },
      { name: 'Shalmaneser', aliases: [], refs: '2 Kgs 17:3; 18:9', note: 'King of Assyria who besieged Samaria.' },
      { name: 'Tiglath-pileser', aliases: ['Tilgath-pilneser'], refs: '2 Kgs 15:29; 16:7; 1 Chr 5:26', note: 'King of Assyria who carried the northern tribes captive.' },
      { name: 'Esarhaddon', aliases: [], refs: '2 Kgs 19:37; Ezra 4:2', note: 'Succeeded his father Sennacherib as king of Assyria.' },
      { name: 'Neco', aliases: ['Necoh', 'Necho', 'Nechoh'], refs: '2 Kgs 23:29; 2 Chr 35:20; Jer 46:2', note: 'King of Egypt who killed Josiah at Megiddo.' },
      { name: 'Hophra', aliases: [], refs: 'Jer 44:30', note: 'King of Egypt named in the prophecy of Jeremiah.' },
      { name: 'So', aliases: [], refs: '2 Kgs 17:4', note: 'King of Egypt to whom Hoshea sent messengers.' },
      { name: 'Shishak', aliases: [], refs: '1 Kgs 14:25', note: 'King of Egypt who took the treasures of the temple.' },
      { name: 'Chedorlaomer', aliases: [], refs: 'Gen 14:1, 4-5', note: 'King of Elam who led the kings Abram defeated.' },
      { name: 'Adoni-zedek', aliases: ['Adonizedek'], refs: 'Josh 10:1, 3', note: 'King of Jerusalem who led five kings against Gibeon.' },
      { name: 'Adoni-bezek', aliases: ['Adonibezek'], refs: 'Judg 1:5-7', note: 'A Canaanite king defeated by Judah.' },
      { name: 'Achish', aliases: [], refs: '1 Sam 21:10; 27:2', note: 'King of Gath, with whom David took refuge.' },
      { name: 'Ish-bosheth', aliases: ['Ishbosheth'], refs: '2 Sam 2:8-10', note: 'Son of Saul, who reigned over Israel two years.' },
      { name: 'Merodach-baladan', aliases: ['Berodach-baladan'], refs: 'Isa 39:1; 2 Kgs 20:12', note: 'King of Babylon who sent envoys to Hezekiah.' },
      { name: 'Huram', aliases: [], refs: '2 Chr 2:3, 11', note: 'King of Tyre, who helped Solomon build the temple.' },
      { name: 'Hadad', aliases: [], refs: 'Gen 36:35', note: 'A king of Edom.' },
      { name: 'Jobab', aliases: [], refs: 'Gen 36:33; Josh 11:1', note: 'A king of Edom, and a king of Madon.' },
      { name: 'Husham', aliases: [], refs: 'Gen 36:34', note: 'A king of Edom.' },
      { name: 'Samlah', aliases: [], refs: 'Gen 36:36', note: 'A king of Edom.' },
      { name: 'Shaul', aliases: [], refs: 'Gen 36:37', note: 'A king of Edom.' }
    ],
    tiers: { David: 1, Solomon: 1, Saul: 1, Herod: 3, Pharaoh: 3, Nebuchadnezzar: 3, Hezekiah: 3, Josiah: 3, Ahab: 3,
      Cyrus: 4, Darius: 4, Ahasuerus: 4, Belshazzar: 4, Rehoboam: 4, Jeroboam: 4, Jehu: 4 },
    sheep: { name: 'Og', fact: 'Og, king of Bashan, was the last of the Rephaim; his iron bed was nine cubits long (Deuteronomy 3:11).' },
    seat: { name: 'Melchizedek', fact: 'Melchizedek, king of Salem and priest of God Most High, blessed Abram (Genesis 14:18-20).' },
    nearMisses: ['Jesus; Christ | Called King of kings (Revelation 19:16), but this net is for the earthly kings Scripture names.',
      'Magi; wise men; three kings | Matthew calls them wise men from the east, not kings (Matthew 2:1).',
      'Esther; Vashti; Jezebel; Athaliah; Candace; Bernice | A queen rather than a king.',
      'Augustus; Tiberius; Claudius; Caesar; Nero | A Roman emperor; the New Testament calls him Caesar rather than king.'] },

  // ---------------- Places ----------------
  { id: 'places-all', kind: 'place', flags: 'nouns ignore=mount,mt,mountain,mountains,hill,river,brook,sea,lake,valley,land,city,island,pool,spring,well', category: 'Places', theme: 'mission', prompt: 'Name a place named in the Bible.', warnTiers: true,
    extra: [{ name: 'Israel', aliases: [], refs: 'Matt 2:20-21; 1 Sam 13:19', note: 'The land God promised to the descendants of Abraham.' }],
    tiers: { Jerusalem: 1, Bethlehem: 1, Egypt: 1, Nazareth: 1, Galilee: 1, Israel: 1, Jordan: 1, Babylon: 3, Rome: 3, Jericho: 3,
      Eden: 3, Sinai: 3, Nineveh: 3, Canaan: 3, Damascus: 3, Bethany: 3, Capernaum: 3, Corinth: 4, Ephesus: 4, Galatia: 4,
      Philippi: 4, Athens: 4, Antioch: 4, Ararat: 4, Sodom: 4, Gomorrah: 4, Golgotha: 4, Gethsemane: 4, Calvary: 4, Patmos: 4 },
    sheep: { name: 'Zoar', fact: 'Zoar was the little city Lot begged to flee to, and it was spared when Sodom fell (Genesis 19:20-23).' },
    seat: { name: 'Ur', fact: 'Abram set out with his family from Ur of the Chaldeans for the land of Canaan (Genesis 11:31).' },
    nearMisses: ['Heaven; Hell; Paradise | Spoken of throughout Scripture, but not a place on the map.', 'Atlantis; Narnia | Not in the Bible.'] },

  { id: 'cities', kind: 'place', types: ['settlement'], flags: 'nouns ignore=mount,mt,mountain,mountains,hill,river,brook,sea,lake,valley,land,city,island,pool,spring,well', category: 'Places', theme: 'mission', prompt: 'Name a city, town or village named in the Bible.',
    tiers: { Jerusalem: 1, Bethlehem: 1, Nazareth: 1, Jericho: 1, Babylon: 3, Rome: 3, Nineveh: 3, Damascus: 3, Bethany: 3,
      Capernaum: 3, Sodom: 3, Gomorrah: 3, Corinth: 4, Ephesus: 4, Philippi: 4, Athens: 4, Antioch: 4, Tarsus: 4, Cana: 4, Hebron: 4 },
    sheep: { name: 'Nain', fact: 'At the gate of Nain, Jesus raised a widow\'s only son and gave him back to his mother (Luke 7:11-15).' },
    seat: { name: 'Nineveh', fact: 'Nineveh was the great city Jonah tried to avoid, and it repented at his preaching (Jonah 3:3-5).' },
    nearMisses: ['Egypt; Canaan; Galilee; Judea | A land or region rather than a city.'] },

  { id: 'places-genesis', kind: 'place', books: ['GEN'], flags: 'nouns ignore=mount,mt,mountain,mountains,hill,river,brook,sea,lake,valley,land,city,island,pool,spring,well', category: 'Places', theme: 'faithfulness', prompt: 'Name a place named in the book of Genesis.',
    tiers: { Eden: 1, Egypt: 1, Canaan: 1, Babel: 3, Sodom: 3, Gomorrah: 3, Ur: 3, Haran: 3, Bethel: 3, Ararat: 3 },
    sheep: { name: 'Peniel', fact: 'Jacob named the place Peniel after wrestling until daybreak, saying he had seen God face to face (Genesis 32:30).' },
    seat: { name: 'Ur', fact: 'Abram set out with his family from Ur of the Chaldeans for the land of Canaan (Genesis 11:31).' } },

  { id: 'places-law', kind: 'place', books: ['EXO', 'LEV', 'NUM', 'DEU'], flags: 'nouns ignore=mount,mt,mountain,mountains,hill,river,brook,sea,lake,valley,land,city,island,pool,spring,well', category: 'Places', theme: 'remembrance',
    prompt: 'Name a place named in Exodus, Leviticus, Numbers or Deuteronomy.',
    tiers: { Egypt: 1, Sinai: 1, Canaan: 1, Jordan: 3, Horeb: 3, Nebo: 3, Moab: 3 },
    sheep: { name: 'Elim', fact: 'At Elim Israel found twelve springs of water and seventy palm trees, and camped by the water (Exodus 15:27).' },
    seat: { name: 'Marah', fact: 'At Marah the water was bitter until Moses threw a tree into it (Exodus 15:23-25).' } },

  { id: 'places-joshua', kind: 'place', books: ['JOS'], flags: 'nouns ignore=mount,mt,mountain,mountains,hill,river,brook,sea,lake,valley,land,city,island,pool,spring,well', category: 'Places', theme: 'courage', prompt: 'Name a place named in the book of Joshua.',
    tiers: { Jericho: 1, Jordan: 1, Canaan: 1, Ai: 3, Gibeon: 3, Hebron: 3, Jerusalem: 3, Shechem: 4, Gilgal: 4, Shiloh: 4 },
    sheep: { name: 'Timnath-serah', fact: 'Joshua asked for Timnath-serah as his inheritance, built the city, and was buried there (Joshua 19:50; 24:30).' },
    seat: { name: 'Gibeon', fact: 'Over Gibeon the sun stood still while Israel fought (Joshua 10:12-13).' } },

  { id: 'places-judges-samuel', kind: 'place', books: ['JDG', 'RUT', '1SA', '2SA'], flags: 'nouns ignore=mount,mt,mountain,mountains,hill,river,brook,sea,lake,valley,land,city,island,pool,spring,well', category: 'Places', theme: 'courage',
    extra: [{ name: 'Israel', aliases: [], refs: 'Matt 2:20-21; 1 Sam 13:19', note: 'The land God promised to the descendants of Abraham.' }],
    prompt: 'Name a place named in Judges, Ruth, or 1 and 2 Samuel.',
    tiers: { Bethlehem: 1, Jerusalem: 1, Israel: 1, Shiloh: 3, Gath: 3, Hebron: 3, Moab: 3, Ramah: 4 },
    sheep: { name: 'Ebenezer', fact: 'Samuel set up a stone and named it Ebenezer, saying, Thus far the LORD has helped us (1 Samuel 7:12).' },
    seat: { name: 'Endor', fact: 'Before his last battle Saul went to a woman at Endor who had a familiar spirit (1 Samuel 28:7).' } },

  { id: 'places-kings', kind: 'place', books: ['1KI', '2KI', '1CH', '2CH'], flags: 'nouns ignore=mount,mt,mountain,mountains,hill,river,brook,sea,lake,valley,land,city,island,pool,spring,well', category: 'Places', theme: 'kingdom',
    extra: [{ name: 'Israel', aliases: [], refs: 'Matt 2:20-21; 1 Sam 13:19', note: 'The land God promised to the descendants of Abraham.' }],
    prompt: 'Name a place named in Kings or Chronicles.',
    tiers: { Jerusalem: 1, Israel: 1, Judah: 1, Babylon: 3, Egypt: 3, Samaria: 3, Carmel: 3, Assyria: 3 },
    sheep: { name: 'Ophir', fact: 'Solomon\'s ships sailed to Ophir and brought back gold (1 Kings 9:28).' },
    seat: { name: 'Carmel', fact: 'On Mount Carmel Elijah called down fire before the prophets of Baal (1 Kings 18:19-39).' } },

  { id: 'places-prophets', kind: 'place', books: PROPHETS, flags: 'nouns ignore=mount,mt,mountain,mountains,hill,river,brook,sea,lake,valley,land,city,island,pool,spring,well', category: 'Places', theme: 'word',
    extra: [{ name: 'Israel', aliases: [], refs: 'Matt 2:20-21; 1 Sam 13:19', note: 'The land God promised to the descendants of Abraham.' }],
    prompt: 'Name a place named in the books of the prophets (Isaiah to Malachi).',
    tiers: { Jerusalem: 1, Babylon: 1, Nineveh: 1, Zion: 1, Israel: 1, Egypt: 3, Tarshish: 3, Bethlehem: 3, Assyria: 3 },
    sheep: { name: 'Tekoa', fact: 'Amos was among the herdsmen of Tekoa when the LORD took him from following the flock (Amos 1:1; 7:14-15).' },
    seat: { name: 'Tarshish', fact: 'Jonah boarded a ship for Tarshish to flee from the presence of the LORD (Jonah 1:3).' } },

  { id: 'places-gospels', kind: 'place', books: ['MAT', 'MAR', 'LUK', 'JOH'], flags: 'nouns ignore=mount,mt,mountain,mountains,hill,river,brook,sea,lake,valley,land,city,island,pool,spring,well', category: 'Places', theme: 'calling',
    prompt: 'Name a place named in the four Gospels.',
    tiers: { Jerusalem: 1, Bethlehem: 1, Nazareth: 1, Galilee: 1, Jordan: 1, Bethany: 3, Capernaum: 3, Jericho: 3, Egypt: 3, Cana: 3, Gethsemane: 3, Golgotha: 3 },
    sheep: { name: 'Sychar', fact: 'At Jacob\'s well near Sychar, Jesus asked a Samaritan woman for a drink (John 4:5-7).' },
    seat: { name: 'Gethsemane', fact: 'Jesus prayed in Gethsemane on the night he was betrayed (Matthew 26:36).' },
    // Named in the Gospels but missing from the geocoding data's Gospel senses.
    extra: [
      { name: 'Magdala', aliases: ['Magadan'], keys: ['MAT 15:39'], note: 'Jesus came there by boat after feeding the four thousand.' },
      { name: 'Aenon', aliases: ['Enon'], keys: ['JOH 3:23'], note: 'John was baptizing there, near Salim, because there was much water.' },
      { name: 'Bethabara', aliases: [], keys: ['JOH 1:28'], note: 'The KJV names the place beyond the Jordan where John baptized.' },
      { name: 'Zebulun', aliases: ['Zabulon'], keys: ['MAT 4:13', 'MAT 4:15'], note: 'Capernaum was in the region of Zebulun and Naphtali.' },
      { name: 'Naphtali', aliases: ['Nephthalim'], keys: ['MAT 4:13', 'MAT 4:15'], note: 'Capernaum was in the region of Zebulun and Naphtali.' },
      { name: 'Praetorium', aliases: [], keys: ['MAR 15:16'], note: 'The soldiers led Jesus into the court of the governor\'s headquarters.' },
      { name: 'Calvary', aliases: [], keys: ['LUK 23:33'], note: 'The KJV name for the place called the Skull.' }
    ] },

  { id: 'places-acts', kind: 'place', books: ['ACT'], flags: 'nouns ignore=mount,mt,mountain,mountains,hill,river,brook,sea,lake,valley,land,city,island,pool,spring,well', category: 'Places', theme: 'mission', prompt: 'Name a place named in the book of Acts.',
    tiers: { Jerusalem: 1, Rome: 1, Damascus: 1, Antioch: 3, Ephesus: 3, Corinth: 3, Athens: 3, Philippi: 3, Samaria: 3, Judea: 3 },
    sheep: { name: 'Three Taverns', fact: 'Believers from Rome came out as far as the Three Taverns to meet Paul, and he thanked God and took courage (Acts 28:15).' },
    seat: { name: 'Damascus', fact: 'On the road to Damascus a light from heaven flashed around Saul (Acts 9:3).' } },

  { id: 'waters-mountains', kind: 'place', types: ['river', 'body of water', 'wadi', 'spring', 'pool', 'well', 'mountain', 'mountain range', 'hill', 'mountain ridge'],
    category: 'Places', theme: 'deep', prompt: 'Name a mountain, hill, river, sea, spring or pool named in the Bible.',
    tiers: { 'Jordan': 1, 'Sinai': 1, 'Red Sea': 1, 'Ararat': 3, 'Carmel': 3, 'Nile': 3, 'Euphrates': 3, 'Zion': 3, 'Olivet': 3, 'Galilee': 3 },
    sheep: { name: 'Pishon', fact: 'The Pishon was the first of the four rivers that flowed out of Eden (Genesis 2:10-11).' },
    seat: { name: 'Carmel', fact: 'On Mount Carmel Elijah called down fire before the prophets of Baal (1 Kings 18:19-39).' } },

  { id: 'regions', kind: 'place', types: ['region', 'island'], flags: 'nouns ignore=mount,mt,mountain,mountains,hill,river,brook,sea,lake,valley,land,city,island,pool,spring,well', category: 'Places', theme: 'mission',
    extra: [{ name: 'Israel', aliases: [], refs: 'Matt 2:20-21; 1 Sam 13:19', note: 'The land God promised to the descendants of Abraham.' }],
    prompt: 'Name a land, region or island named in the Bible.',
    tiers: { Egypt: 1, Israel: 1, Canaan: 1, Galilee: 1, Judea: 3, Samaria: 3, Babylon: 3, Assyria: 3, Moab: 3, Edom: 3, Goshen: 3 },
    sheep: { name: 'Nod', fact: 'Cain went out from the presence of the LORD and lived in the land of Nod, east of Eden (Genesis 4:16).' },
    seat: { name: 'Goshen', fact: 'Jacob\'s family settled in the land of Goshen in Egypt (Genesis 47:27).' } }
];

module.exports = module.exports.concat(require('./derive-nouns.js'));
