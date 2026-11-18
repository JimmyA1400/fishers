# Fishers v1: release checklist

**Live URL:** https://jimmya1400.github.io/fishers/
**Checked:** 2026-11-18, against the live site, build `3349ed9` (CI run 44273651886)
**Result:** the release gate passes. One extra measurement (frame rate under 4× CPU throttle) is below target; see "Known limits".

Evidence: `tests/playthrough/results/release-gate.json` (118 checks), `results/lighthouse.json`, `results/update-check.json`, and screenshots under `reports/release/<profile>/` and `reports/media/lighthouse-home-*.html`. Both folders are gitignored and stay on this machine.

| # | Gate item | Result | Evidence |
|---|---|---|---|
| 1 | Loads with zero console errors and zero failed requests: desktop Chrome, "iPhone 13", "Pixel 7" (plus a 360 px Android) | PASS | release-gate.json, "zero console errors" and "zero failed requests" ×4 profiles |
| 2a | Full daily cast on a phone profile: wrong guess → retry | PASS | iPhone 13 and Pixel 7: "not in the net", round stays open, focus stays in the input |
| 2b | Typo → suggestion → confirm | PASS | "Price" → "Prince", cast again lands it |
| 2c | Near miss → message | PASS | "Levi" explains, round stays open |
| 2d | Accept → sink animation → result | PASS | Gopher wood → The Lost Sheep; other rounds Mustard Seed (`reports/release/*/lost-sheep.png`) |
| 2e | One timeout | PASS | text left in the box, 25 s, "Nothing landed"; keyboard dropped (input blurred) |
| 2f | Results, The Catch, share | PASS | 7 Catch rows, one opens; share card has the live URL and no answers. `navigator.share({ text, url })` called with the site URL; when the share sheet refuses, the card is copied and "Copied ✓" shows |
| 3 | Reload mid-round and after finishing | PASS | mid-cast reload offers "Back to the net" and resumes; after finishing, the daily stays locked ("See today’s net"); logbook shows 1 cast, streak 1 |
| 4 | Endless, Archive, Practice Waters, How to Play, Stats, About & credits | PASS | all open on 4 profiles; an Endless cast starts; About shows credits, fan-project notice and build version; How to Play mentions on-device stats and midnight Eastern |
| 5 | Offline: load once, go offline, reload | PASS | Pixel 7: service worker controls the page; offline reload opens the shell and an Endless cast plays from the cached bank. A visitor whose bank isn't cached sees "The boat is ashore" with a Try again button (code path in `js/game.js`) |
| 6 | Update: deploy a trivial change; an open tab shows the toast and refreshes into it | PASS | update-check.json: tab on `3bf3221`, toast after 48 s, Refresh → `3349ed9` (`reports/release/update/01-toast.png`) |
| 7a | Lighthouse, live URL, mobile: Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95 | PASS | mobile 100 / 100 / 100 (FCP 1.3 s, LCP 1.4 s, TBT 40 ms, CLS 0); desktop 95 / 100 / 100 |
| 7b | PWA installability | PASS (checked directly) | Lighthouse 12 no longer has a PWA category, so the criteria were checked one by one: valid manifest with name, short_name, start_url/scope `./`, display standalone, 192 and 512 icons plus a maskable 512; HTTPS; a service worker that controls the page and serves it offline |
| 7c | axe-core: zero serious or critical | PASS | 0 violations of any impact on every profile, home and mid-round |
| 8 | Manifest valid; icons load; maskable looks right | PASS | all icons 200 at their stated sizes; maskable fish sits inside the central safe zone (`assets/icons/maskable-512.png`) |
| 9 | Open Graph | PASS | og:image `https://jimmya1400.github.io/fishers/assets/og-image.png` → 200 image/png (1200×630); og:title "Fishers — the Daily Cast"; og:description and og:url set; twitter:card summary_large_image |
| 10 | Scripture verification, matcher and date tests in CI | PASS | every deploy runs `npm test` (51 tests, including Eastern-time cases for Pacific, UTC and Tokyo devices and both DST days) and `npm run verify` (13,082 names, aliases and anchors checked; 0 validator errors) before the deploy job |
| 11 | No reference-game material, secrets or test media in the artifact | PASS | the CI step "Check the artifact holds only the game" passes; the artifact is 33 files (1.70 MB): index.html, 404.html, manifest, sw.js, .nojekyll, css/ (3), js/ (14), data/prompts.json, assets/ (favicon, og-image, 5 icons), fonts/ (2 woff2 + OFL.txt). Git history was scanned before the first push: no secrets, only the GitHub no-reply email |

## Also checked
- HTTP redirects to HTTPS (301); Pages reports `https_enforced: true`.
- Unknown paths get the Fishers 404 page with a link back to the game.
- Landscape on Pixel 7: input bar visible, no sideways scroll.
- Tap targets on the home screen are at least 44×44 px on every profile; no horizontal scroll at 360 px.
- Answer input: `type=text inputmode=text autocomplete=off autocorrect=off autocapitalize=off spellcheck=false enterkeyhint=go`, 18 px font.

## Known limits
- **Frame rate:** the sink measured 46–59 fps on "Pixel 7" with 4× CPU throttling (worst frame 67 ms). That is headless Chromium drawing in software at 2.6× pixel density, so a real phone's GPU should do better, but it is below the 60 fps target. A fix that stops repainting the water every frame raised it from 41 fps.
- **Emulation, not devices:** "iPhone 13" is Chromium with an iPhone screen and user agent, not WebKit. A real iPhone's on-screen keyboard, share sheet and Add to Home Screen were not exercised. The share sheet itself can't be driven by automation, so `navigator.share` was replaced by a recorder in the test; the clipboard path is real.
- The Lighthouse mid-game snapshot (an extra, unscored check) gave Best Practices 88; the required home-page run is 100.
