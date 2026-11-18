# Fishers: launch progress

**Live URL:** https://jimmya1400.github.io/fishers/  (repo: https://github.com/JimmyA1400/fishers)

## Current step
10. After launch: phone issues first (branch `fix/back-button`: Android back gesture leaves the game)

## Next action
On `fix/back-button`: add history entries (home → round → results) so Back returns to home instead of leaving; test, merge, push, smoke-test live.

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
- [~] (f) Game-tester agent and report: agent and report **done**; backlog **partial** (items 1, 2, 3, 4-personal-only, 5, 7, 8, F-07 fixed; 6, 9, 10, 11, 12, 13, 14, 15 and F-06 open)

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
- [ ] Phone issues: Back gesture leaves the game (F-04); sink frame rate under throttle
- [ ] Descent leftovers: tier line at a zone's depth overlaps that zone's label
- [ ] Descent redesign leftovers
- [ ] Categories / bank (nothing waiting for review)
- [ ] Remaining backlog: verse refs in The Catch (#6), Lost Sheep suspense beat (#9), Learn-more drawer (#14), 52+ alias-overlap warnings (#15), reduced-motion veil frames (F-06), desktop sink fps (#13); larger ideas (group mode #10, themed weeks #11) need your go-ahead

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
- Nothing yet.

## Waiting for my review
- Nothing.
