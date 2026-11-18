# Batch 2 report: new Scripture sets and expanded banks

All of this is live in `data/prompts.json` (and `data/prompts.js`). Every answer passes `tools/verify.js` (each name, alias and anchor found at a cited verse in the WEB or KJV; 13,083 checked) and `tools/validate.js` (0 errors). Tiers are estimates (`"estimated": true`): verse counts, then a manual pass. The full banks are in `review/prompts.md`.

Bank now: 95 prompts (57 closed), 10,311 answers, 14 categories; `prompts.json` is 1.34 MB.

## New prompts (31)

| Prompt | Category | Type | Answers | Lost Sheep | Best Seat |
|---|---|---|---|---|---|
| raised-from-dead | Signs & Wonders | closed, phrase | 11 | Man thrown into Elisha's grave | — |
| new-names | Names & Titles | closed | 30 | Pashhur | Paul |
| i-am-sayings | Words of Jesus | closed, phrase | 8 | Before Abraham was, I am | — |
| cross-sayings | Words of Jesus | closed, phrase | 7 | Woman, behold your son | — |
| giants | People | closed | 17 | Ishbi-benob | Og |
| plagues | Signs & Wonders | closed, phrase | 10 | Death of livestock | — |
| fruit-of-the-spirit | Words & Virtues | closed | 9 | Goodness | — |
| armor-of-god | Words & Virtues | closed, phrase | 6 | Shoes of the gospel of peace | — |
| seven-churches | Places | closed | 7 | Thyatira | — |
| cities-of-refuge | Places | closed | 6 | Bezer | — |
| psalm-writers | Books of the Bible | closed | 7 | Ethan | — |
| eden | Places | closed | 32 | Bdellium | — |
| from-heaven | Signs & Wonders | closed | 19 | Great stones | — |
| kingdom-is-like | Parables & Miracles | closed, phrase | 13 | Householder | — |
| revelation | Books of the Bible | open | 73 | Wormwood | — |
| prisoners | People | closed | 22 | Hanani | — |
| who-wept | People | closed | 33 | Joash | Jesus |
| who-ran | People | closed | 21 | Elijah | — |
| who-fasted | People | closed | 20 | Jabesh Gilead | — |
| shepherds | Trades & Callings | closed | 16 | Mesha | — |
| blindness | Signs & Wonders | closed | 14 | Ahijah | — |
| names-of-god | Names & Titles | closed | 41 | Jealous | — |
| holy-spirit-names | Names & Titles | closed | 17 | Eternal Spirit | — |
| spiritual-gifts | Words & Virtues | closed, phrase | 22 | Helps | — |
| solomons-temple | Worship & Feasts | closed | 28 | Jachin | — |
| dreams-visions | People | closed | 36 | Man in the camp of Midian | — |
| angel-encounters | People | closed | 29 | Balaam's donkey | — |
| colors | Words & Virtues | closed | 21 | Vermilion | — |
| body-parts | Creatures | open | 69 | Big toe | — |
| diseases | Signs & Wonders | closed | 37 | Dropsy | — |
| measures-money | Objects & Treasures | closed | 36 | Firkin | — |

Dropped: **psalm-119-letters.** The section headings (Aleph … Tav) are not in our text editions: the WEB has only "ALEPH" at Psalm 119:1 and the KJV none. As you said, the prompt is dropped.

Renamed: your #5 id "fruit-armor" is `fruit-of-the-spirit` (the armor of God is its own prompt, `armor-of-god`). #32 is `angel-encounters`.

New categories: Signs & Wonders, Words of Jesus, Words & Virtues.

## Expanded banks

| Prompt | Before | After | Gained |
|---|---|---|---|
| Food or drink | 66 | 103 | +37 |
| Parables and miracles | 71 | 85 | +14 |
| Precious stone or metal | 35 | 37 | +2 (Exodus 28, Ezekiel 28 and Revelation 21 were already complete; bdellium and steel added) |
| Musical instrument | 22 | 27 | +5 (stringed instruments, ten-stringed lute, sounding brass, clanging cymbal, trump) |
| Bird | 40 | 45 | +5 (white owl, desert owl, black kite, fowl, chicks/chickens) |
| Place in the four Gospels | 58 | 65 | +7 (Magdala, Aenon, Bethabara, Zebulun, Naphtali, Praetorium, Calvary); now an open prompt |
| Person in Acts | 76 | 95 | +19 (Aeneas, Theophilus, Herod, the seven's Nicanor, Prochorus, Timon, Parmenas, Nicolas, Theudas, Gaius, Elymas, David, Solomon, Samuel, Aaron, Isaac, Jesse, Isaiah, Joel) |

**Existing bug fixed:** the bird prompt had "chicken / chickens" as a near miss, but the KJV says "as a hen gathereth her chickens" (Matthew 23:37). Chicks/chickens is now an answer; the bat is the new near miss (listed with the birds in Leviticus 11:19, but not a bird).

## Seed references corrected or dropped

- **Barnabas, Acts 4:36:** his earlier name is Joses (WEB and KJV), not Joseph.
- **Galatians 5:22:** both texts say "faith", not "faithfulness" (accepted as a form).
- **Exodus 8:16–18:** both texts say "lice"; "gnats" is accepted as a form.
- **Genesis 2:14:** both texts say "Hiddekel"; "Tigris" is accepted as a form.
- **Isaiah 61:1 ("Spirit of the LORD"):** the KJV reads "Spirit of the Lord GOD" and the WEB "the Lord Yahweh's Spirit"; the answer cites Judges 14:6 and Isaiah 11:2, where the phrase is printed.
- **Ephesians 1:17 ("Spirit of wisdom and revelation"): dropped.** Both texts print "spirit" in lower case there, so the text doesn't clearly make it a title of the Holy Spirit.
- **Exodus 17:15:** the WEB reads "Yahweh our Banner" (KJV Jehovah-nissi), not "the LORD is my Banner" (kept as a form).
- **El Shaddai, El Roi, El Olam, Jehovah-shammah, Jehovah Tsidkenu, Jehovah Rapha:** not printed in the WEB or KJV; accepted as forms of the English names. **Adonai** is not printed either, so it is a near miss as planned.
- **Romans 12:8 ("leading"):** the text says "he who rules"; checked by that word.
- **Revelation:** "666" and "144,000" are printed as words; the WEB has "lamp stands", "little book" and a measuring "reed". Numerals and modern wordings are accepted as forms.
- **1 Kings 6–8:** "bronze sea" is "the molten sea" / "the sea"; "vestibule" is "porch"; "Huram" is the Chronicles spelling. All accepted as forms.
- **Acts 9:8–9 and 13:2–3:** the text says Saul; "Paul" is accepted.
- **Matthew 27:19 and Judges 7:13:** "Pilate's wife" and the Midianite soldier aren't named in the verse; they are label answers checked by an anchor word ("wife", "dreamed"). `tools/verify.js` now supports an anchor on a single answer for this.
- **Many "who wept / ran / fasted / was blind / was a shepherd" seeds** cite the verse with the action, where the person is "he" or "she" and is named a verse or two earlier (for example Genesis 21:16 Hagar, Luke 19:4 Zacchaeus, Nehemiah 1:4, Esther 4:16). The verse that names them was added to the reference, about forty in all; a few needed a verse further away (Jeremiah 1:1, Job 16:1, Zechariah 1:1, Isaiah 1:1, Revelation 1:9).
- **Word lists, not found in the WEB or KJV and left out:** sorrel; wrist, chin, lungs, brain, eyelashes, "tip of the ear", "ear lobe"; ulcers, lunacy, ringworm; carnelian, jade, garnet, antimony, electrum; bagpipe, sistrums; pim (1 Samuel 13:21 is worded differently). "Lepton" is merged into mite, "penny" into denarius and "farthing" into quadrans (same coins).
- **Generic entries removed:** "disease" and "sickness" (now a near miss asking for a name), "measure", and "barrenness" (not a disease).

## Lost Sheep and Best Seat changes from your suggestions

- **New names:** Pashhur / Magor-missabib instead of Zaphenath-paneah (approved in the sample round).
- All other suggested picks were kept. Where you gave none, I picked an answer that is rare and has a good fact (table above).

## Daily and Endless rules with the bigger pool

With 57 closed sets, the old picker starved some closed sets under the one-closed-per-cast rule (six were never used in a year). `js/daily.js` now:

- puts **exactly one closed set** in every cast, from its own rotation through all 57 (each comes round every 57 days);
- fills the other six slots from the categories that have open prompts, rotating the categories evenly and walking each category's own prompts in turn;
- still never repeats a category in a cast.

Tests (41 pass) cover two years of dailies and 200 Endless casts: 7 prompts, 7 categories, exactly one closed set, every prompt used within a year, and every closed set used within one cycle.

**Trade-off to know about:** only nine categories have open prompts and every cast needs six of them, so a category whose only open prompt is a single bank ("nations", "occupations", "parables-miracles", "revelation") appears on about two days in three. That was already about the same before this batch (64%). Adding open prompts of 60 or more to those categories is the fix.

Casts are reshuffled from this release; anyone mid-cast keeps the prompts they started.

## Practice Waters check in the browser

`tests/playthrough/practice-new.js` played one Practice round of each of the 31 new prompts (desktop, reduced motion): a one-letter typo (expect a suggestion, not an accept), the first near miss (expect its message), and the Lost Sheep typed in alternating case with spaces (expect The Lost Sheep). **All 31 passed.** Body parts, new names and Revelation were in today's daily, which Practice leaves out, so they were played with the clock moved ahead.

Matching problems found: none in the browser. Two found earlier by the tests and fixed: "giants" on its own landed on Nephilim (now a near miss), and in parables-miracles four new labels collided with existing answers (removed).
