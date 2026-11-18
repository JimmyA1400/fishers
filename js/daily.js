/* Fishers: which prompts make up a cast.
 *
 * Everything here is a pure function of its seed, so every player gets the
 * same Daily Cast on a given date (YYYY-MM-DD in local time), and Endless
 * Cast #N is the same for everyone too.
 *
 * Rules for a cast of seven:
 *   - no two prompts from the same category;
 *   - at most one closed set (a fixed list under 60 answers);
 *   - each category walks through its prompts in a shuffled order, so a
 *     prompt does not come back until the rest of its category has had a turn.
 */
(function (root) {
  'use strict';

  // ---------- seeded random numbers -------------------------------------
  function hash(str) {            // xmur3
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function rng(seedStr) {         // mulberry32
    var a = hash(seedStr);
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(n, seedStr) {
    var r = rng(seedStr), a = [], i, j, t;
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) {
      j = Math.floor(r() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function mod(a, n) { return ((a % n) + n) % n; }

  // ---------- dates ------------------------------------------------------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // Every player shares one calendar: the date in New York (US Eastern),
  // whatever the device's own time zone. A new cast starts at midnight Eastern.
  var TZ = 'America/New_York';
  var fmtCache = null;
  function parts(d) {
    if (!fmtCache) {
      fmtCache = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
    var out = {};
    fmtCache.formatToParts(d).forEach(function (p) { if (p.type !== 'literal') out[p.type] = Number(p.value); });
    if (out.hour === 24) out.hour = 0;
    return out;
  }
  function dateKey(d) {
    var p = parts(d || new Date());
    return p.year + '-' + pad(p.month) + '-' + pad(p.day);
  }
  // Milliseconds from `now` until the next midnight in New York. Days are
  // 23 or 25 hours long when the clocks change, so this finds the actual
  // instant rather than counting 24 hours.
  function offsetMs(d) {              // Eastern wall clock minus UTC, at instant d
    var p = parts(d);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000;
  }
  function msToNextCast(now) {
    now = now || new Date();
    var k = dateKey(now).split('-').map(Number);
    var wall = Date.UTC(k[0], k[1] - 1, k[2] + 1);   // tomorrow 00:00 on the Eastern clock
    var t = wall - offsetMs(now);
    t = wall - offsetMs(new Date(t));
    return Math.max(0, t - now.getTime());
  }
  function toUTC(key) {
    var p = key.split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  }
  function dayNumber(key, epoch) {
    return Math.round((toUTC(key) - toUTC(epoch)) / 86400000);
  }
  function addDays(key, n) {
    var d = new Date(toUTC(key) + n * 86400000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  // ---------- rotation within a category ----------------------------------
  // Each cycle through a category is a fresh shuffle whose opening avoids the
  // prompts that closed the previous cycle.
  var orderCache = {};
  function orderFor(cat, len, cycle) {
    if (cycle < 0) return shuffled(len, cat + '|' + cycle);
    var key = cat + '|' + len;
    var list = orderCache[key] || (orderCache[key] = []);
    var guard = Math.min(3, Math.floor((len - 1) / 2));
    for (var k = list.length; k <= cycle; k++) {
      var perm = shuffled(len, cat + '|' + k);
      if (k > 0 && guard > 0) {
        var tail = list[k - 1].slice(len - guard);
        for (var i = 0; i < guard; i++) {
          if (tail.indexOf(perm[i]) === -1) continue;
          for (var j = guard; j < len; j++) {
            if (tail.indexOf(perm[j]) === -1) { var t = perm[i]; perm[i] = perm[j]; perm[j] = t; break; }
          }
        }
      }
      list.push(perm);
    }
    return list[cycle];
  }

  function groups(data) {
    var cats = [], byCat = {};
    data.prompts.forEach(function (p) {
      if (!byCat[p.category]) { byCat[p.category] = []; cats.push(p.category); }
      byCat[p.category].push(p);
    });
    cats.sort();
    return { cats: cats, byCat: byCat };
  }

  // The open slots: the categories that have open prompts take turns in one
  // shared rotation, as evenly as the one-per-category rule allows (a
  // category blocked by the day's closed set goes first the next day), and
  // each category walks through its own open prompts one use at a time. The
  // walk is simulated from step 0 and remembered, so any step gives the same
  // answer every time.
  var openMemo = null;
  function openPicks(data, closedAll, step, count) {
    var open = data.prompts.filter(function (p) { return !p.closed; }), cn = closedAll.length;
    var cats = [], byCat = {};
    open.forEach(function (p) { if (!byCat[p.category]) { byCat[p.category] = []; cats.push(p.category); } byCat[p.category].push(p); });
    cats.sort();
    var slots = count - (cn ? 1 : 0), k = cats.length;
    var sig = open.length + '|' + cn + '|' + slots + '|' + cats.join(',');
    if (!openMemo || openMemo.sig !== sig) openMemo = { sig: sig, days: [], pos: 0, waiting: [], uses: {} };
    var m = openMemo;
    while (m.days.length <= step && k) {
      var d = m.days.length, used = {}, day = [], still = [];
      if (cn) used[closedAll[orderFor('closed-sets', cn, Math.floor(d / cn))[mod(d, cn)]].category] = true;
      var take = function (cat) {
        var list = byCat[cat], n = list.length, u = m.uses[cat] || 0;
        day.push(list[orderFor(cat + '|open', n, Math.floor(u / n))[mod(u, n)]]);
        m.uses[cat] = u + 1; used[cat] = true;
      };
      m.waiting.forEach(function (cat) { if (day.length < slots && !used[cat]) take(cat); else if (!used[cat]) still.push(cat); });
      for (var guard = 0; day.length < slots && guard < k * 2; guard++) {
        var cat = cats[orderFor('open-cats', k, Math.floor(m.pos / k))[mod(m.pos, k)]];
        m.pos++;
        if (used[cat]) { if (still.indexOf(cat) === -1 && day.indexOf(cat) === -1) still.push(cat); } else take(cat);
      }
      m.waiting = still.slice(0, k);
      m.days.push(day);
    }
    return k ? m.days[step] : [];
  }

  // seed: a string unique to the cast ("2026-11-17", "endless|12").
  // step: a number that advances by one per cast, for the category rotations.
  // Each cast has exactly one closed set, taken from its own rotation through
  // every closed set (so none is starved by the one-per-cast limit), and the
  // rest are open prompts, one per category, each category rotating through
  // its own open prompts. No two prompts in a cast share a category.
  function pickCast(data, seed, step, count) {
    count = count || 7;
    var g = groups(data);
    var closedAll = data.prompts.filter(function (p) { return p.closed; });
    var picked = [];
    if (closedAll.length) {
      var cn = closedAll.length;
      picked.push(closedAll[orderFor('closed-sets', cn, Math.floor(step / cn))[mod(step, cn)]]);
    }
    openPicks(data, closedAll, Math.max(0, step), count).forEach(function (p) { picked.push(p); });
    var order = shuffled(picked.length, 'order|' + seed);
    return order.map(function (ix) { return picked[ix]; });
  }

  function pickDaily(data, key, config) {
    var epoch = (config && config.epoch) || '2026-11-17';
    return pickCast(data, key, dayNumber(key, epoch), (config && config.promptsPerDay) || 7);
  }

  function pickEndless(data, n, config) {
    // Offset the rotation so Endless casts do not mirror the dailies.
    return pickCast(data, 'endless|' + n, 5000 + n * 3, (config && config.promptsPerDay) || 7);
  }

  // ---------- theme of the week -----------------------------------------
  // A new theme every Monday (Eastern). Themes with at least a full cast of
  // prompts take turns in a fixed shuffled order; the week's seven prompts
  // are a seeded pick from that theme, so every player gets the same cast.
  var THEME_CAST = 7;
  function weekStart(key) {
    var dow = new Date(toUTC(key)).getUTCDay();          // 0 = Sunday
    return addDays(key, -mod(dow - 1, 7));
  }
  function themeRotation(data) {
    var count = {};
    data.prompts.forEach(function (p) { count[p.theme] = (count[p.theme] || 0) + 1; });
    var names = Object.keys(data.themes || {}).filter(function (t) { return (count[t] || 0) >= THEME_CAST; }).sort();
    return shuffled(names.length, 'themes').map(function (i) { return names[i]; });
  }
  function pickThemeWeek(data, key, config) {
    var epoch = (config && config.epoch) || '2026-11-17';
    var week = weekStart(key), n = Math.round(dayNumber(week, weekStart(epoch)) / 7);
    var rot = themeRotation(data);
    if (!rot.length) return null;
    var theme = rot[mod(n, rot.length)];
    var pool = data.prompts.filter(function (p) { return p.theme === theme; });
    var picks = shuffled(pool.length, 'theme|' + week).slice(0, THEME_CAST).map(function (i) { return pool[i]; });
    return { week: week, number: n + 1, theme: theme, prompts: picks };
  }

  // ---------- group casts ----------------------------------------------
  // A group code (a church name, or a random code) picks seven prompts the
  // same way on every device, so a group can play one cast with no server.
  function groupCode(raw) {
    var c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return c.length >= 3 && c.length <= 12 ? c : '';
  }
  function pickGroup(data, code, config) {
    var c = groupCode(code);
    if (!c) return [];
    // Like a daily (one closed set, the rest from different categories), but
    // drawn straight from a seeded shuffle, so it is quick on any phone.
    var count = (config && config.promptsPerDay) || 7, seed = 'group|' + c;
    var closed = data.prompts.filter(function (p) { return p.closed; });
    var open = data.prompts.filter(function (p) { return !p.closed; });
    var picked = [], cats = {};
    if (closed.length) { var k = closed[shuffled(closed.length, seed + '|closed')[0]]; picked.push(k); cats[k.category] = 1; }
    var order = shuffled(open.length, seed + '|open');
    for (var i = 0; i < order.length && picked.length < count; i++) {
      var p = open[order[i]];
      if (!cats[p.category]) { cats[p.category] = 1; picked.push(p); }
    }
    for (i = 0; i < order.length && picked.length < count; i++) {   // fewer categories than slots
      if (picked.indexOf(open[order[i]]) < 0) picked.push(open[order[i]]);
    }
    return shuffled(picked.length, seed + '|order').map(function (ix) { return picked[ix]; });
  }
  var CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L
  function newGroupCode(random) {
    var r = random || Math.random, s = '';
    for (var i = 0; i < 6; i++) s += CODE_CHARS.charAt(Math.floor(r() * CODE_CHARS.length));
    return s;
  }

  var api = {
    groupCode: groupCode, pickGroup: pickGroup, newGroupCode: newGroupCode,
    weekStart: weekStart, themeRotation: themeRotation, pickThemeWeek: pickThemeWeek,
    hash: hash, rng: rng, shuffled: shuffled, dateKey: dateKey, dayNumber: dayNumber, msToNextCast: msToNextCast, TZ: TZ,
    addDays: addDays, pickCast: pickCast, pickDaily: pickDaily, pickEndless: pickEndless
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FSHDaily = api;
})(typeof window !== 'undefined' ? window : this);
