/* Fishers: game flow and screens. */
(function () {
  'use strict';

  var CFG = window.FSH_CONFIG, M = window.FSHMatcher, D = window.FSHDaily, FSHRound = window.FSHRound,
      Store = window.FSHStore, Scene = window.FSHScene, Share = window.FSHShare, Tele = window.FSHTelemetry,
      Sound = window.FSHSound, Icons = window.FSHIcons;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var app = document.getElementById('app');
  var live = document.getElementById('live');
  var data, tiers, byId = {}, compiled = {}, typeahead = null;
  var mode = null;          // 'cast' (daily, archive, endless) or 'practice'
  var session = null;       // the cast being played
  var tick = null, countdown = null;
  var practice = { results: [], seen: {}, category: '', current: null };
  var STEP_MS = 1000, MAX = 700;
  var pending = [], screenNo = 0;         // timers for the current screen's choreography

  var BANDS = [
    [450, 'The one out of a hundred'],
    [351, 'Deep calls to deep'],
    [251, 'Into the deep'],
    [151, 'Out past the breakers'],
    [0, 'Still in the shallows']
  ];

  // ---------- helpers ----------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function fmt(n) { return Scene.fmt(n); }
  function today() { return D.dateKey(new Date()); }
  function yesterday() { return D.addDays(today(), -1); }
  function tierDef(t) { return (tiers || EARLY_TIERS)[t - 1]; }
  function say(text) { live.textContent = ''; setTimeout(function () { live.textContent = text; }, 60); }
  function comp(p) { return compiled[p.id] || (compiled[p.id] = M.compile(p)); }
  function total(results) { return results.reduce(function (n, r) { return n + r.points; }, 0); }
  // A small message at the bottom of the screen. With an action it stays
  // until tapped (used for "new version available").
  var toastTimer = null;
  function toast(msg, action, onAction) {
    var el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(toastTimer);
    el.innerHTML = '';
    var span = document.createElement('span'); span.textContent = msg; el.appendChild(span);
    if (action) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'toast-btn'; b.textContent = action;
      b.onclick = function () { el.hidden = true; onAction(); };
      el.appendChild(b);
      var x = document.createElement('button'); x.type = 'button'; x.className = 'toast-x'; x.setAttribute('aria-label', 'Not now');
      x.textContent = '×';
      x.onclick = function () { el.hidden = true; };
      el.appendChild(x);
    } else {
      toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
    }
    el.classList.toggle('has-action', !!action);
    el.hidden = false;
  }
  window.FSHToast = toast;

  // The round clock. Deadlines are measured with performance.now(), which
  // can't jump when the device clock is changed; Date.now() is the floor, so
  // time spent asleep or in a background tab still counts (some phones pause
  // the monotonic clock while suspended). Start times are stored as wall-clock
  // milliseconds so a reload can resume the round.
  var wall0 = Date.now(), perf0 = (window.performance && performance.now) ? performance.now() : 0;
  function nowMs() {
    var mono = window.performance && performance.now ? wall0 + (performance.now() - perf0) : 0;
    return Math.max(mono, Date.now());
  }
  // Short buzzes on Android when an answer lands or misses. iOS has no
  // vibration API and simply ignores this.
  function buzz(pattern) {
    try { if (navigator.vibrate && !reduceMotion) navigator.vibrate(pattern); } catch (e) { /* not supported */ }
  }
  var onVisible = null;
  document.addEventListener('visibilitychange', function () { if (!document.hidden && tick && onVisible) onVisible(); });
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } onVisible = null; }
  function stopCountdown() { if (countdown) { clearInterval(countdown); countdown = null; } }
  function castNumber(key) { return D.dayNumber(key, CFG.epoch) + 1; }
  function later(fn, ms) { var id = setTimeout(fn, reduceMotion ? Math.min(ms, 30) : ms); pending.push(id); return id; }
  function clearPending() { pending.forEach(clearTimeout); pending = []; }

  // Each screen is one of three layouts over the world: 'home' (camera at
  // the surface), 'play' (a round in the water), 'sheet' (a scrolling panel).
  function setLayout(layout) {
    var b = document.body;
    b.classList.remove('view-home', 'view-play', 'view-sheet');
    b.classList.add('view-' + layout);
  }

  // ---------- the score panel -------------------------------------------------
  var hud = {};
  function hudOn(on) { document.body.classList.toggle('hud-on', !!on); }
  // landed: the round just ended, so its square is filled and none is outlined.
  function hudSet(results, count, isPractice, landed) {
    hud.score.textContent = total(results);
    document.getElementById('hud').classList.toggle('practice-hud', !!isPractice);
    if (isPractice) return;
    var sq = '';
    for (var i = 0; i < count; i++) {
      var r = results[i];
      sq += '<li' + (r ? ' data-t="' + r.tier + '"' : (i === results.length && !landed ? ' class="now"' : '')) + '></li>';
    }
    hud.sq.innerHTML = sq;
    var n = landed ? results.length : Math.min(results.length + 1, count);
    hud.cast.textContent = 'Cast ' + n + ' of ' + count;
  }
  var lastM = -1, lastZone = '';
  function onFrame(m, fishY) {
    var r = Math.round(m);
    if (r !== lastM) { lastM = r; hud.m.textContent = fmt(r) + ' m'; }
    var z = Scene.zoneName(r);
    if (z !== lastZone) { lastZone = z; hud.zone.textContent = z; }
    if (sinkWatch) sinkWatch(m, fishY);
  }
  function band(score) { for (var i = 0; i < BANDS.length; i++) if (score >= BANDS[i][0]) return BANDS[i][1]; return BANDS[BANDS.length - 1][1]; }
  // "Learn more": the WEB text of a Lost Sheep's passage, in a drawer.
  function passageHtml(a, cls) {
    var ps = a && a.passage;
    if (!ps || !ps.verses || !ps.verses.length) return '';
    return '<details class="more ' + (cls || '') + '"><summary>Learn more <span class="more-ref">' + esc(ps.ref) + '</span></summary>' +
      '<blockquote class="passage">' + ps.verses.map(function (v) {
        return '<p><sup class="vn">' + esc(v.r.replace(/^.* /, '').replace(/^\d+:/, '')) + '</sup>' + esc(v.t) + '</p>';
      }).join('') + '</blockquote>' +
      '<p class="passage-src">' + (ps.more ? 'The passage continues: read all of ' + esc(ps.ref) + '. ' : '') + 'World English Bible.</p></details>';
  }
  function refsHtml(refs) { return refs && refs.length ? '<span class="ref">' + esc(refs.join('; ')) + '</span>' : ''; }

  // The phone's Back gesture: every screen away from home shares one history
  // entry, so Back returns to the home screen instead of leaving the game.
  // A cast in progress keeps its clock and resumes from home, as after a reload.
  var ignorePop = 0;
  function markAway() {
    if (!(history.state && history.state.fishers)) { try { history.pushState({ fishers: 'away' }, ''); } catch (e) { /* ignore */ } }
  }
  function markHome() {
    if (history.state && history.state.fishers === 'away') { ignorePop++; history.back(); }
  }
  window.addEventListener('popstate', function () {
    if (ignorePop) { ignorePop--; return; }
    document.querySelectorAll('dialog[open]').forEach(function (d) { d.close(); });
    if (!document.body.classList.contains('view-home')) renderHome();
  });

  function show(html, focusSel, layout) {
    stopTimer(); stopCountdown(); clearPending();
    screenNo++;
    layout = layout || 'sheet';
    if (layout === 'home') markHome(); else markAway();
    setLayout(layout);
    document.body.classList.remove('end-view', 'revealing');
    app.innerHTML = layout === 'sheet' ? '<div class="sheet-inner">' + html + '</div>' : html;
    app.scrollTop = 0;
    var target = focusSel && app.querySelector(focusSel);
    if (target) target.focus({ preventScroll: true });
  }

  function prettyDate(key) {
    var p = key.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function shortDate(key) {
    var p = key.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ---------- casts (daily, archive, endless) ------------------------------
  function validIds(ids) { return ids && ids.length && ids.every(function (id) { return byId[id]; }); }

  function dailySession() {
    var st = Store.get(), t = today();
    if (!(st.daily && st.daily.date === t && validIds(st.daily.ids))) {
      st.daily = { kind: 'daily', key: 'daily:' + t, date: t, ids: D.pickDaily(data, t, CFG).map(function (p) { return p.id; }), results: [], startedAt: null };
      Store.save();
    }
    st.daily.kind = 'daily';
    return st.daily;
  }

  function storedCast(key, make) {
    var st = Store.get();
    st.casts = st.casts || {};
    var s = st.casts[key];
    if (!(s && validIds(s.ids))) { s = st.casts[key] = make(); Store.save(); }
    return s;
  }
  function archiveSession(date) {
    return storedCast('archive:' + date, function () {
      return { kind: 'archive', key: 'archive:' + date, date: date, ids: D.pickDaily(data, date, CFG).map(function (p) { return p.id; }), results: [], startedAt: null };
    });
  }
  function endlessSession(n) {
    return storedCast('endless:' + n, function () {
      return { kind: 'endless', key: 'endless:' + n, number: n, ids: D.pickEndless(data, n, CFG).map(function (p) { return p.id; }), results: [], startedAt: null };
    });
  }
  function restart(s) { s.results = []; s.startedAt = null; s.done = false; Store.save(); }

  function title(s) {
    if (s.kind === 'endless') return 'Endless Cast #' + s.number;
    return 'Fishers #' + castNumber(s.date) + (s.kind === 'archive' ? ' (archive)' : '');
  }
  function done(s) { return s.results.length >= s.ids.length; }

  function currentResults() { return mode === 'practice' ? practice.results : (session ? session.results : []); }

  // Put the camera where the current results leave the fish. `view` is 'play'
  // or 'home'; `ms` 0 jumps there.
  function syncScene(animate, view) {
    var results = currentResults();
    var m = view === 'home' ? 0 : total(results) * CFG.metresPerPoint;
    Scene.setMascot(results.length ? results[results.length - 1].tier : 0);
    return Scene.go({ depth: m, view: view || 'play', ms: animate ? undefined : 0, settle: true });
  }

  function streakHtml() {
    var n = Store.currentStreak(today(), yesterday());
    return n > 0 ? '<span class="streak"><span aria-hidden="true">\u{1F525}</span> ' + n + '<span class="sr-only"> day streak</span></span>' : '';
  }
  function updateStreak() {}

  // ---------- home ----------------------------------------------------------
  // Before the prompt bank arrives the home screen still draws, from what is
  // stored, with its buttons waiting; boot() draws it again once data is in.
  function storedDaily() {
    var st = Store.get(), t = today();
    return st.daily && st.daily.date === t ? st.daily : { date: t, ids: new Array(CFG.promptsPerDay || 7), results: [], startedAt: null };
  }
  function renderHome() {
    mode = 'cast';
    session = data ? dailySession() : null;
    hudOn(false);
    var d = session || storedDaily(), n = d.results.length;
    syncScene(true, 'home');
    var label, status = '';
    if (done(d)) {
      status = 'Today’s net is in: ' + total(d.results) + ' / ' + MAX + ', ' + fmt(total(d.results) * CFG.metresPerPoint) + ' m down.';
      label = '▲ See today’s net ▲';
    } else if (n > 0 || d.startedAt) {
      status = n + ' of ' + d.ids.length + ' casts in, at ' + fmt(total(d.results) * CFG.metresPerPoint) + ' m.';
      label = '▼ Back to the net ▼';
    } else {
      label = '▼ Cast the net ▼';
    }
    show(
      '<section class="home" aria-labelledby="home-title">' +
        '<div class="home-top">' +
          '<h1 class="wordmark" id="home-title"><svg class="ichthys" aria-hidden="true"><use href="#ichthys"/></svg>Fishers</h1>' +
          '<p class="subtitle">The Daily Cast · a Bible trivia game</p>' +
          '<p class="tagline">“Follow me, and I will make you fishers of men.” <span class="ref">Matthew 4:19 (KJV)</span></p>' +
          '<p class="home-line">7 prompts · 25 seconds each · rarer answers sink deeper.</p>' +
        '</div>' +
        '<div class="home-bottom">' +
          (status ? '<p class="home-status">' + esc(status) + '</p>' : '') +
          '<button type="button" class="cast-net" id="go">' + label + '</button>' +
          '<nav class="home-modes" aria-label="Other ways to play">' +
            '<button type="button" class="link-btn" id="endless">Endless</button><span aria-hidden="true">·</span>' +
            '<button type="button" class="link-btn" id="archive">Archive</button><span aria-hidden="true">·</span>' +
            '<button type="button" class="link-btn" id="practice">Practice Waters</button>' +
          '</nav>' +
        '</div>' +
        '<p class="home-castno">Cast #' + castNumber(d.date) + ' · ' + esc(shortDate(d.date)) + streakHtml() + '</p>' +
        '<p class="home-foot"><span class="foot-src">Scripture: WEB &amp; KJV, public domain ·</span><button type="button" class="link-btn" id="home-about">About &amp; credits</button></p>' +
      '</section>', null, 'home');
    document.getElementById('home-about').onclick = function () { openDialog(document.getElementById('dlg-about')); };
    if (!data) {
      // Pressed before the bank arrives: remember it and carry on when it does.
      [['go', function () { play(dailySession(), true); }], ['endless', renderEndless], ['archive', renderArchive], ['practice', renderPracticeSetup]]
        .forEach(function (pair) {
          document.getElementById(pair[0]).onclick = function () {
            pendingHome = pair[1];
            var go = document.getElementById('go');
            go.setAttribute('aria-busy', 'true');
            say('Mending the nets…');
          };
        });
      return;
    }
    wireHome();
  }
  var pendingHome = null;

  // Buttons on the home screen. Called again by boot() when the bank arrives,
  // so the screen is not redrawn (no layout shift, no late repaint).
  function wireHome() {
    document.getElementById('go').removeAttribute('aria-busy');
    document.getElementById('go').onclick = function () { play(dailySession(), true); };
    document.getElementById('endless').onclick = renderEndless;
    document.getElementById('archive').onclick = renderArchive;
    document.getElementById('practice').onclick = renderPracticeSetup;
  }

  // From the home screen the title lifts away and the camera pans down to the
  // water before the round begins.
  function play(s, fromHome) {
    mode = 'cast';
    session = s;
    if (done(s)) { renderResults(s); return; }
    var home = app.querySelector('.home');
    if (fromHome && home) {
      home.classList.add('leaving');
      app.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      later(function () { showPrompt({ entrance: true }); }, 300);
    } else {
      showPrompt({ entrance: true });
    }
  }

  // ---------- endless and archive ------------------------------------------
  function renderEndless() {
    hudOn(false);
    mode = 'cast'; session = null; syncScene(true, "home");
    var st = Store.get();
    var played = Object.keys(st.casts || {}).filter(function (k) { return /^endless:/.test(k); })
      .map(function (k) { return st.casts[k]; }).sort(function (a, b) { return b.number - a.number; });
    var next = 1;
    played.forEach(function (s) { if (s.number >= next) next = s.number + 1; });
    var rows = played.map(function (s) {
      var status = done(s) ? total(s.results) + ' / ' + MAX : s.results.length + ' of 7 casts';
      return '<li><span><strong>Endless Cast #' + s.number + '</strong><span class="small"> · ' + esc(status) + '</span></span>' +
        '<button type="button" class="btn small-btn" data-n="' + s.number + '">' + (done(s) ? 'Cast this one again' : 'Carry on') + '</button></li>';
    }).join('');
    show(
      '<section class="card" aria-labelledby="en-title">' +
        '<p class="eyebrow">Endless Casts</p>' +
        '<h2 id="en-title" tabindex="-1">As many casts as you like</h2>' +
        '<p class="lede">Numbered casts of seven, the same for every player, built by the same rules as the daily. They do not touch your streak.</p>' +
        '<div class="stack"><button type="button" class="btn primary" id="en-next">Cast Endless #' + next + '</button></div>' +
        (rows ? '<h3>Your Endless Casts</h3><ul class="cast-list">' + rows + '</ul>' : '') +
        '<button type="button" class="btn quiet" id="en-back">Back to shore</button>' +
      '</section>', '#en-title');
    document.getElementById('en-next').onclick = function () { play(endlessSession(next)); };
    document.getElementById('en-back').onclick = renderHome;
    app.querySelectorAll('[data-n]').forEach(function (b) {
      b.onclick = function () {
        var s = endlessSession(+b.getAttribute('data-n'));
        if (done(s)) restart(s);
        play(s);
      };
    });
  }

  function renderArchive() {
    hudOn(false);
    mode = 'cast'; session = null; syncScene(true, "home");
    var st = Store.get(), rows = [];
    for (var k = yesterday(); D.dayNumber(k, CFG.epoch) >= 0 && rows.length < 400; k = D.addDays(k, -1)) {
      var s = (st.casts || {})['archive:' + k];
      var h = (st.stats.history || []).filter(function (x) { return x.date === k; })[0];
      var status = s && done(s) ? total(s.results) + ' / ' + MAX : h ? 'played on the day: ' + h.score : s && s.results.length ? s.results.length + ' of 7 casts' : '';
      rows.push('<li><span><strong>Fishers #' + castNumber(k) + '</strong><span class="small"> · ' + esc(shortDate(k)) +
        (status ? ' · ' + esc(status) : '') + '</span></span>' +
        '<button type="button" class="btn small-btn" data-d="' + k + '">' + (s && done(s) ? 'Cast this one again' : s && s.results.length ? 'Carry on' : 'Cast') + '</button></li>');
    }
    show(
      '<section class="card" aria-labelledby="ar-title">' +
        '<p class="eyebrow">Archive</p>' +
        '<h2 id="ar-title" tabindex="-1">Past Daily Casts</h2>' +
        (rows.length
          ? '<p class="lede">Replay any earlier daily. Archive casts do not change your streak.</p><ul class="cast-list">' + rows.join('') + '</ul>'
          : '<p class="lede">The archive opens tomorrow. Fishers #1 is today’s cast.</p>') +
        '<button type="button" class="btn quiet" id="ar-back">Back to shore</button>' +
      '</section>', '#ar-title');
    document.getElementById('ar-back').onclick = renderHome;
    app.querySelectorAll('[data-d]').forEach(function (b) {
      b.onclick = function () {
        var s = archiveSession(b.getAttribute('data-d'));
        if (done(s)) restart(s);
        play(s);
      };
    });
  }

  // ---------- a round -------------------------------------------------------
  // The round stays open until an answer is accepted or the clock runs out.
  function currentRound() {
    if (mode === 'cast') {
      var s = session;
      if (!s || done(s)) return null;
      return {
        prompt: byId[s.ids[s.results.length]],
        n: s.results.length + 1, of: s.ids.length,
        timed: true, startedAt: s.startedAt,
        start: function (t) { s.startedAt = t; Store.save(); }
      };
    }
    return { prompt: practice.current, n: 0, of: 0, timed: Store.get().settings.practiceTimer !== false, startedAt: null, start: function () {} };
  }

  var RING = 125.66;   // circumference of the timer ring (r = 20)

  function restart_(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  // opts.entrance: arriving from the home screen or a list, so the camera pans
  // down and the score panel slides in first.
  function showPrompt(opts) {
    opts = opts || {};
    var cur = currentRound();
    if (!cur) return renderResults(session);
    var prompt = cur.prompt;
    var limit = CFG.secondsPerPrompt * 1000;
    var resuming = cur.timed && cur.startedAt;
    if (resuming && nowMs() >= cur.startedAt + limit) return finishRound(prompt, { type: 'timeout', points: 0, tier: 0 }, 0);

    var label = (mode === 'practice' ? 'Practice Waters' : 'Cast ' + cur.n + ' of ' + cur.of) + ' · ' + prompt.category;
    show(
      '<section class="play" aria-labelledby="prompt-text">' +
        '<div class="glass prompt-card pre" id="pcard">' +
          '<p class="pc-label">' + esc(label) + '</p>' +
          '<h2 id="prompt-text" class="pc-text">' + esc(prompt.prompt) + '</h2>' +
          '<p class="pc-hint" aria-hidden="true">▼ rarer answers sink deeper ▼</p>' +
        '</div>' +
        '<p class="glass cd-pill pre" id="countdown" aria-hidden="true">the clock starts in <b id="cd-n">3</b></p>' +
        '<form class="inbar pre" id="answer-form" autocomplete="off" novalidate>' +
          '<div class="inbar-above">' +
            '<p class="feedback" id="feedback" role="status" aria-live="polite"></p>' +
            '<div class="ta-chips"><button type="button" class="ta-chip" id="ta-chip" hidden></button></div>' +
          '</div>' +
          '<div class="glass inbar-row" id="inrow">' +
            '<div class="ring' + (cur.timed ? '' : ' untimed') + '" id="ring" role="timer" aria-label="Seconds left">' +
              '<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="bg" cx="24" cy="24" r="20"/><circle class="fg" id="ring-fg" cx="24" cy="24" r="20"/></svg>' +
              '<span id="secs" aria-hidden="true">' + (cur.timed ? CFG.secondsPerPrompt : '∞') + '</span></div>' +
            '<label class="sr-only" for="answer">Your answer</label>' +
            '<div class="ta-wrap"><div class="ta-ghost" aria-hidden="true"><span class="ta-typed"></span><span class="ta-rest"></span></div>' +
            '<input id="answer" name="answer" type="text" inputmode="text" maxlength="60" placeholder="type one answer…" autocomplete="off" autocorrect="off" ' +
              'autocapitalize="off" spellcheck="false" enterkeyhint="go" aria-describedby="feedback"></div>' +
            '<button type="submit" class="cast-btn" id="cast">Cast</button>' +
          '</div>' +
          (cur.timed ? '<div class="drain" id="drain" aria-hidden="true"><i id="fill"></i></div>' : '') +
        '</form>' +
      '</section>', null, 'play');

    var card = document.getElementById('pcard');
    var pill = document.getElementById('countdown');
    var form = document.getElementById('answer-form');
    var row = document.getElementById('inrow');
    var input = document.getElementById('answer');
    var castBtn = document.getElementById('cast');
    var feedback = document.getElementById('feedback');
    var guesses = 0, round = null;
    var ghostTyped = app.querySelector('.ta-typed'), ghostRest = app.querySelector('.ta-rest');
    var chip = document.getElementById('ta-chip'), offer = null, quiet = false;   // quiet: a suggestion was just placed
    var helpOn = Store.get().settings.typeahead !== false;

    hudSet(currentResults(), cur.of, mode === 'practice');
    Scene.layer('marks').innerHTML = '';
    sinkWatch = null;

    // Type-ahead: grey ghost text after the caret, and a chip to tap on phones.
    function refreshTypeahead() {
      var typed = input.value;
      offer = helpOn && !quiet && typeahead && !input.disabled ? typeahead.complete(typed) : null;
      var rest = offer ? window.FSHTypeahead.remainder(typed, offer) : '';
      var atEnd = input.selectionStart === typed.length;
      ghostTyped.textContent = rest && atEnd ? typed : '';
      ghostRest.textContent = rest && atEnd ? rest : '';
      chip.hidden = !offer;
      if (offer) { chip.textContent = offer; chip.setAttribute('aria-label', 'Fill in ' + offer); }
    }
    function acceptOffer() {
      if (!offer) return false;
      input.value = offer;
      offer = null;
      refreshTypeahead();
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      return true;
    }
    input.addEventListener('input', function () { quiet = false; refreshTypeahead(); });
    input.addEventListener('keyup', function (e) { if (e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') refreshTypeahead(); });
    input.addEventListener('keydown', function (e) {
      var atEnd = input.selectionStart === input.value.length;
      if ((e.key === 'Tab' && !e.shiftKey || e.key === 'ArrowRight') && offer && atEnd) {
        if (acceptOffer()) e.preventDefault();
      }
    });
    chip.addEventListener('click', acceptOffer);

    function setOpen(open) { input.disabled = !open; castBtn.disabled = !open; if (open) input.focus({ preventScroll: true }); }

    function begin(startedAt) {
      round = FSHRound.create({ compiled: comp(prompt), tiers: tiers, limitMs: cur.timed ? limit : 864e5, startedAt: startedAt });
      pill.classList.add('gone');
      setOpen(true);
      if (!cur.timed) return;
      var fg = document.getElementById('ring-fg'), ring = document.getElementById('ring');
      var fill = document.getElementById('fill'), drain = document.getElementById('drain');
      var secs = document.getElementById('secs'), said = {}, lastS = -1;
      function paint() {
        var now = nowMs(), over = round.tick(now);
        if (over) { finishRound(prompt, over, guesses); return; }
        var left = round.remaining(now), k = left / limit, s = Math.ceil(left / 1000);
        fg.style.strokeDashoffset = (-RING * (1 - k)).toFixed(2);   // drains clockwise from the top
        fill.style.transform = 'scaleX(' + k.toFixed(4) + ')';
        if (s !== lastS) {
          lastS = s;
          secs.textContent = s;
          ring.classList.toggle('low', s <= 5);
          drain.classList.toggle('low', s <= 5);
          if ((s === 10 || s === 5) && !said[s]) { said[s] = true; say(s + ' seconds left.'); }
        }
      }
      paint();
      tick = setInterval(paint, 50);
      // Background tabs throttle timers; repaint the moment the page is back
      // so a round whose time ran out resolves as a timeout straight away.
      onVisible = paint;
    }

    form.onsubmit = function (e) {
      e.preventDefault();
      if (!round) return;
      var text = input.value.trim();
      if (!text) { input.focus(); say('Type an answer, then cast.'); return; }
      guesses++;
      var box = row.getBoundingClientRect();
      Scene.burst(box.left + box.width / 2, box.top, 9);
      Sound.plop();
      var r = round.cast(text, nowMs());
      if (mode === 'cast' && session.kind === 'daily') {
        Tele.log(prompt.id, r.type === 'accept' ? r.answer.name : M.tokens(text).join(' '), r.type === 'accept');
      }
      if (r.done) { finishRound(prompt, r, guesses); return; }
      if (r.type === 'suggest') {
        feedback.className = 'feedback suggest';
        feedback.innerHTML = '“' + esc(text) + '” → <span class="sugg">“' + esc(r.answer.name) + '”</span>' +
          '<span class="sub">cast again to confirm · or edit</span>';
        input.value = r.answer.name;
        input.setAttribute('data-suggested', r.answer.name);
        quiet = true;
      } else if (r.type === 'near') {
        feedback.className = 'feedback near';
        feedback.innerHTML = esc(r.nearMiss.message) + '<span class="sub">cast again</span>';
      } else {
        feedback.className = 'feedback miss';
        feedback.textContent = '“' + text + '”: not in the net. cast again';
        if (!reduceMotion) restart_(row, 'shake');
        Sound.thud();
        buzz([12, 60, 12]);
      }
      restart_(feedback, 'fresh');
      input.focus();
      if (r.type === 'suggest') input.setSelectionRange(input.value.length, input.value.length); else input.select();
      refreshTypeahead();
    };

    // ---- choreography ----
    setOpen(false);
    var target = total(currentResults()) * CFG.metresPerPoint;
    var panning = opts.entrance || !document.body.classList.contains('hud-on');
    Scene.go({ depth: target, view: 'play', ms: panning ? 1200 : undefined });
    var tHud = panning ? 900 : 0, tCard = panning ? 1200 : 60, tBar = panning ? 1450 : 320;
    later(function () { hudOn(true); }, tHud);
    later(function () { card.classList.remove('pre'); }, tCard);

    if (resuming) {
      later(function () { form.classList.remove('pre'); begin(cur.startedAt); }, tBar);
      return;
    }
    if (!cur.timed) {
      later(function () { form.classList.remove('pre'); begin(nowMs()); }, tBar);
      return;
    }

    // "the clock starts in 3 … 2 … 1", the number pulsing each second.
    later(function () {
      say(prompt.prompt + ' The clock starts in 3 seconds.');
      pill.classList.remove('pre');
      form.classList.remove('pre');
      var n = 3, num = document.getElementById('cd-n');
      function step() {
        if (n === 0) { var t = nowMs(); cur.start(t); begin(t); return; }
        num.textContent = n;
        restart_(num, 'pulse');
        n--;
        later(step, STEP_MS);
      }
      step();
    }, tBar);
  }

  function finishRound(prompt, r, guesses) {
    stopTimer(); clearPending();
    // Drop the keyboard so the sink and the result are in view.
    var inp = document.getElementById('answer');
    if (inp && document.activeElement === inp) inp.blur();
    if (r.type === 'accept') buzz(25);
    var before = total(currentResults());
    var rec = { id: prompt.id, outcome: r.type === 'accept' ? 'answer' : 'timeout', tier: 0, points: 0, guesses: guesses };
    if (r.type === 'accept') { rec.a = r.index; rec.name = r.answer.name; rec.tier = r.answer.tier; rec.points = r.points; }
    var results;
    if (mode === 'cast') {
      session.results.push(rec); session.startedAt = null;
      if (done(session)) finishCast(session);
      Store.save();
      results = session.results;
    } else {
      practice.results.push(rec);
      results = practice.results;
    }
    var of = mode === 'cast' ? session.ids.length : 0;

    // What was still in the box when the clock ran out, and whether it was a
    // suggestion waiting for its second cast. Shown on the timeout card only.
    var inBox = document.getElementById('answer');
    var left = rec.outcome !== 'answer' && inBox ? inBox.value.trim().slice(0, 60) : '';
    var leftWasSuggestion = !!(left && inBox.getAttribute('data-suggested') === left);

    // 1. The input bar and prompt card slide away.
    ['answer', 'cast'].forEach(function (id) { var el = document.getElementById(id); if (el) el.disabled = true; });
    ['pcard', 'answer-form', 'countdown'].forEach(function (id) { var el = document.getElementById(id); if (el) el.classList.add('gone'); });
    var onStage = !!document.getElementById('pcard');

    if (rec.outcome !== 'answer') {
      // Timeout: no tag, the camera holds, the square fills slate.
      later(function () {
        hudSet(results, of, mode === 'practice', true);
        renderReveal(prompt, rec, results, { left: left, leftWasSuggestion: leftWasSuggestion });
      }, onStage ? 260 : 0);
      return;
    }
    later(function () { sink(prompt, rec, before * CFG.metresPerPoint, results, of); }, onStage ? 220 : 0);
  }

  // The core payoff: the answer, tied to the net as a tag, sinks past a line
  // for each tier, changing color as it passes each one.
  var sinkWatch = null;
  function sink(prompt, rec, startM, results, of) {
    var a = prompt.answers[rec.a], mpp = CFG.metresPerPoint;
    var targetM = Math.min(Scene.MAX_M, startM + rec.points * mpp);

    var marks = Scene.layer('marks');
    marks.classList.remove('fade');
    marks.innerHTML = tiers.map(function (t, i) {
      var m = startM + t.points * mpp;
      if (m > Scene.MAX_M) return '';
      return '<div class="tline" data-t="' + t.id + '" style="top:' + (Scene.ZERO + m) + 'px;animation-delay:' + (i * 0.07).toFixed(2) + 's">' +
        '<span class="tl-label">' + Icons.tier(t.id) + esc(t.name) + ' · ' + t.points + '</span></div>';
    }).join('');
    var lineEls = {};
    marks.querySelectorAll('.tline').forEach(function (el) { lineEls[el.getAttribute('data-t')] = el; });

    var p = Scene.fishPoint();
    var tag = document.createElement('div');
    tag.className = 'tag';
    tag.id = 'net-tag';
    tag.setAttribute('data-t', '1');
    tag.setAttribute('aria-hidden', 'true');
    tag.innerHTML = '<span class="tag-in">“' + esc(a.name.toUpperCase()) + '” ▼</span>';
    app.appendChild(tag);
    // Hung just under the fish, kept on screen however long the answer is.
    var w = tag.firstChild.offsetWidth, vw = window.innerWidth;
    // To the left of the fish, so it never hides the tier labels on the right.
    tag.style.left = Math.round(Math.max(12, Math.min(p.x + 26 - w, vw - w - 16))) + 'px';
    tag.style.top = Math.round(p.y + 30) + 'px';
    tag.style.setProperty('--tie', Math.round(p.x - parseFloat(tag.style.left)) + 'px');

    var next = 0, dist = targetM - startM, my = screenNo;
    sinkWatch = function (m, fy) {
      // The fish can drift on screen near the surface; the tag stays tied to it.
      if (fy != null) tag.style.transform = 'translate3d(0,' + (fy - p.y).toFixed(1) + 'px,0)';
      while (next < tiers.length && tiers[next].id <= rec.tier && m >= startM + tiers[next].points * mpp - 0.5) {
        var t = tiers[next++];
        tag.setAttribute('data-t', String(t.id));
        var line = lineEls[t.id];
        if (line) { line.classList.remove('hit'); void line.offsetWidth; line.classList.add('hit'); }
        Sound.bell(t.id);
      }
    };

    // A Lost Sheep doesn't drop at once: the line goes taut and the tag tugs
    // while every tier line is out, then the net sinks. (Skipped with reduced motion.)
    if (rec.tier === 6 && !reduceMotion) {
      tag.classList.add('tug');
      buzz([10, 90, 10, 90, 10]);
      say('Something heavy on the line.');
      later(function () { if (my === screenNo) { tag.classList.remove('tug'); drop(); } }, SHEEP_HOLD_MS);
    } else drop();

    function drop() {
    var trail = reduceMotion ? null : setInterval(function () { var f = Scene.fishPoint(); Scene.burst(f.x + 4, f.y + 8, 2, 26); }, 110);
    Scene.scatter(p.x, p.y);
    Sound.whoosh(Scene.sinkMs(dist) / 1000);
    say('Landed: ' + a.name + '. Sinking ' + fmt(dist) + ' metres.');

    Scene.go({ depth: targetM, view: 'play', settle: true }).then(function () {
      if (trail) clearInterval(trail);
      if (my !== screenNo) { sinkWatch = null; return; }   // the player left mid-sink
      if (sinkWatch) sinkWatch(targetM + 1, Scene.fishPoint().y);
      sinkWatch = null;
      Scene.setMascot(rec.tier);
      hudSet(results, of, mode === 'practice', true);
      var sc = document.querySelector('.hud-score');
      sc.setAttribute('data-t', String(rec.tier));
      restart_(hud.score, 'slam');
      if (rec.tier === 6) Sound.chord();
      later(function () { marks.classList.add('fade'); renderReveal(prompt, rec, results); }, 450);
    });
    }
  }
  var SHEEP_HOLD_MS = 1500;

  function finishCast(s) {
    var score = total(s.results), tierList = s.results.map(function (r) { return r.tier; });
    if (s.kind === 'daily') {
      var before = Store.get().stats.lastCompleted;
      Store.recordDaily(s.date, score, tierList, D.addDays(s.date, -1));
      if (before !== s.date) Tele.logScore(castNumber(s.date), score);
      updateStreak();
    } else {
      s.done = true;
      s.score = score;
    }
  }

  // Result reveal, over the darkened water.
  function renderReveal(prompt, rec, results, extra) {
    extra = extra || {};
    var score = total(results), depth = Math.min(7000, score * CFG.metresPerPoint);
    var isLast = mode === 'cast' && done(session);
    var tag = document.getElementById('net-tag');
    var body, spoken, t = rec.outcome === 'answer' ? rec.tier : 0;

    if (rec.outcome === 'answer') {
      var a = prompt.answers[rec.a], td = tierDef(rec.tier);
      body =
        '<div class="rv-icon s0">' + (t === 6 ? '<span class="rv-burst"></span>' : '') + Icons.tier(t) + '</div>' +
        '<h2 class="rv-tier s1" id="rv-title" tabindex="-1">' + esc(td.name) + '</h2>' +
        '<p class="rv-answer s2">“' + esc(a.name) + '”</p>' +
        '<p class="rv-pts s3">+' + td.points + ' PTS · sink ' + fmt(td.points * CFG.metresPerPoint) + ' m</p>' +
        '<p class="rv-flavor s4">' + esc(td.flavor) + '</p>' +
        '<p class="rv-verse s5">' + refsHtml(a.refs) + esc(a.note) + '</p>' +
        (a.fact && (t === 6 || t === 2) ? '<p class="rv-fact s5">' + esc(a.fact) + '</p>' : '') +
        (t === 6 ? '<div class="s5">' + passageHtml(a, 'rv-more') + '</div>' : '');
      spoken = td.name + '. ' + a.name + '. Plus ' + td.points + ' points, sink ' + fmt(td.points * CFG.metresPerPoint) + ' metres.';
    } else {
      body =
        '<div class="rv-icon s0">' + Icons.tier(0) + '</div>' +
        '<h2 class="rv-tier s1" id="rv-title" tabindex="-1">Nothing landed</h2>' +
        (extra.left
          ? '<p class="rv-answer rv-left s2">“' + esc(extra.left) + '”</p>' +
            '<p class="rv-pts s3">+0 PTS · ' + (extra.leftWasSuggestion ? 'it was waiting for your second cast.' : 'it never left the boat.') + '</p>'
          : '<p class="rv-answer s2">—</p>' +
            '<p class="rv-pts s3">+0 PTS · the clock beat you to it.</p>');
      spoken = 'Nothing landed. Plus zero.' + (extra.left ? ' “' + extra.left + '” was still in the box' + (extra.leftWasSuggestion ? ', waiting to be cast again.' : '.') : '');
    }
    var label = isLast ? 'Pull up the net ▲' : (mode === 'practice' ? 'Another cast ▼' : 'Go deeper ▼');

    show(
      '<section class="reveal-o" aria-labelledby="rv-title">' +
        '<div class="rv-shade"></div>' +
        '<div class="rv-body" data-t="' + t + '">' + body +
          '<div class="s6"><button type="button" class="go-btn" id="next">' + label + '</button></div>' +
          (mode === 'practice' ? '<div class="s6"><button type="button" class="link-btn" id="stop">Back to shore</button></div>' : '') +
        '</div>' +
      '</section>', null, 'play');
    if (tag) app.appendChild(tag);
    document.body.classList.add('revealing');
    hudOn(true);

    var next = document.getElementById('next');
    later(function () { next.focus({ preventScroll: true }); }, 500);
    say(spoken + ' Net at ' + fmt(depth) + ' metres.');
    next.onclick = function () {
      if (mode === 'practice') nextPractice();
      else if (isLast) renderResults(session);
      else showPrompt();
    };
    var stop = document.getElementById('stop');
    if (stop) stop.onclick = renderHome;
  }

  // ---------- pull up the net -------------------------------------------------
  function siteUrl() { return /^https?:$/.test(location.protocol) ? location.origin + location.pathname.replace(/index\.html$/, '') : ''; }
  function shareText(s, withUrl) {
    return Share.cardText({
      number: s.kind === 'endless' ? s.number : castNumber(s.date),
      label: s.kind === 'endless' ? 'Fishers Endless' : 'Fishers',
      tiers: s.results.map(function (r) { return r.tier; }),
      score: total(s.results), tierDefs: tiers,
      url: withUrl === false ? '' : siteUrl()
    });
  }

  // The cast log: one line per round, dropping from the surface to a tier icon
  // at the depth that answer sank. A missed round is an empty circle at the top.
  function castLogSvg(s) {
    var W = 330, H = 200, top = 26, bottom = 24, left = 52, maxM = 1000;
    var colW = (W - left - 8) / 7, span = H - top - bottom;
    var grid = [250, 500, 750, 1000].map(function (m) {
      var y = top + span * m / maxM;
      return '<line x1="' + left + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" class="cl-grid"/>' +
        '<text x="' + (left - 6) + '" y="' + (y + 3.5) + '" text-anchor="end" class="cl-m">' + fmt(m) + ' m</text>';
    }).join('');
    var cols = s.results.map(function (r, i) {
      var x = left + colW * i + colW / 2, depth = r.points * CFG.metresPerPoint, y = top + span * depth / maxM;
      var d = (i * 0.12).toFixed(2);
      var mark = r.tier
        ? '<rect x="' + (x - 1).toFixed(1) + '" y="' + top + '" width="2" height="' + Math.max(1, y - top).toFixed(1) + '" class="cl-line" style="color:var(--t' + r.tier + ');animation-delay:' + d + 's"/>' +
          '<g class="cl-icon" style="color:var(--t' + r.tier + ');animation-delay:' + (i * 0.12 + 0.55).toFixed(2) + 's">' +
            Icons.tier(r.tier, '', 'x="' + (x - 12).toFixed(1) + '" y="' + (y - 12).toFixed(1) + '" width="24" height="24"') + '</g>'
        : '<circle cx="' + x.toFixed(1) + '" cy="' + (top + 6) + '" r="5" class="cl-miss" style="animation-delay:' + d + 's"/>';
      return mark + '<text x="' + x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="cl-n">' + (i + 1) + '</text>';
    }).join('');
    var summary = s.results.map(function (r, i) { return 'cast ' + (i + 1) + ': ' + (r.tier ? tierDef(r.tier).name + ', ' + fmt(r.points * CFG.metresPerPoint) + ' m' : 'nothing landed'); }).join('; ');
    return '<figure class="cast-log"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cast log. ' + esc(summary) + '">' +
      '<line x1="' + left + '" x2="' + W + '" y1="' + top + '" y2="' + top + '" class="cl-surface"/>' + grid + cols + '</svg></figure>';
  }

  var BAND_ICON = [6, 5, 4, 3, 1];
  function bearingHtml(score) {
    var mine = band(score);
    return '<ol class="bearing">' + BANDS.map(function (b, i) {
      var hi = i === 0 ? MAX : BANDS[i - 1][0] - 1;
      var you = b[1] === mine;
      return '<li' + (you ? ' class="you"' : '') + ' style="color:var(--t' + BAND_ICON[i] + ')">' + Icons.tier(BAND_ICON[i]) +
        '<span class="b-name">' + esc(b[1]) + '</span><span class="b-range mono">' + b[0] + '–' + hi + '</span>' +
        (you ? '<span class="you-flag">YOU</span>' : '') + '</li>';
    }).join('') + '</ol>';
  }

  function catchList(s) {
    return '<ol class="the-catch">' + s.results.map(function (r, i) {
      var p = byId[r.id];
      return '<li data-t="' + r.tier + '">' +
        '<button type="button" class="catch-row" aria-expanded="false" data-i="' + i + '">' +
          '<span class="c-n mono">' + (i + 1) + '</span>' +
          '<span class="c-main"><span class="c-prompt">' + esc(p.prompt) + '</span>' +
          '<span class="c-ans">' + (r.outcome === 'answer' ? esc(r.name) : 'Nothing landed') + '</span>' +
          (r.outcome === 'answer' && refOf(p, r.a) ? '<span class="c-ref">' + esc(refOf(p, r.a)) + '</span>' : '') + '</span>' +
          '<span class="c-pts mono">' + (r.points ? '+' + r.points : '0') + '</span>' +
          '<span class="chev" aria-hidden="true">▾</span>' +
        '</button><div class="bank" hidden></div></li>';
    }).join('') + '</ol>';
  }

  // Where an answer is named: its first cited verse.
  function refOf(p, i) {
    var a = p && p.answers[i];
    return a && a.refs && a.refs[0] ? a.refs[0] : '';
  }

  // The whole net for one prompt: the Lost Sheep with its fact, then each tier.
  // Each answer shows its verse, except in very long tiers, where only yours does.
  var REF_LIMIT = 30;
  function bankHtml(p, rec) {
    var groups = {};
    p.answers.forEach(function (a, i) { (groups[a.tier] = groups[a.tier] || []).push({ a: a, i: i }); });
    var html = '<p class="small">' + p.answers.length + ' answers in this net, deepest first.</p>';
    for (var t = 6; t >= 1; t--) {
      var g = groups[t];
      if (!g) continue;
      g.sort(function (x, y) { return x.a.name.localeCompare(y.a.name); });
      var td = tierDef(t);
      html += '<section class="bank-tier" style="--c:var(--t' + t + ')">' +
        '<h4>' + Icons.tier(t) + esc(td.name) + ' <span class="mono">' + td.points + '</span></h4>';
      if ((t === 6 || t === 2) && g[0].a.fact) html += '<p class="bank-fact">' + esc(g[0].a.fact) + '</p>';
      if (t === 6) html += passageHtml(g[0].a, 'bank-more');
      html += '<ul class="bank-list">' + g.map(function (x) {
        var you = rec.outcome === 'answer' && rec.a === x.i;
        var ref = (you || g.length <= REF_LIMIT) ? refOf(p, x.i) : '';
        return '<li' + (you ? ' class="you"' : '') + '>' + esc(x.a.name) + (you ? ' <strong class="you-tag">YOU</strong>' : '') +
          (ref ? '<span class="b-ref">' + esc(ref) + '</span>' : '') + '</li>';
      }).join('') + '</ul></section>';
    }
    return html;
  }

  function renderResults(s) {
    mode = 'cast'; session = s;
    if (!done(s)) return renderHome();
    stopTimer(); stopCountdown(); clearPending();
    hudOn(false);
    setLayout('play');
    app.innerHTML = '';
    var my = ++screenNo;
    var last = s.results[s.results.length - 1];
    Scene.setMascot(last ? last.tier : 0);
    // The camera rises back to the surface with the fish, then the panel opens.
    Scene.go({ depth: 0, view: 'home', ms: 2000 }).then(function () {
      if (my === screenNo) drawResults(s);
    });
  }

  // How this cast compares with the player's own earlier Daily Casts (kept on
  // this device). Shown always; the players' percentile needs telemetry.
  function vsYou(s, score) {
    if (s.kind !== 'daily') return '';
    var past = (Store.get().stats.history || []).filter(function (h) { return h.date !== s.date; });
    if (!past.length) return 'Your first Daily Cast. Tomorrow there will be a mark to beat.';
    var avg = Math.round(past.reduce(function (a, h) { return a + h.score; }, 0) / past.length);
    var best = Math.max.apply(null, past.map(function (h) { return h.score; }));
    var line = score > best ? 'Your deepest cast yet, past your best of ' + best + '.'
      : score > avg ? 'Deeper than your average of ' + avg + ' (best ' + best + ').'
      : score === avg ? 'Right on your average of ' + avg + ' (best ' + best + ').'
      : 'Short of your average of ' + avg + ' (best ' + best + ').';
    return esc(line + ' ' + past.length + (past.length === 1 ? ' earlier cast.' : ' earlier casts.'));
  }

  function drawResults(s) {
    var score = total(s.results), depth = score * CFG.metresPerPoint;
    var isToday = s.kind === 'daily' && s.date === today();
    var streak = Store.currentStreak(today(), yesterday());
    var sub = s.kind === 'endless' ? '' : ' · ' + esc(prettyDate(s.date));
    var last = s.results[s.results.length - 1];

    show(
      '<section class="glass end" aria-labelledby="end-title">' +
        '<header class="end-head">' +
          '<p class="eyebrow">' + esc(title(s)) + sub + '</p>' +
          '<h2 id="end-title" tabindex="-1">Pull up the net</h2>' +
          '<p class="end-score"><span class="mono end-big">' + score + '</span><span class="end-of mono">/' + MAX + '</span>' +
            '<span class="end-depth mono">' + fmt(depth) + ' m</span></p>' +
          '<p class="end-band">' + esc(band(score)) + '</p>' +
          '<p class="small percentile" id="percentile" hidden></p>' +
          (vsYou(s, score) ? '<p class="vs-you">' + vsYou(s, score) + '</p>' : '') +
          '<svg class="end-fish" data-t="' + (last ? last.tier : 0) + '" aria-hidden="true"><use href="#ichthys"/></svg>' +
        '</header>' +
        '<h3 class="sec">Cast log</h3>' + castLogSvg(s) +
        '<h3 class="sec">The bearing</h3>' + bearingHtml(score) +
        '<pre class="share-card" id="share-card" aria-label="Shareable result, with no answers shown">' + esc(shareText(s)) + '</pre>' +
        '<div class="actions">' +
          (navigator.share ? '<button type="button" class="btn primary" id="share">Share</button>' : '') +
          '<button type="button" class="btn' + (navigator.share ? '' : ' primary') + '" id="copy">Copy result</button>' +
        '</div>' +
        '<p class="small" id="share-note" role="status"></p>' +
        '<div class="install-box" id="install-box" hidden></div>' +
        '<h3 class="sec">The catch</h3><p class="small">Tap a cast to see its whole net.</p>' + catchList(s) +
        (isToday ? '<p class="next-cast">' + (streak > 0 ? '<span aria-hidden="true">\u{1F525}</span> ' + streak + (streak === 1 ? ' day' : ' days') + ' · ' : '') +
          'next cast in <span id="until" class="mono"></span></p>' : '') +
        '<div class="actions">' +
          (s.kind !== 'daily' ? '<button type="button" class="btn" id="again">Cast this one again</button>' : '') +
          (s.kind === 'endless' ? '<button type="button" class="btn" id="en-next">Next Endless Cast</button>' : '') +
          '<button type="button" class="btn" id="practice">Practice Waters</button>' +
        '</div>' +
        '<button type="button" class="btn quiet" id="shore">Back to shore</button>' +
      '</section>', '#end-title', 'sheet');
    document.body.classList.add('end-view');
    if (window.FSHPwa) window.FSHPwa.installOffer(document.getElementById('install-box'));

    say('Pull up the net: ' + score + ' of ' + MAX + ' points, ' + fmt(depth) + ' metres. ' + band(score) + '.');

    var note = document.getElementById('share-note'), copyBtn = document.getElementById('copy');
    function copyResult() {
      Share.copy(shareText(s)).then(function (how) {
        if (how === 'copied') {
          copyBtn.textContent = 'copied ✓';
          note.textContent = 'Copied. Paste it anywhere.';
          toast('Copied ✓');
          later(function () { copyBtn.textContent = 'Copy result'; }, 2200);
        } else {
          note.textContent = 'Select the card above and copy it.';
          var range = document.createRange();
          range.selectNodeContents(document.getElementById('share-card'));
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        }
      });
    }
    copyBtn.onclick = copyResult;
    var shareBtn = document.getElementById('share');
    if (shareBtn) shareBtn.onclick = function () {
      Share.share(shareText(s, false), siteUrl()).then(function (how) {
        if (how === 'shared') note.textContent = 'Shared.';
        else if (how === 'failed') copyResult();   // no share sheet after all: copy instead
      });
    };

    app.querySelectorAll('.catch-row').forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute('data-i'), panel = b.nextElementSibling, open = b.getAttribute('aria-expanded') === 'true';
        if (!open && !panel.innerHTML) panel.innerHTML = bankHtml(byId[s.results[i].id], s.results[i]);
        // One net open at a time: close the others.
        if (!open) app.querySelectorAll('.catch-row[aria-expanded="true"]').forEach(function (o) {
          o.setAttribute('aria-expanded', 'false'); o.nextElementSibling.hidden = true;
        });
        b.setAttribute('aria-expanded', String(!open));
        panel.hidden = open;
        if (!open) b.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      };
    });

    var again = document.getElementById('again');
    if (again) again.onclick = function () { restart(s); play(s); };
    var enNext = document.getElementById('en-next');
    if (enNext) enNext.onclick = function () { play(endlessSession(s.number + 1)); };
    document.getElementById('practice').onclick = renderPracticeSetup;
    document.getElementById('shore').onclick = renderHome;

    if (s.kind === 'daily') {
      Tele.percentile(castNumber(s.date), score).then(function (pct) {
        var el = document.getElementById('percentile');
        if (el && pct != null) { el.textContent = 'Better than ' + pct + '% of players today.'; el.hidden = false; }
      });
    }
    if (isToday) {
      var until = document.getElementById('until');
      var paint = function () {
        if (today() !== s.date) { renderHome(); return; }
        var sec = Math.ceil(D.msToNextCast(new Date()) / 1000);
        var two = function (n) { return (n < 10 ? '0' : '') + n; };
        until.textContent = two(Math.floor(sec / 3600)) + ':' + two(Math.floor(sec / 60) % 60) + ':' + two(sec % 60);
      };
      paint();
      countdown = setInterval(paint, 1000);
    }
  }

  // ---------- practice ------------------------------------------------------
  function renderPracticeSetup() {
    mode = 'practice';
    hudOn(false);
    practice.results = [];
    syncScene(true, "home");
    var cats = [];
    data.prompts.forEach(function (p) { if (cats.indexOf(p.category) === -1) cats.push(p.category); });
    cats.sort();
    var settings = Store.get().settings;
    show(
      '<section class="card practice" aria-labelledby="pr-title">' +
        '<p class="eyebrow">Practice Waters</p>' +
        '<h2 id="pr-title" tabindex="-1">Fish as long as you like</h2>' +
        '<p class="lede">Single prompts, one after another. Nothing here touches your streak or stats.</p>' +
        '<label for="pr-cat">Category</label>' +
        '<select id="pr-cat"><option value="">Any category</option>' +
          cats.map(function (c) { return '<option' + (c === practice.category ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
        '</select>' +
        '<label class="check"><input type="checkbox" id="pr-timer"' + (settings.practiceTimer !== false ? ' checked' : '') + '> Use the 25-second timer</label>' +
        '<div class="actions">' +
          '<button type="button" class="btn primary" id="pr-go">Start</button>' +
          '<button type="button" class="btn" id="pr-back">Back to shore</button>' +
        '</div>' +
      '</section>', '#pr-title');
    document.getElementById('pr-go').onclick = function () {
      practice.category = document.getElementById('pr-cat').value;
      settings.practiceTimer = document.getElementById('pr-timer').checked;
      Store.save();
      nextPractice();
    };
    document.getElementById('pr-back').onclick = renderHome;
  }

  function nextPractice() {
    mode = 'practice';
    if (total(practice.results) >= 600) practice.results = [];   // back toward the surface before the floor
    var todays = dailySession().ids;
    var pool = data.prompts.filter(function (p) {
      return todays.indexOf(p.id) === -1 && (!practice.category || p.category === practice.category);
    });
    var fresh = pool.filter(function (p) { return !practice.seen[p.id]; });
    if (!fresh.length) { practice.seen = {}; fresh = pool; }
    if (!fresh.length) { renderPracticeSetup(); say('Every prompt in that category is in today’s cast. Try another category.'); return; }
    practice.current = fresh[Math.floor(Math.random() * fresh.length)];
    practice.seen[practice.current.id] = true;
    showPrompt();
  }

  // ---------- dialogs ---------------------------------------------------------
  function openDialog(dlg) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }

  function renderStats() {
    var st = Store.get().stats;
    var streak = Store.currentStreak(today(), yesterday());
    var avg = st.played ? Math.round(st.totalScore / st.played) : 0;
    var max = Math.max.apply(null, st.tierCounts.concat([1]));
    var bars = [];
    for (var t = 6; t >= 0; t--) {
      var label = t ? tierDef(t).emoji + ' ' + tierDef(t).name : '⬛ Nothing landed';
      bars.push('<li><span class="bar-label">' + esc(label) + '</span>' +
        '<span class="bar"><span style="width:' + (100 * (st.tierCounts[t] || 0) / max).toFixed(0) + '%"></span></span>' +
        '<span class="bar-n">' + (st.tierCounts[t] || 0) + '</span></li>');
    }
    document.getElementById('stats-body').innerHTML =
      '<dl class="stat-grid">' +
        '<div><dt>Casts</dt><dd>' + st.played + '</dd></div>' +
        '<div><dt>Streak</dt><dd>' + streak + '</dd></div>' +
        '<div><dt>Best streak</dt><dd>' + st.bestStreak + '</dd></div>' +
        '<div><dt>Best haul</dt><dd>' + st.bestScore + '</dd></div>' +
        '<div><dt>Average</dt><dd>' + avg + '</dd></div>' +
        '<div><dt>Deepest</dt><dd>' + fmt(st.bestScore * CFG.metresPerPoint) + ' m</dd></div>' +
      '</dl>' +
      '<h3>Your catches by tier</h3><ul class="bars">' + bars.join('') + '</ul>' +
      '<p class="small">Daily Casts only. Kept on this device.</p>';
  }

  // ---------- corner buttons, menu, settings, keyboard -----------------------
  function wireChrome() {
    var st = Store.get(), settings = st.settings;
    var menu = document.getElementById('dlg-menu'), set = document.getElementById('dlg-settings');
    var soundBtn = document.getElementById('btn-sound');
    function closeMenu() { if (menu.open) menu.close(); }
    function applySound() {
      Sound.set(!!settings.sound);
      soundBtn.setAttribute('aria-pressed', String(!!settings.sound));
      soundBtn.setAttribute('aria-label', settings.sound ? 'Sound on' : 'Sound off');
      document.getElementById('set-sound').checked = !!settings.sound;
    }
    applySound();
    soundBtn.onclick = function () { settings.sound = !settings.sound; Store.save(); applySound(); if (settings.sound) Sound.plop(); };
    document.getElementById('btn-menu').onclick = document.getElementById('hud-menu').onclick = function () { openDialog(menu); };
    document.getElementById('menu-help').onclick = function () { closeMenu(); openDialog(document.getElementById('dlg-help')); };
    document.getElementById('menu-stats').onclick = function () { closeMenu(); renderStats(); openDialog(document.getElementById('dlg-stats')); };
    document.getElementById('menu-about').onclick = function () { closeMenu(); openDialog(document.getElementById('dlg-about')); };
    document.getElementById('build-version').textContent = CFG.version || 'dev';
    document.getElementById('menu-shore').onclick = function () { closeMenu(); renderHome(); };
    document.getElementById('btn-settings').onclick = function () {
      document.getElementById('set-typeahead').checked = settings.typeahead !== false;
      openDialog(set);
    };
    document.getElementById('set-sound').onchange = function (e) { settings.sound = e.target.checked; Store.save(); applySound(); };
    document.getElementById('set-typeahead').onchange = function (e) { settings.typeahead = e.target.checked; Store.save(); };

    // Keep the input bar above the on-screen keyboard.
    var vv = window.visualViewport;
    if (vv) {
      var fit = function () {
        var kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        document.documentElement.style.setProperty('--kb', kb + 'px');
        document.body.classList.toggle('kb', kb > 80);
      };
      vv.addEventListener('resize', fit);
      vv.addEventListener('scroll', fit);
      fit();
    }
  }

  // ---------- start ---------------------------------------------------------
  // The six tiers, as in content/tiers.json, so the help dialog draws before the
  // bank loads. boot() redraws the list only if the bank's tiers differ.
  var EARLY_TIERS = [
    { id: 1, name: 'Mustard Seed', points: 10, emoji: '🌱', blurb: 'the answer everyone gives', flavor: 'The first answer in every net. Small, but it counts.' },
    { id: 2, name: 'Best Seat', points: 15, emoji: '🪑', blurb: 'you thought it was the place of honor', flavor: 'You went for the place of honor. So did everyone else.', ref: 'Luke 14:8–10' },
    { id: 3, name: 'Five Loaves', points: 30, emoji: '🍞', blurb: 'a common answer', flavor: 'A good, honest catch. Enough to share.' },
    { id: 4, name: 'Lost Coin', points: 60, emoji: '🪙', blurb: 'genuinely uncommon', flavor: 'Worth lighting a lamp and sweeping the house for.' },
    { id: 5, name: 'Hidden Treasure', points: 85, emoji: '💎', blurb: 'a deep cut', flavor: 'Few people dig this deep.' },
    { id: 6, name: 'The Lost Sheep', points: 100, emoji: '🐑', blurb: 'the one out of a hundred', flavor: 'The one out of a hundred. Worth leaving the ninety-nine for.', ref: 'Luke 15:4' }
  ];

  // First paint: the world, the corner buttons and the home screen, without
  // waiting for the prompt bank (1.25 MB).
  function start() {
    drawHelpTiers(EARLY_TIERS);
    Scene.init(document.getElementById('scene'), []);
    hud = { m: document.getElementById('hud-m'), zone: document.getElementById('hud-zone'), sq: document.getElementById('hud-sq'),
            cast: document.getElementById('hud-cast'), score: document.getElementById('hud-score') };
    Scene.onFrame(onFrame);
    wireChrome();
    renderHome();
    var st = Store.get(), d = storedDaily();
    if (!st.stats.played && !d.results.length && !d.startedAt) openDialog(document.getElementById('dlg-help'));
  }

  function boot(loaded) {
    data = loaded;
    tiers = data.tiers;
    data.prompts.forEach(function (p) { byId[p.id] = p; });
    typeahead = window.FSHTypeahead ? window.FSHTypeahead.create(data.lexicon || []) : null;
    Scene.setMarkers(data.markers || []);

    if (JSON.stringify(tiers) !== JSON.stringify(EARLY_TIERS)) drawHelpTiers(tiers);
    if (document.body.classList.contains('view-home') && document.getElementById('go')) {
      session = dailySession();
      wireHome();
      if (pendingHome) { var fn = pendingHome; pendingHome = null; fn(); }
    }
  }

  function drawHelpTiers(list) {
    document.getElementById('help-tiers').innerHTML = list.map(function (t) {
      return '<li class="tier-' + t.id + '"><span aria-hidden="true">' + t.emoji + '</span>' +
        '<span>' + esc(t.name) + '</span><strong>' + t.points + '</strong>' +
        '<span class="t-desc">' + esc(t.blurb) + (t.ref ? ' <span class="ref">(' + esc(t.ref) + ')</span>' : '') + '</span></li>';
    }).join('');
  }

  start();
  // Fetch the bank once the page has loaded and painted, so its 1.25 MB never
  // competes with the first paint. The home screen is already showing; its
  // buttons wake up when the bank arrives.
  function loadBank() { return window.FSHData.load().then(boot); }
  function afterPaint(r) { setTimeout(r, 250); }
  new Promise(function (r) {
    if (document.readyState === 'complete') afterPaint(r);
    else window.addEventListener('load', function () { afterPaint(r); }, { once: true });
  }).then(loadBank).catch(function (err) {
    var offline = navigator.onLine === false;
    var why = location.protocol === 'file:'
      ? 'If you opened this file directly, make sure <code>data/prompts.js</code> exists (run <code>node tools/sync-data.js</code>).'
      : offline
        ? 'You’re offline, and today’s prompts haven’t been saved on this device yet. Connect once and they’ll be kept for offline play.'
        : 'Check your connection and try again.';
    setLayout('sheet');
    app.innerHTML = '<section class="card" role="alert"><h2>' + (offline ? 'The boat is ashore' : 'The nets are tangled') + '</h2>' +
      '<p>The prompt bank could not be loaded. ' + why + '</p>' +
      '<p><button type="button" class="btn" id="retry-load">Try again</button></p>' +
      '<p class="small">' + esc(err && err.message) + '</p></section>';
    document.getElementById('retry-load').onclick = function () { location.reload(); };
  });
})();
