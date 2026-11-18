# Fishers

**The Daily Cast · a Bible trivia game**

> "Follow me, and I will make you fishers of men." (Matthew 4:19, KJV)

A wooden boat on the Sea of Galilee at dawn. Seven prompts from Scripture each day, many right answers to each, and the rarer your answer, the deeper your net sinks.

The whole game happens inside one painted world: a tall strip from the dawn sky, past the boat at the waterline, down through water that darkens from sunrise teal to near-black at 7,000 m. A camera follows the ichthys fish on the end of the net rope; 1 metre is 1 pixel. A depth gauge runs down the right edge, and verses about the sea mark the zones on the way down. Somewhere near 1,530 m a school of exactly 153 fish swims past (John 21:11).

## Play

**Live:** https://jimmya1400.github.io/fishers/

- **From disk:** double-click `index.html`.
- **On the web:** every push to `main` runs `.github/workflows/deploy.yml`: the tests and the Scripture check run first, then `tools/build-site.js` copies only the game files into `_site/`, stamps the version (commit SHA) into the service worker and the About screen, and deploys to GitHub Pages. Players with the game open get a "New version available" toast.
- **Test the built site locally under a sub-path:** `node tools/build-site.js && node tools/serve-subpath.js`, then open http://localhost:8790/fishers/.
- **Release gate:** `cd tests/playthrough && node release-gate.js --url <site url>`.

### How a round works

1. **Cast the net** on the home screen: the title lifts away, the camera pans down below the waterline, and the score panel (depth, seven progress squares, score) slides in.
2. The prompt card rises into the water, and the clock starts after "3 … 2 … 1".
3. Type an answer and press **Cast**. Wrong guesses cost nothing: keep casting until something lands or the 25 seconds run out. The ring around the seconds drains and turns red under 5 seconds.
4. A miss shakes the box ("not in the net"). A close spelling shows `"prodigle son" → "Prodigal Son"` and puts the answer in the box: cast again to confirm, or edit. A near miss (a tradition, or an answer just outside the prompt) explains what Scripture says.
5. When an answer lands, it hangs on the net as a tag and sinks by its points × 10 m, passing a dotted line for each tier. The tag takes each tier's color as it passes, and the result shows the tier, the answer, its verse and a note. If the clock runs out, nothing landed.
6. After the seventh cast, **Pull up the net**: the fish rises to the surface and the results open: the cast log, your bearing, the share text, and The Catch, where every prompt opens to its whole bank of answers.

While you type, Fishers offers a spelling: grey ghost text after the cursor, and a chip under the box for phones. Tab, the right arrow, or tapping the chip fills it in; Enter always casts exactly what is in the box. Completions come from every name the Bible capitalizes plus every answer label in the bank, most familiar first, so they help with spelling ("Nebu" → Nebuchadnezzar) without saying whether a word is valid for the prompt in front of you.

| Tier | Points | |
| --- | --- | --- |
| 🌱 Mustard Seed | 10 | the answer everyone gives |
| 🪑 Best Seat | 15 | you thought it was the place of honor (Luke 14:8–10) |
| 🍞 Five Loaves | 30 | a common answer |
| 🪙 Lost Coin | 60 | genuinely uncommon |
| 💎 Hidden Treasure | 85 | a deep cut |
| 🐑 The Lost Sheep | 100 | the one out of a hundred (Luke 15:4) |

Each point sinks the net 10 metres; 700 points is 7,000 m. Verses about the sea and the deep mark the way down, from Luke 5:4 near the surface to Micah 7:19 on the floor. The fish takes the color of its last catch, and turns gold for a Lost Sheep.

The corner buttons are the menu (how to play, your logbook, back to shore, credits), sound, and settings. Sound is off until you turn it on; every sound is made in the browser with the Web Audio API, so there are no audio files.

### Modes

- **Daily Cast:** seven prompts, the same for everyone, numbered from Fishers #1 (17 November 2026). No two prompts share a category, and exactly one is a closed set. The closed sets take turns in their own rotation, so each comes round about once every two months (57 closed sets); the other six slots rotate the categories that have open prompts as evenly as the one-per-category rule allows, and each category walks through its own prompts in turn.
- **Endless Casts:** numbered casts of seven built by the same rules (Endless Cast #1, #2 …), each replayable.
- **Archive:** replay any earlier daily by date.
- **Practice Waters:** single prompts, by category, with or without the timer.

Only the Daily Cast counts toward the streak and stats. Everything is kept in `localStorage` under `fishers.v1`; players of the game's earlier version have their streak and stats copied across once.

### Sharing

The results screen ("Pull up the net") has a Copy button for:

```
Fishers #12 🐟
310 / 700
🌱🪙⬛💎🍞🐑🌱
https://…
```

`index.html` points its Open Graph image at `assets/og-image.png` with a relative path. Some sites need an absolute address, so after deploying, change that `og:image` line to the full URL. `assets/og-image.html` is the source the PNG was made from.

## Files

```
index.html               the page
assets/                  favicon and Open Graph image
css/styles.css           base styling: buttons, dialogs, type-ahead
css/world.css            the world: sky, water, kelp, gauge, zones, fish, rope, tier lines
css/hud.css              everything over the world: home, score panel, prompt card, input bar, results
js/config.js             settings: timer, prompts per day, Fishers #1 date, telemetry switch
js/matcher.js            answer matching: exact, near miss, suggestions
js/round.js              one round of guessing, independent of the page
js/typeahead.js          spelling completions from the Bible-wide word list
js/daily.js              seeded casts: daily, endless
js/storage.js            streak, stats and casts in localStorage (with the one-time migration)
js/scene.js              the world and its camera: layers, parallax, the fish and rope, bubbles
js/icons.js              the six tier icons (sprout, chair, loaves, coin, chest, lamb)
js/sound.js              generated sounds, off by default
js/share.js              the spoiler-free result text
js/telemetry.js          optional answer and score logging, off by default
js/game.js               screens and game flow
content/                 THE SOURCE of all content (see below)
data/prompts.json        built from content/; the game reads this
data/prompts.js          the same, for opening index.html from disk
tools/                   build and verification scripts
tests/                   Node tests: node --test tests/*.test.js
backend/                 optional answer counter and tier recalculation
review/prompts.md        every prompt and answer, for proofreading
```

## Building the prompt bank

The bank is built from the Bible text itself. You need Node 18 or later.

```bash
node tools/fetch-sources.js
```

```bash
node tools/derive.js
```

```bash
node tools/build-prompts.js
```

```bash
node tools/verify.js
```

```bash
node tools/validate.js
```

```bash
node tools/sync-data.js
```

1. **fetch-sources** downloads the sources into `tools/.cache/` (not part of the site).
2. **derive** generates the large people, place and noun prompts into `content/generated/` from the sources, using the settings in `tools/derive-config.js` and `tools/derive-nouns.js`.
3. **build-prompts** turns every file in `content/` into `data/prompts.json` and sets the tiers.
4. **verify** checks every answer against the Bible text and **fails on any mismatch**: each name and alias must appear, as whole words, in the WEB or KJV at a verse it cites. Every reference must exist, and every quoted verse must match the WEB (or the KJV where credited) word for word. Accepted forms that cannot be checked this way ("1 Cor", "Dead Sea", parable titles) are listed in `tools/reports/forms.txt` for review by hand.
5. **validate** checks the game rules:
   - 60 answers per prompt, unless the prompt is marked closed (closed sets need at least 6, such as the armor of God);
   - exactly one Lost Sheep and at most one Best Seat;
   - no near miss colliding with an answer;
   - every name landing on itself in the matcher.
6. **sync-data** refreshes `data/prompts.js`.

`node tools/spot-check-people.js` lists generated people answers whose cited verses use the name like a place, plus a random sample, in `tools/reports/people-spot-check.txt`; names found not to be people go in the exclusion list in `tools/derive.js`. `node tools/review-doc.js` writes `review/prompts.md`, every prompt with its full bank, tiers, picks and near misses, for proofreading. `node tools/show-verses.js "Lev 11:13-19"` prints the WEB and KJV of any passage, and `--find "sea gull"` searches both.

### Writing content by hand

Hand-written prompts live in `content/*.txt`:

```
@ creatures | Creatures | Name an animal, bird, or creature mentioned in the Bible. | deep | nouns
Lion | Judg 14:5-6; Dan 6:22 | Samson tore one apart; Daniel was kept safe among them.
  tier: 1
Unicorn; Wild ox | Num 23:22; Job 39:9 | The KJV reads unicorn where the WEB reads wild ox.
  sheep: The King James Version mentions the unicorn nine times; the Hebrew word is a wild ox (Numbers 23:22).
Leviathan | Job 41:1; Ps 104:26 | The great sea creature God made to play in the sea.
  seat: Leviathan appears in Job 41, Psalm 74:14, Psalm 104:26 and Isaiah 27:1.
? Cat; cats | The cat appears only in the Letter of Jeremiah (Baruch 6:22), outside the 66 books.
```

- **Answer lines:** `Name; alias; alias | references | note`. Aliases must be in the text at a cited verse, so KJV spellings (Elias, Agar, Esaias) cite a verse where the KJV uses them.
- **Attribute lines** (indented):
  - `anchor:` on a description prompt, or on a single label answer in a name prompt ("Pilate's wife"): words, one of which must appear at the cited verses;
  - `forms:` accepted spellings that are not in the text;
  - `short:` abbreviations, which are suggested rather than accepted;
  - `tier:` a manual tier;
  - `sheep:` and `seat:` the picks, each with its fact.
- **Near misses:** lines starting with `?` are matched exactly and never by typo.
- **Prompt flags:**
  - `closed`: a fixed set under 60 answers (down to 6; small sets need a Mustard Seed and one Lost Sheep, and may leave middle tiers empty);
  - `nouns`: singular and plural agree;
  - `phrase` and `described`: answers are descriptions, checked by an anchor word in the passage;
  - `books`: answers are the 66 book names;
  - `ignore=word,word`: words dropped before matching.

### How tiers are set

Each answer starts from a mechanical familiarity score: the number of verses in the WEB and KJV that use its name (names count only where capitalized, so "Mark" is not "mark"). The most familiar ~5% (2 to 12 answers) become Mustard Seed, the next ~7.5% Five Loaves, the next ~20% Lost Coin, and the rest Hidden Treasure. A manual pass then corrects answers that are famous but rare in the text (Goliath, Eve) or frequent but forgettable. Description prompts and book names are tiered by hand. Every Lost Sheep and Best Seat is hand-picked with a fact. All of this is an estimate (`"rarity": { "estimated": true }`) until real answer data exists.

### Where the banks come from

| Source | Used for | Licence |
| --- | --- | --- |
| World English Bible (ebible.org) | the text everything is checked against; quoted verses | public domain |
| King James Version (ebible.org) | KJV spellings and the Matthew 4:19 tagline | public domain |
| Easton's Bible Dictionary (1897), via CCEL | which names belong to people, and the verses for each person | public domain |
| OpenBible.info Bible Geocoding Data | every place and the verses that mention it | CC BY 4.0, credited in the game footer |

Theographic Bible Metadata was considered but not used: it is licensed CC BY-SA 4.0, which would carry its share-alike terms over to the prompt bank.

## How answers are matched

1. Text is lowercased; accents, punctuation and possessives are removed. "First", "1st" and "I" at the start become "1"; number words become digits.
2. An exact name, alias or form is **accepted**. A plural or possessive "s" typed without an apostrophe also counts; on common-noun prompts, singular and plural agree.
3. An exact near miss shows its message, and the round continues.
4. Otherwise a **suggestion** is offered, never accepted on its own:
   - a short form ("1 Cor");
   - a fragment of five or more letters that starts an answer ("Melchiz");
   - a typo (Damerau-Levenshtein: one edit for 4–6 letters, two for 7 or more; numbers never change);
   - a shorter fragment of four letters.
   
   Ties go to the most common answer.
5. Anything else: "not in the net. Cast again."

Same-name people are one answer: "John" is John whichever John you mean, and "Judas Iscariot" lands on Judas.

## Content rules

- **Bible only:** every accepted answer is named in the 66 books of the Protestant canon, at a verse its reference points to.
- **Traditions are near misses:** extra-biblical traditions (the Magi's names, Dismas, Longinus, Veronica, the apple, Mary Magdalene as a prostitute) explain what Scripture actually says.
- **No disputed questions:** prompts do not turn on questions where faithful Christians disagree.
- **Translations:** quoted Scripture is from the WEB, with the KJV for famous phrasings (both public domain). No ESV or NKJV text is stored.

## Tests

```bash
node --test tests/*.test.js
```

The tests cover the matcher and the guessing round (exact, alias, KJV spelling, typo suggestion, confirming and editing a suggestion, prefixes, ties, near misses, misses, timeouts, possessives and book numbers) and the cast rules over two years of dailies and two hundred Endless casts.

## Collecting real data (optional, off by default)

1. Create a Cloudflare Worker from `backend/worker.js`. Give it a KV namespace bound as `COUNTS`, a secret named `EXPORT_KEY`, and a variable `ALLOW_ORIGIN` set to your site's address.
2. In `js/config.js`, set:

   ```js
   telemetry: { enabled: true, endpoint: 'https://YOUR-WORKER.workers.dev/log' }
   ```

3. **Tell your players.** With telemetry on, each Daily Cast guess sends the prompt id and the answer (the canonical name, or the normalized text for a miss), and each finished Daily Cast sends its number and score. No player id, no cookies, nothing from Practice, Archive or Endless. Players could type anything into the answer box, so add a line to your site saying guesses are counted anonymously.
4. The results screen then shows "better than X% of players", once at least 20 players have finished that day's cast.
5. To recalculate tiers, download `https://YOUR-WORKER.workers.dev/export?key=YOUR_EXPORT_KEY` as `counts.json`, then:

   ```bash
   node backend/recalc-tiers.js counts.json
   ```

   That is a dry run. Add `--write` to save the tiers to `content/real-tiers.json`, then rebuild. Prompts with fewer than 200 answers (change with `--min`) keep their estimates. The script also lists common unmatched answers, which is how missing answers are found.

## Accessibility

- Keyboard only: Enter casts, confirms a suggestion, and moves on.
- The prompt, the countdown, "10 seconds left", every guess result and every landing are announced through polite live regions.
- Focus rings are always visible; text and controls are designed for WCAG AA contrast on the dark water.
- When the device asks for reduced motion, camera pans become quick cross-fades, and parallax, shakes, wobbles and the cast-log animation are off.
- On phones the input bar stays above the on-screen keyboard, and every control is at least 44 px tall.
- Practice can be played without the timer.

## Licence notes

All art is original SVG and CSS drawn in `js/scene.js`, `js/icons.js`, `css/world.css`, `index.html` and `assets/`. Numbers use JetBrains Mono (SIL Open Font License), loaded from Google Fonts; without a connection they fall back to the system's monospace font.
