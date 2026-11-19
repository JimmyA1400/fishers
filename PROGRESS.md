# Fishers: launch progress

**Live URL:** https://jimmya1400.github.io/fishers/  (repo: https://github.com/JimmyA1400/fishers)

## Current step
11. Daily-cast freshness (started 2026-11-19)

## Next action
11.4: batch 1 live; twins now measured against the larger prompt; today reissued (all in 5a9278c). Next: draft batch 2 (20 more open prompts; ~84 open needed for the 14-day floor with 1 closed set a day).

## Checklist

### 0. Resumability
- [x] PROGRESS.md created
- [x] CLAUDE.md resume rule
- [x] git repo initialised (`main`), commit after every sub-step

### 1. State audit
- [x] (a) Bible-only content and guessing loop (retries, "did you mean", near misses, timeout): **done**
- [x] (b) Tiers 10/15/30/60/85/100, one Lost Sheep per prompt: **done** (enforced by `tools/validate.js`)
- [x] (c) Rebrand to Fishers (name, ichthys, Matthew 4:19 KJV, fishing copy): **done**
- [x] (d) Immersive descent redesign (camera, score panel, sink, reveal, end screen): **done**; known cosmetic: a tier line at a zone's depth can overlap that zone's label
- [x] (e) New categories and bank expansion: **done** (31 of 32 prompts; Psalm 119 letters dropped because the headings aren't in WEB/KJV text; the 5-sample review was approved 2026-11-17)
- [x] (f) Game-tester agent and report: done; every backlog item is fixed or re-measured (see section 10). G7 (mascot wardrobe) was left out on purpose: it is low priority and copies a reference-game feature

### 2. Repo hygiene
- [x] Secret scan (repo files): none found (telemetry endpoint empty, backend secret only named in docs)
- [x] Reference-game material gitignored and absent from history (checked before the first commit)
- [x] Allowlist build into `_site/` (`tools/build-site.js`)
- [x] Deploy size report: 33 files, 1.70 MB (1.34 MB is data/prompts.json, minified; Pages gzips it)
- [x] LICENSE, credits screen, footer, fan-project notice

### 3. Sub-path
- [x] No absolute paths or localhost references in index.html, css, js (grep 2026-11-18)
- [x] Share text built from `location.origin + location.pathname`
- [x] Test under `http://localhost:XXXX/fishers/` with zero 404s

### 4. Same daily for everyone
- [x] Eastern-time date key (`Intl.DateTimeFormat`, America/New_York)
- [x] Countdown to midnight Eastern
- [x] Daily #N from launch date; streaks on Eastern date
- [x] Tests (Pacific device, UTC near midnight)
- [x] "Your stats are saved on this device" in How to Play
- [x] Old-key migration kept

### 5. Phone-first polish
- [x] viewport-fit=cover, 100dvh, safe-area insets
- [x] Input attributes, 16px font, above keyboard
- [x] Tap targets ≥ 44px, touch-action
- [x] Focus kept after Cast; blur on round end
- [x] performance.now() deadline timer, visibilitychange
- [x] Audio after tap, mute remembered; haptics
- [~] Landscape usable; reduced motion; 60 fps at 4× CPU (measured 46–59 fps in headless software rendering; water repaint fix applied)
- [x] navigator.share + clipboard fallback

### 6. PWA and link previews
- [x] manifest.webmanifest, icons 192/512/maskable, apple-touch-icon, favicons
- [x] sw.js (versioned precache, network-first data, cleanup, update toast)
- [x] Install hints (Android prompt, iOS tip)
- [x] OG/Twitter tags + 1200×630 og:image (absolute URL after first deploy)
- [x] Self-hosted font, no third-party requests, robots noindex

### 7. Deployment
- [x] Prerequisites (git, gh auth, user.name/email)
- [x] Public repo `fishers`, push main
- [x] `.github/workflows/deploy.yml` (test → build → deploy)
- [x] Enable Pages (build_type=workflow)
- [x] Green run, URL recorded, HTTPS

### 8. Release gate
- [x] All items in RELEASE_CHECKLIST.md pass on the live URL (2026-11-18, build 3349ed9; frame rate under 4× throttle is a known limit)

### 9. Hand-off message
- [x] Sent (2026-11-18)

### 10. After launch
- [x] Phone issues: Back gesture fixed (F-04, 2e80f28); sink lightened (e1bdce6); 4x-throttled frame rate 40-52 fps in headless runs (see Known limits)
- [x] Descent leftovers: tier line at a zone's depth no longer runs through the zone label
- [x] Verse refs in The Catch (#6): live in 5925f2e, smoke OK
- [x] Lost Sheep suspense beat (#9): live in faa0320, smoke OK
- [x] Learn-more drawer (#14): live in 7ac965c, smoke OK; passages are WEB text, checked by `npm run verify`
- [x] Alias overlaps (#15): live in 14e6077, smoke OK; 5 bad aliases dropped via NOT_ALIAS in tools/derive.js, Thaddaeus and Simon the Zealot no longer take "Judas"/"Simon"; 10 genuinely shared KJV spellings marked reviewed (SHARED_OK in validate.js); warnings 58 -> 10 (the rest are tier-balance notes)
- [x] Reduced-motion veil frames (F-06): re-measured 2026-11-18, Practice, reduced motion, Pixel 7, 6 sinks: at 1x 0-1 frame over 50 ms per sink (56-60 ms), was 3 per sink (worst 167 ms). Fixed by the quantized water repaint (launch week). Left: a one-off first-reveal layout (~40 ms real; 145-257 ms at 4x CPU); later reveals 13-26 ms at 4x. No code change
- [x] Sink frame rate (#13): live in e1bdce6, smoke OK. Desktop 1440x900 software: 28-37 -> 35-45 fps (same-session A/B); with the GPU on: 57-58 fps after the first sink. Phone 4x CPU stays CPU-bound (26-37 fps on this machine today)
- [x] Theme of the week (#11): live in 8e4f711, smoke OK; 7 themes with 7+ prompts rotate each Monday (Eastern); reading = the theme verses already checked by verify.js
- [x] Group cast (#10): live in b4a8f6a, smoke OK; a code gives the same 7 prompts on every device, invite link ?group=CODE, results compared by sharing cards. A live leaderboard needs a backend and your privacy approval (not built)
- [x] Full release gate on the live URL: build `642d1be`, 117 / 118 (only miss: the extra 4× CPU frame-rate measurement, 40–52 fps between runs); Lighthouse live mobile 98/100/100, desktop 92/100/100, CLS 0; RELEASE_CHECKLIST.md updated
- [x] Layout shift on home (CLS 0.023 from the theme link): fixed in 642d1be
- [x] Phone dialogs (your report 2026-11-18: How to fish cut off at the top, "Back to the boat" unreachable): fixed in e5350a6. Dialogs are sized with 100dvh minus safe-area insets, the title and close button are pinned, dialogs open at the top. `tests/playthrough/phone-ui.js` checks every dialog and page on iPhone SE, iPhone 13 and Pixel 7 with browser bars, 360x560 and landscape (203 checks). Found on the way: `overscroll-behavior: contain` can swallow the next tap, so it is not used
- [x] No sink on iPhone (your report 2026-11-18: Safari "jumps to result"): a device asking for reduced motion used to get a cross-fade instead of the sink. Fixed in 6fb91c4: by default such devices get a calm sink (shorter, steady, no parallax, bubbles or wobble) and everyone else is unchanged; Settings > Animations offers match device / full / calm / off. Checked live: calm 21 depth steps to 850 m, full 39, off jumps. Not yet confirmed on your iPhone
- Optional, only if you ask: custom domain; a shared group leaderboard or player percentile (needs a backend and your privacy approval); a feedback form; removing `noindex` so search engines list the game

### 11. Daily-cast freshness
- [x] 11.0.1 Cause of the repeats (`node scripts/list-dailies.js 2026-11-19`). The picker gave every category a turn in a shared rotation and walked each category's own prompts. Four categories have only one open prompt (Nations & Peoples: `nations`; Books of the Bible: `revelation`; Parables & Miracles: `parables-miracles`; Trades & Callings: `occupations`), so whenever their category came up, the same prompt came back, every 1 to 2 days. With 11 open categories and 6 open slots a day, that is most days.
  - Aired so far: #1 2026-11-17, #2 2026-11-18 (`occupations` again after 1 day), #3 2026-11-19 (`revelation` from yesterday; `nations` and `parables-miracles` from 2 days ago).
  - Next 14 days under the old code: 14 of 14 repeat a prompt from the last 14 days, 13 share 1 to 4 prompts with the day before (2026-11-22 would have shared 4).
- [x] 11.0.2 Today and past days are kept exactly as aired (they are backfilled into the schedule).
- [x] 11.0.3 Hotfix: shipped as the schedule itself, live in 32a67a6 (CI run 44480502317 green, schedule check in the test job). Live check 2026-11-19: schedule.json matches the repo; today unchanged; tomorrow 2026-11-20 = schedule.json and shares nothing with the 7 days before it; archive 11-17 and 11-18 replay what aired; Endless #1 has nothing due in the next 9 days (the bank is too small for 14); smoke OK
- [x] 11.1-3 Families (`tools/families.js`, 27 families, every prompt has `family`; `--check` in `npm run verify`), rules and checker (`js/schedule.js`), `scripts/build-schedule.js` -> `data/schedule.json` (2026-11-17 to 2027-12-24, 403 days; 11-17..11-19 backfilled from the old picker), game reads it, runtime fallback past the end
- [ ] 11.4 Pool growth (batches of 20 for your review)
  - [x] Batch 1 (20 open prompts) approved 2026-11-19; in `content/generated/`, families in FAMILIES, IDs in the ledger; `scripts/schedule-rules.json` tightened to cooldown 12 (closed sets still up to 4). Checks: verify all verified, validate 0 errors / 18 warnings, 67 tests pass, schedule check OK, days through 2026-11-20 unchanged. Live in 87d866c (CI run 44623602392 green; release gate 118/118 locally; live smoke OK on 87d866c; live prompts.json and schedule.json match the repo; 2026-11-19 and 11-20 unchanged, first new day 2026-11-21 with romans-anything).
  - [x] 2026-11-19, 5 pm Eastern: at your request, today was reissued (it repeated revelation from 11-18 and nations and parables-miracles from 11-17); 11-20 re-picked with it. Players who had already started keep the original seven. `build-schedule --repick`, and `REISSUED` in check-schedule records the change so CI accepts exactly it. Same commit: twins measured against the larger prompt (4 pairs instead of 44); every book prompt now airs 12-25 times a year, Isaiah and Psalms included. Live in 5a9278c (CI green, live schedule matches the repo, live smoke OK).
  - [ ] Batch 2
- [x] 11.5 Endless (`endlessIds`) and Practice skip prompts due as a daily in the next 14 days; Endless intro says casts refresh as new dailies air. With 95 prompts, 82 are in the next 14 dailies, so for now Endless uses the prompts due furthest out (10+ days) and Practice falls back to the latest-due prompts in a category; the full 14 days needs the bigger pool
- [x] 11.6 `scripts/check-schedule.js` in CI (rules in force, 60+ days ahead, frozen dates vs the previous commit's schedule, aired days vs the old picker), `tests/schedule.test.js` (9 tests: aired days, a year of rules, checker catches breaks, ID ledger `content/prompt-ids.list`, retired prompts, fallback, freeze, Endless), `scripts/print-week.js`; 67 tests pass
- [ ] 11.7 Ship, verify live, report

**Pool math.** 7 prompts a day with a 30-day cooldown needs 7 x 30 = 210 prompts in rotation; with at most 1 closed set a day, 6 of the 7 must be open prompts, so a 30-day cooldown needs 180 open prompts plus 30 closed sets. Before batch 1 the pool was 95: 38 open and 57 closed (38 open prompts at 6 a day come back every 6.3 days); after batch 1 it is 115, 58 open. So the 14-day hard floor with at most 1 closed set a day needs at least 84 open prompts. **The current pool cannot meet the rules in section 1**; see "Blocked on me".

## Decisions made
- Git identity is set locally to the GitHub account `JimmyA1400` with its no-reply email, so no personal email appears in public commits.
- The reference game's comparison scripts (`tests/playthrough/krillion*.js`), all test results, `reports/` and the game-tester agent notes are gitignored and were never committed.
- Branches: one per section (`chore/site-build`, `feat/eastern-daily`, `feat/phone-polish`, `feat/pwa`, `ci/pages-deploy`), merged into `main` with `--no-ff` once their tests pass.
- Code is MIT-licensed (LICENSE); change it if you prefer another license.
- The WEB and KJV texts are pinned gzipped in `tools/texts/` (3.2 MB, public domain) so CI verifies against the exact text the bank was checked with. They are not in the published site.
- The JetBrains Mono font (OFL 1.1) is self-hosted from `fonts/`; no Google Fonts requests.
- og:url and og:image are stamped with the Pages URL at build time (`SITE_URL` from configure-pages), so the link preview is absolute after the first deploy without a second edit.
- Telemetry stays off (`js/config.js`); no analytics or trackers.
- `robots: noindex` is on for now (friends only). Remove the meta tag in `index.html` later to be searchable.

## Blocked on me
- **Pool size vs the freshness rules (section 11).** With 115 prompts (after batch 1) the rules you set cannot all hold, so `scripts/schedule-rules.json` relaxes two of them until new prompts are approved: cooldown 12 days (was 9 before batch 1) (target 14+, floor 7) and up to 4 closed sets a day (target 1). The cost: most days have 4 closed sets. Everything else is as specified (pairs <= 2 per year, order, families, People/Places <= 2, 4+ categories, back-to-back). Each approved batch of open prompts lets me tighten these; the rules file is deleted once the pool reaches the target (about 180 open prompts for a 30-day cooldown, 84 for the 14-day floor).

## Waiting for my review
### Batch 1: 20 new open prompts (drafted 2026-11-19; APPROVED 2026-11-19, live in 87d866c)
Full bank with every answer, tier, reference and note: `review/batch-1.md` (built by `node tools/build-prompts.js --pending batch-1 --out review/batch-1.json`). Sources: `tools/batches/batch-1.js`, `tools/lib/things.js`; generated files now in `content/generated/` (were `content/pending/batch-1/` during review).

| ID | Prompt | Category | Answers | Lost Sheep | First Mustard Seeds |
| --- | --- | --- | --- | --- | --- |
| `exodus-anything` | Name a person, place, or thing named in the book of Exodus. | Books of the Bible | 406 | Aholiab | Moses, Egypt, Aaron, Pharaoh |
| `numbers-anything` | Name a person, place, or thing named in the book of Numbers. | Books of the Bible | 495 | Eldad | Moses, Aaron, Balak, Eleazar |
| `joshua-anything` | Name a person, place, or thing named in the book of Joshua. | Books of the Bible | 563 | Achsah | Joshua, Jordan, Moses, Manasseh |
| `1samuel-anything` | Name a person, place, or thing named in the book of 1 Samuel. | Books of the Bible | 383 | Ichabod | Saul, David, Philistine, Samuel |
| `job-anything` | Name a person, place, or thing named in the book of Job. | Books of the Bible | 379 | Jemimah | Job, Hand, Word, Eye |
| `psalms-anything` | Name a person, place, or thing named in the book of Psalms. | Books of the Bible | 547 | Doeg | David, Mount Zion, Praise, Heart |
| `proverbs-anything` | Name a person, place, or thing named in the book of Proverbs. | Books of the Bible | 323 | Lemuel | Heart, Fool, Understanding, Wisdom |
| `isaiah-anything` | Name a person, place, or thing named in the book of Isaiah. | Books of the Bible | 616 | Shear-Jashub | Jerusalem, Jacob, Hand, Assyria |
| `jeremiah-anything` | Name a person, place, or thing named in the book of Jeremiah. | Books of the Bible | 529 | Ebed-melech | Judah, Babylon, Zion, Jeremiah |
| `ezekiel-anything` | Name a person, place, or thing named in the book of Ezekiel. | Books of the Bible | 444 | Jaaz-aniah | House, Egypt, Hand, Side |
| `daniel-anything` | Name a person, place, or thing named in the book of Daniel. | Books of the Bible | 196 | Melzar | Daniel, King, Nebuchadnezzar, Abednego |
| `matthew-anything` | Name a person, place, or thing named in the book of Matthew. | Books of the Bible | 405 | Azor | Jesus, John, Peter, Judea |
| `john-anything` | Name a person, place, or thing named in the book of John. | Books of the Bible | 226 | Salim | Jesus, Peter, Simon, Pilate |
| `acts-anything` | Name a person, place, or thing named in the book of Acts. | Books of the Bible | 403 | Rhoda | Paul, Jesus, Jerusalem, Peter |
| `romans-anything` | Name a person, place, or thing named in the book of Romans. | Books of the Bible | 211 | Tertius | Jesus, Law, Sin, Faith |
| `hebrews-anything` | Name a person, place, or thing named in the book of Hebrews. | Books of the Bible | 207 | Salem | Jesus, Moses, Faith, Priest |
| `sins` | Name a sin or vice the Bible warns against. | Words & Virtues | 74 | Menstealers | Wrath, Lying, Violence, Pride |
| `virtues` | Name a virtue or good quality the Bible commends. | Words & Virtues | 63 | Simplicity | Peace, Love, Faith, Joy |
| `structures` | Name a kind of building or structure mentioned in the Bible. | Objects & Treasures | 73 | Draught house | House, Gate, Tabernacle, Wall |
| `land-and-sky` | Name a feature of the land, sea or sky, or a kind of weather, mentioned in the Bible. | Creation | 61 | Arcturus | Fire, Mountain, Sea, Sun |

Checks on the batch: `tools/verify.js` all verified (every name and alias found at its cited verse in the WEB or KJV); `tools/validate.js` 0 errors, 18 warnings (Mustard Seed counts of 13-15 in some book prompts; "Israel" landing on Jacob; "Emmanuel" landing on Jesus). Every common answer I tried lands (Moses, Sinai, the burning bush, Goliath's sling, Job's boils, wisdom in Proverbs, the wise men, Meshach).

How the book prompts work: every person whose name the book's verses use, every place OpenBible lists in the book, and every listed thing (objects, clothing, creatures, food, plants, buildings, land and sky, beings such as Satan and the cherubim, feasts, false gods, occupations, body parts, illnesses; abstract words for Job, Psalms, Proverbs, Romans and Hebrews) that the book's verses use, each cited at a verse in the book. Words that are also common verbs ("bow", "saw", "lead", "bear") are left out unless a verse is given. Tiers count only that book's verses; things count at a third, so people and places come first. All tiers are estimates.

Decisions for you:
1. **God is not an answer** in the book prompts (as in the people prompts); typing God gets a near miss. Say if you want God counted.
2. **Twins.** Measured as you specified (50% of the smaller prompt's answers, same family), the book prompts are mostly twins of each other: they share the big names and common things. The schedule treats twins as one prompt for the cooldown, so they spread out but rarely air. Measuring against the larger prompt instead makes only 2 pairs twins, and gains only one cooldown day. I kept your definition.
3. **New category "Creation"** for land-and-sky.

What batch 1 buys (simulated, rules otherwise as specified): best cooldown 9 -> 12 days with up to 4 closed sets a day (average 13.2 -> 15.9). The limit is still open prompts outside People and Places: a 14-day cooldown with 1 closed set a day needs about 84 open prompts; with batch 1 there are 58.

Found on the way (uncommitted fixes, waiting with the batch): `content/prompt-ids.txt` was read by `tools/build-prompts.js` as a prompt file and broke any rebuild of the bank (renamed to `content/prompt-ids.list`; the live site was not affected); the schedule check and test recomputed the three aired days from the current pool, which would fail as soon as any prompt is added (they are now fixed lists).
