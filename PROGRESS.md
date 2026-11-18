# Fishers: launch progress

**Live URL:** not deployed yet

## Current step
1. State audit (done) → starting 2. Repo hygiene

## Next action
Create branch `chore/site-build` and write `tools/build-site.js` (allowlist copy into `_site/`).

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
- [ ] Allowlist build into `_site/`
- [ ] Deploy size report
- [ ] LICENSE, credits screen, footer, fan-project notice

### 3. Sub-path
- [x] No absolute paths or localhost references in index.html, css, js (grep 2026-11-18)
- [ ] Share text built from `location.origin + location.pathname`
- [ ] Test under `http://localhost:XXXX/fishers/` with zero 404s

### 4. Same daily for everyone
- [ ] Eastern-time date key (`Intl.DateTimeFormat`, America/New_York)
- [ ] Countdown to midnight Eastern
- [ ] Daily #N from launch date; streaks on Eastern date
- [ ] Tests (Pacific device, UTC near midnight)
- [ ] "Your stats are saved on this device" in How to Play
- [ ] Old-key migration kept

### 5. Phone-first polish
- [ ] viewport-fit=cover, 100dvh, safe-area insets
- [ ] Input attributes, 16px font, above keyboard
- [ ] Tap targets ≥ 44px, touch-action
- [ ] Focus kept after Cast; blur on round end
- [ ] performance.now() deadline timer, visibilitychange
- [ ] Audio after tap, mute remembered; haptics
- [ ] Landscape usable; reduced motion; 60 fps at 4× CPU
- [ ] navigator.share + clipboard fallback

### 6. PWA and link previews
- [ ] manifest.webmanifest, icons 192/512/maskable, apple-touch-icon, favicons
- [ ] sw.js (versioned precache, network-first data, cleanup, update toast)
- [ ] Install hints (Android prompt, iOS tip)
- [ ] OG/Twitter tags + 1200×630 og:image (absolute URL after first deploy)
- [ ] Self-hosted font, no third-party requests, robots noindex

### 7. Deployment
- [ ] Prerequisites (git, gh auth, user.name/email)
- [ ] Public repo `fishers`, push main
- [ ] `.github/workflows/deploy.yml` (test → build → deploy)
- [ ] Enable Pages (build_type=workflow)
- [ ] Green run, URL recorded, HTTPS

### 8. Release gate
- [ ] All items in RELEASE_CHECKLIST.md pass on the live URL

### 9. Hand-off message
- [ ] Sent

### 10. After launch
- [ ] Phone issues
- [ ] Descent redesign leftovers
- [ ] Categories / bank (nothing waiting for review)
- [ ] Remaining backlog

## Decisions made
- Git identity is set locally to the GitHub account `JimmyA1400` with its no-reply email, so no personal email appears in public commits.
- The reference game's comparison scripts (`tests/playthrough/krillion*.js`), all test results, `reports/` and the game-tester agent notes are gitignored and were never committed.
- Branches: one per section (`chore/site-build`, `feat/eastern-daily`, `feat/phone-polish`, `feat/pwa`, `ci/pages-deploy`), merged into `main` with `--no-ff` once their tests pass.
- `robots: noindex` is on for now (friends only). Remove the meta tag in `index.html` later to be searchable.

## Blocked on me
- Nothing yet.

## Waiting for my review
- Nothing.
