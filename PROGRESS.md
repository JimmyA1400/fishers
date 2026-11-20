# Fishers: launch progress

**Live URL:** https://jimmya1400.github.io/fishers/  (repo: https://github.com/JimmyA1400/fishers)

## Current step
12. Live Coal, the multiplayer mode (started 2026-11-20, branch `claude/live-coal-multiplayer-b829fb`). Section 11 is paused at 11.4 (batch 3 not drafted yet).

## Next action
12.6: waiting on the Cloudflare login and the two GitHub secrets (see "Blocked on me"). Then: `cd server && npx wrangler deploy`, put the real workers.dev URL in `js/config.js` (`liveCoal.server`), merge to main, CI deploys Worker then Pages, run `node tests/coal/e2e.js --site https://jimmya1400.github.io/fishers/` (and `--rtt 300`) against live.

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
  - [x] Batch 2 (20 open prompts, six new families) approved 2026-11-19; in `content/generated/`, families in FAMILIES, IDs in the ledger; `scripts/schedule-rules.json` cooldown 12 -> 16, closed sets 4 -> 3. Checks: verify all verified, validate 0 errors / 20 warnings, 67 tests pass, schedule check OK, days through 2026-11-20 unchanged; every prompt airs (7-23 times in the next year). Live in 9e3fc72 (CI run 44630944040 green; release gate 118/118 locally; live smoke OK; live prompts.json and schedule.json match the repo; 2026-11-19 and 11-20 unchanged).
  - [ ] Batch 3
- [x] 11.5 Endless (`endlessIds`) and Practice skip prompts due as a daily in the next 14 days; Endless intro says casts refresh as new dailies air. With 95 prompts, 82 are in the next 14 dailies, so for now Endless uses the prompts due furthest out (10+ days) and Practice falls back to the latest-due prompts in a category; the full 14 days needs the bigger pool
- [x] 11.6 `scripts/check-schedule.js` in CI (rules in force, 60+ days ahead, frozen dates vs the previous commit's schedule, aired days vs the old picker), `tests/schedule.test.js` (9 tests: aired days, a year of rules, checker catches breaks, ID ledger `content/prompt-ids.list`, retired prompts, fallback, freeze, Endless), `scripts/print-week.js`; 67 tests pass
- [ ] 11.7 Ship, verify live, report

### 12. Live Coal (realtime elimination mode)
Spec: your message of 2026-11-20 (rules, lobbies, architecture, edge cases, screens, deploy, tests, build order). Server in `server/` (Cloudflare Worker + one SQLite-backed Durable Object `Room` per room); the site stays on Pages.
- [x] 12.1 State machine + unit tests (no UI). `server/src/engine.js` is a pure `reduce(state, event, now, catalog)` with injected time and a seeded RNG in the state; `server/src/catalog.js` wraps `data/prompts.json` and the solo game's `js/matcher.js` (shared, not forked); `server/src/protocol.js` validates client messages and holds the rate limiter. `cd server && npm run test:unit`: 50 tests (timer schedule and presets, 40-minute floor, names, host rules and migration, only-holder submissions, clockwise pass, aliases as duplicates, same-name people as one answer, near miss / did-you-mean confirm, grace window and both alarm orders, the three round ends, never-repeated categories, category size and closed-set rules, early-easy / late-narrow, winner and recap, rematch with late joiners, disconnect / reconnect snapshot, everyone-leaves reset, kick while holding, typing, JSON round trip, protocol and rate limits).
  - Rules as built: a turn times out when the server clock passes deadline + 250 ms; every event first resolves any timer already due, so an answer and an alarm landing together give the same result in either order. Round-end checks after an accepted answer: net empty first, then "everyone still in has answered 3 times". Duplicates are grouped by canonical answer name. The 3x+10 size rule applies to every category; closed sets additionally need 10 spare answers after one rotation (so the Twelve fit 2 players, the 66 books up to 18, and the seven churches and the plagues never qualify). Categories are ranked by "ease" (answers in tiers 1-3); round 1 draws from the friendliest third and each round slides 10% toward narrower ones. A player disconnected in the lobby is dropped after 60 s (a refresh keeps the seat); in a game the seat stays.
- [x] 12.2 Worker + Durable Object + local dev. `server/src/index.js` (Worker: `/room/<CODE>` WebSocket upgrade, `POST /create`, `/health`; origin allowlist in `wrangler.jsonc` vars) and the `Room` class (hibernation API, attachment `{pid, cid}`, state saved after every change, one alarm = the engine's next timer, newest tab wins, rate limits). `server/wrangler.jsonc` declares `Room` in `new_sqlite_classes`; prompt data and the matcher are imported from `data/prompts.json` and `js/matcher.js` at bundle time. `cd server && npx vitest run`: 13 tests on real Durable Objects (routing and origins, a played turn, hibernation wake-up mid-game, alarm timeout before and after eviction, reconnect snapshot with the live deadline, two tabs, kick, bad messages and flooding, everyone-leaves reset and 10-minute deletion). Local dev: `.claude/launch.json` "live-coal-server" (`wrangler dev` on 127.0.0.1:8787) + "fishers" (site on :8765); on localhost the client uses the local Worker, `?coal=<url>` overrides, `?seat=N` gives a tab its own player.
  - Notes: `@cloudflare/vitest-pool-workers` (as specified) is now deprecated in favour of `@cloudflare/vitest-plugin`; it still works with vitest 4. Its bundled workerd supports compatibility dates up to 2026-08-22, so `compatibility_date` is 2026-08-15. The Worker's main module may only export handlers, so room-code helpers are in `src/rooms.js`.
- [x] 12.3 Lobby, The Shore, private rooms, names, reconnect (`js/coal-net.js`, `js/coal.js`, `css/coal.css`; "Live Coal" button on the home screen; routes `#/coal` and `#/coal/ABCD`). Name + fish colour + token in localStorage; lobby list with fish, connection dots, host/you tags, ready count, timer preset (host), Start (host, 2+), Remove with a second confirm tap, Share room, Create a private room, Join a code, change name.
- [x] 12.4 Game screen: fire of coals with fish on it, seats in a circle, the coal flying in an arc (~300 ms) and dimming from orange-white to grey-red as the turn drains, a draining ring + seconds on the holder's seat, flicker under 3 s, live typing for watchers, feedback line (not in the net / already said by X / near miss / did you mean), "Said this round" coloured by tier, smoke + "Their coal went out" + banner, round intro with countdown, game over with recap (place, round lasted to, answers, rarest), Rematch / Back to lobby / Share result.
  - `tests/coal/e2e.js` (Playwright, 4 contexts: 2 desktop, Pixel 7, iPhone 13) passes locally against `wrangler dev`: private room, live typing, clocks in sync (spread 1 ms), duplicate, typo + Enter confirm, phone disconnect / reconnect to the same seat mid-turn, three timeouts, winner, rematch. Screenshots in `tests/coal/results/` (gitignored).
- [x] 12.5 Phone polish, sound, accessibility. Input bar stays above the phone keyboard (shares the solo game's `--kb`), stage shrinks while typing; 16px+ input with no autocorrect and `enterkeyhint="go"`, focus kept between attempts; vibration at 3 s; sound off by default (Web Audio crackle loop, whoosh on pass, tick under 3 s, hiss on elimination; on for one e2e player so it runs); aria-live for turns, your-turn alerts, eliminations and the winner; reduced motion stops the fire, flicker and smoke. `tests/coal/a11y.js`: keyboard-only from name to game over, axe (WCAG 2.1 AA) on setup, lobby, game and game over with no serious or critical issues. A server that cannot be reached shows "Could not reach the fire" after 5 tries; a protocol mismatch shows "Refresh to update".
  - Load (`tests/coal/load.js`, 10 rooms x 16 bots at once against `wrangler dev`): 0 socket errors, server handoff (answer in -> next turn out, including the storage write) p95 at most 5 ms, max 5 ms; client-side submit -> next turn p95 17 ms. About 127 messages in and 1,860 out per room-minute.
  - Worker bundle 2.5 MB raw / 455 KB gzip (Free has no compressed limit; 64 MB raw). Building the catalog and compiling all 135 prompts takes ~105 ms, so it runs at startup (1 s budget), not inside a message (the Free plan may give a message only 10 ms of CPU); the slowest answer check is ~2 ms. Wrong guesses no longer write to storage.
  - **Free-tier budget** (Cloudflare docs read 2026-11-20: 100,000 DO requests/day incl. alarms and new WebSocket connections; incoming WebSocket messages count 20:1, outgoing are free; 13,000 GB-s/day; 100,000 SQLite rows written/day, each `setAlarm` is one; Workers 100,000 requests/day). One 8-player game, about 14 minutes, ~9 rounds, ~135 turns:
    - incoming messages: ~9 per turn (8 typing updates + 1.3 submits) = ~1,260; time-sync pings 5 per 30 s per player = ~1,120; lobby and start ~40. Total ~2,420 / 20 = **~121 requests**
    - WebSocket connections (8 joins + ~8 reconnects): 16; alarms (9 intros, 9 pauses, 7 timeouts, ~6 host / lobby / cleanup): ~31. **DO total ~168 requests per game**
    - Worker requests: 16 upgrades + 1 create = ~17 per game
    - rows written: one state write + one `setAlarm` per turn, plus round changes, suggestions and joins: ~400 per game
    - duration: the room stays awake during play (it hibernates only when quiet): 840 s x 0.125 GB = ~105 GB-s per game
    - **50 games a day**: DO requests ~8,400 (8% of 100,000), Worker requests ~850 (under 1%), rows written ~20,000 (20%), duration ~5,250 GB-s (40% of 13,000). Duration is the tightest; ~120 such games a day would reach the free duration limit. Idle lobbies hibernate and cost almost nothing.
- [x] 12.5b Design pass (your request 2026-11-20: closer to the theme, more realistic coals, as good as the main game). New `js/coal-art.js` draws everything as inline SVG in the main game's flat layered style: night sky with moon and stars, the main game's hills and scalloped water edge (moonlit), moonlight on the water, the boat pulled up on the beach with a net drying. The fire is a stone ring round a bed of black charcoal lumps with glowing seams and white ash, a few burning through, low flames, rising sparks, two fish laid on the coals and a loaf on a flat stone (John 21:9). The live coal is a charcoal lump whose heat drives the vein glow, rim and under-glow; grey ash creeps over it as the turn drains. Panels, buttons, ring timer, feedback pill and tier colours are the main game's (glass, gold accent, `--t1..--t6`). Game over: the winner's fish by a small fire and John 21:9 (KJV, checked against the pinned text). Fixed on the way: a stale Shore connection could toast "You left the room" in a new room; the coal's flight lost its centring mid-arc. e2e (4 players) and a11y pass.
- [ ] 12.6 CI + deploy; 4-player end-to-end on the live site and Worker. Workflow ready: `coal-test` (unit + workerd tests) and `coal-deploy` (`cloudflare/wrangler-action@v3`, then checks the live `/health` protocol) run before the Pages `deploy` job; without the two secrets the Worker deploy is skipped with a warning. **Blocked on you** (see "Blocked on me").
- [ ] 12.7 Hand-off

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
- **Live Coal deploy (12.6).** Wrangler here says "Not logged in. Your auth token has expired", and the repo has no Cloudflare secrets. Please:
  1. If you have no Cloudflare account yet, create a free one at https://dash.cloudflare.com/sign-up (the expired token suggests you may already have one).
  2. In a terminal: `cd "C:\Theology Game\.claude\worktrees\live-coal-multiplayer-b829fb\server"` then `npx wrangler login` and approve in the browser. If you have never used Workers, also open Workers & Pages in the dashboard once so it assigns your `<name>.workers.dev` subdomain.
  3. For CI: https://dash.cloudflare.com/profile/api-tokens > Create Token > template "Edit Cloudflare Workers" > Continue > Create; copy it. Your Account ID is on the Workers & Pages overview (right side). Then `gh secret set CLOUDFLARE_API_TOKEN` and `gh secret set CLOUDFLARE_ACCOUNT_ID` (each prompts for the value; never paste them in chat).
  4. Tell me when done. I then deploy, set the URL in `js/config.js` (currently a guess: `https://fishers-live-coal.jimmya1400.workers.dev`), merge, and run the live 4-player test.
- **Pool size vs the freshness rules (section 11).** With 135 prompts (78 open, after batch 2) one rule still cannot hold: at most 1 closed set a day. `scripts/schedule-rules.json` allows up to 3 (was 4) and sets the cooldown to 16 days (above the 14-day floor; target 30). Everything else is as specified (pairs <= 2 per year, order, families, People/Places <= 2, 4+ categories, back-to-back). Each approved batch of open prompts lets me tighten these; the rules file is deleted once the pool reaches the target (about 180 open prompts for a 30-day cooldown).

## Waiting for my review
### Batch 2: 20 new open prompts (drafted 2026-11-19; APPROVED 2026-11-19, live in 9e3fc72)
Full bank with every answer, tier, reference and note: `review/batch-2.md` (built by `node tools/build-prompts.js --pending batch-2 --out review/batch-2.json`). Source: `tools/batches/batch-2.js`; generated files now in `content/generated/`.

Why these: a family airs at most once a day, and the book-scoped family already has 17 prompts, so more book prompts would add nothing to the schedule. Batch 2 is six new families: Bible stories (9), people by first letter (4), places by first letter (4), family words, feelings, and times and seasons.

| ID | Prompt | Category | Answers | Lost Sheep | First Mustard Seeds |
| --- | --- | --- | --- | --- | --- |
| `creation-to-flood` | Name a person, place, or thing in the Bible's first chapters, from the Creation to the Flood (Genesis 1–9). | Bible Stories | 125 | Gopher wood | Noah, Adam, Ark, Eden |
| `abraham-story` | Name a person, place, or thing in the story of Abraham (Genesis 12–25). | Bible Stories | 240 | Beer-lahai-roi | Abraham, Sarah, Isaac, Lot |
| `jacob-story` | Name a person, place, or thing in the story of Jacob and Esau (Genesis 25–36). | Bible Stories | 250 | Penuel | Jacob, Esau, Isaac, Laban |
| `joseph-story` | Name a person, place, or thing in the story of Joseph (Genesis 37–50). | Bible Stories | 239 | Asenath | Joseph, Pharaoh, Egypt, Jacob |
| `david-solomon` | Name a person, place, or thing in the reigns of David and Solomon (2 Samuel to 1 Kings 11). | Bible Stories | 592 | Rizpah | David, Zion, Solomon, Saul |
| `elijah-elisha` | Name a person, place, or thing in the stories of Elijah and Elisha (1 Kings 17 to 2 Kings 13). | Bible Stories | 313 | Zarephath | Ahab, Elijah, Elisha, Samaria |
| `christmas-story` | Name a person, place, or thing in the Christmas story (Matthew 1–2 and Luke 1–2). | Bible Stories | 133 | Anna | Mary, Joseph, Jesus, David |
| `sermon-on-the-mount` | Name a person, place, or thing Jesus speaks of in the Sermon on the Mount (Matthew 5–7). | Bible Stories | 109 | Bushel | Heaven, Kingdom, Love, Lamp |
| `passion-week` | Name a person, place, or thing in Luke's account of Jesus' last week, from Palm Sunday to the empty tomb (Luke 19–24). | Bible Stories | 152 | Joanna | Jesus, Jerusalem, Pilate, Peter |
| `people-a` | Name a person in the Bible whose name begins with A. | People | 157 | Agabus | Aaron, Abraham, Adam, Abel |
| `people-j` | Name a person in the Bible whose name begins with J. | People | 125 | Jabez | Jesus, Jacob, Joseph, Joshua |
| `people-m` | Name a person in the Bible whose name begins with M. | People | 95 | Mahlon | Moses, Mary, Matthew |
| `people-s` | Name a person in the Bible whose name begins with S. | People | 95 | Shamgar | Saul, Solomon, Samuel, Simon |
| `places-b` | Name a place in the Bible whose name begins with B. | Places | 110 | Bochim | Babylon, Bethel, Bethlehem, Bethany |
| `places-c` | Name a place in the Bible whose name begins with C. | Places | 62 | Cenchreae | Canaan, Capernaum, Calvary |
| `places-a` | Name a place in the Bible whose name begins with A. | Places | 128 | Abel-meholah | Assyria, Ammon, Antioch, Athens |
| `places-s` | Name a place in the Bible whose name begins with S. | Places | 100 | Shunem | Samaria, Syria, Sodom, Mount Sinai |
| `family-words` | Name a family relationship the Bible mentions (like brother or mother-in-law). | Family & Home | 67 | Sister-in-law | Son, Child, Father, Brother |
| `feelings` | Name a feeling or emotion the Bible mentions. | Words & Virtues | 74 | Heaviness | Fear, Love, Anger, Joy |
| `times-seasons` | Name a time of day, a season, or a span of time the Bible mentions (like dawn or a year). | Days & Seasons | 75 | Cockcrowing | Day, Year, Forever, Night |

Checks on the batch: `tools/verify.js` all verified; `tools/validate.js` 0 errors, 20 warnings (the 18 live ones, plus "Juda" landing on Judea in the Christmas story and "Rehoboth-by-the-River" on Rehoboth in Jacob's). Live prompts unchanged (the live bank rebuilds identically). I typed about 400 first guesses through the matcher; the ones that miss are words the WEB and KJV do not use, and most of those give a near-miss hint ("apple" in Eden, "donkey" at Christmas, "log" in Matthew 7, "happiness").

How they work:
- **Stories** are the book prompts scoped to chapters (`GEN:37-50`): every person, place and listed thing in those chapters, each cited there. Tiers count only those chapters.
- **First letter** prompts take every person (or place) whose name or one of its spellings begins with the letter, and accept only those spellings: Simon counts for S, Peter does not. A place goes by its own name, not its type word: Mount Sinai is an S; the Sea of Galilee is a G, so not in S. Gentilics (Babylonian, Syrians) and compass words are left out. I dropped J places (44 answers, under the 60 an open prompt needs) for A.
- **Words**: each answer cites a verse where the word has that sense (checked by hand; e.g. "wonder" cites Acts 3:10, not "signs and wonders").

What batch 2 buys (simulated with the live schedule as the base, days through 2026-11-20 kept): cooldown 12 -> **16 days** with at most **3** closed sets a day (was 4), and every prompt airs. A 14-day cooldown with 3 closed sets, or 13 with 2, also works; 17 does not. Your target of 1 closed set a day still needs more open prompts.

Decisions for you:
1. **New categories** "Bible Stories", "Family & Home" and "Days & Seasons".
2. **Overlap.** The stories share many answers with other prompts (the Christmas story with Matthew, the Genesis stories with the Genesis people and places prompts, the letter prompts with "a person named in the Bible"). They are different families, so your twin rule does not count them, and two can air on the same day.
3. **God is not an answer** in the story prompts, as in the book prompts.

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
