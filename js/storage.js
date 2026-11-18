/* Fishers: everything the game remembers lives in localStorage on the player's
 * own device, under one key. Nothing here is sent anywhere. */
(function () {
  'use strict';
  var KEY = 'fishers.v1';
  // The game's earlier name. Read once so returning players keep their
  // streak and stats, then removed.
  var LEGACY_KEY = 'into-the-deep.v1';
  // Earlier tiers 1-6 folded onto today's tiers (1 Mustard Seed, 3 Five Loaves,
  // 4 Lost Coin, 5 Hidden Treasure). Index 0 is "nothing landed".
  var LEGACY_TIER = [0, 1, 3, 4, 5, 5, 5];
  var memory = null;

  function blank() {
    return {
      stats: {
        played: 0, totalScore: 0, bestScore: 0,
        streak: 0, bestStreak: 0, lastCompleted: null,
        tierCounts: [0, 0, 0, 0, 0, 0, 0],   // index 0 = nothing landed, 1-6 = tiers
        history: []                           // [{date, score, tiers}], newest last
      },
      daily: null,
      casts: {},                              // archive and endless casts, by key
      settings: { practiceTimer: true, sound: false, typeahead: true },
      migratedFrom: null
    };
  }

  function merge(into, saved) {
    if (!saved || typeof saved !== 'object') return;
    if (saved.stats) for (var k in into.stats) if (saved.stats[k] != null) into.stats[k] = saved.stats[k];
    if (saved.daily) into.daily = saved.daily;
    if (saved.casts) into.casts = saved.casts;
    if (saved.settings) for (var j in into.settings) if (saved.settings[j] != null) into.settings[j] = saved.settings[j];
    if (saved.migratedFrom) into.migratedFrom = saved.migratedFrom;
  }

  function migrateLegacy(s) {
    var raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return false;
    var old = JSON.parse(raw);
    var st = old && old.stats;
    if (st) {
      ['played', 'totalScore', 'bestScore', 'streak', 'bestStreak', 'lastCompleted'].forEach(function (k) {
        if (st[k] != null) s.stats[k] = st[k];
      });
      if (Array.isArray(st.tierCounts)) {
        var counts = [0, 0, 0, 0, 0, 0, 0];
        st.tierCounts.forEach(function (n, t) { counts[LEGACY_TIER[t] || 0] += n || 0; });
        s.stats.tierCounts = counts;
      }
      if (Array.isArray(st.history)) {
        s.stats.history = st.history.map(function (h) {
          return { date: h.date, score: h.score, tiers: (h.tiers || []).map(function (t) { return LEGACY_TIER[t] || 0; }) };
        });
      }
    }
    if (old && old.settings) merge(s, { settings: old.settings });
    // A cast in progress under the old prompt set cannot be resumed; drop it.
    s.migratedFrom = LEGACY_KEY;
    return true;
  }

  function read() {
    if (memory) return memory;
    var s = blank();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) merge(s, JSON.parse(raw));
      else if (migrateLegacy(s)) {
        localStorage.setItem(KEY, JSON.stringify(s));
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch (e) { /* private mode or blocked storage: play on without saving */ }
    memory = s;
    return s;
  }

  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) { /* ignore */ }
  }

  // Record a finished Daily Cast. Safe to call twice: a date only counts once.
  function recordDaily(date, score, tiers, yesterday) {
    var st = read().stats;
    if (st.lastCompleted === date) return st;
    st.streak = st.lastCompleted === yesterday ? st.streak + 1 : 1;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    st.lastCompleted = date;
    st.played += 1;
    st.totalScore += score;
    st.bestScore = Math.max(st.bestScore, score);
    tiers.forEach(function (t) { st.tierCounts[t] = (st.tierCounts[t] || 0) + 1; });
    st.history.push({ date: date, score: score, tiers: tiers });
    if (st.history.length > 400) st.history = st.history.slice(-400);
    write();
    return st;
  }

  // The streak to display: it lapses once a whole day has been missed.
  function currentStreak(today, yesterday) {
    var st = read().stats;
    return (st.lastCompleted === today || st.lastCompleted === yesterday) ? st.streak : 0;
  }

  window.FSHStore = { get: read, save: write, recordDaily: recordDaily, currentStreak: currentStreak, KEY: KEY };
})();
