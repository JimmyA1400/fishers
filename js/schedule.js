/* Fishers: the daily schedule.
 *
 * The daily casts are precomputed in data/schedule.json by
 * scripts/build-schedule.js and checked by scripts/check-schedule.js, so
 * every player gets the same seven prompts on a date (Eastern) and no prompt
 * comes back too soon. This file holds the rules, the checker, the day picker
 * the builder uses, and the runtime fallback for a date the schedule does not
 * cover yet. It runs in the browser (window.FSHSchedule) and in Node.
 *
 * Hard rules (for every day after the freeze line):
 *   cooldown   a prompt waits at least `cooldown` days before it comes back;
 *              prompts in one family that share half their answers ("twins")
 *              count as the same prompt
 *   pairs      two days within `pairWindow` days share at most `pairMax` prompts
 *   order      a prompt never plays in the same round as its last appearance
 *   family     one prompt per family per day; back-to-back days never put the
 *              same family in the same round (so no family leads off twice)
 *   balance    at most 2 People, 2 Places and `closedMax` closed sets a day,
 *              and at least 4 categories
 *   fresh      back-to-back days share no prompt
 */
(function (root) {
  'use strict';
  var D = root.FSHDaily || (typeof require === 'function' ? require('./daily.js') : null);

  var RULES = {
    perDay: 7,
    cooldown: 14,        // the hard floor; the target is 30
    pairMax: 2,
    pairWindow: 365,
    closedMax: 1,
    categoryMax: { People: 2, Places: 2 },
    minCategories: 4,
    twinOverlap: 0.5,
    // The share is of the larger prompt's answers (changed from 'smaller' on
    // 2026-11-19: measured against the smaller one, the big book prompts were
    // twins of nearly every other book prompt and Isaiah and Psalms never aired).
    twinBasis: 'larger'
  };
  var FLOOR = 7;         // the absolute floor for any cooldown setting

  function rulesFor(sched, extra) {
    var r = {}, k;
    for (k in RULES) r[k] = RULES[k];
    if (sched && sched.rules) for (k in sched.rules) r[k] = sched.rules[k];
    if (extra) for (k in extra) r[k] = extra[k];
    return r;
  }

  // ---------- the prompt bank, indexed ----------------------------------
  function answerSet(p) {
    var s = {};
    p.answers.forEach(function (a) { s[a.name.toLowerCase()] = 1; });
    return s;
  }
  // Prompts in the same family sharing at least `overlap` of the smaller
  // prompt's answers.
  function computeTwins(data, overlap, basis) {
    var fam = {}, out = {};
    data.prompts.forEach(function (p) { (fam[p.family || p.id] = fam[p.family || p.id] || []).push(p); });
    Object.keys(fam).forEach(function (f) {
      var list = fam[f], sets = list.map(answerSet), sizes = sets.map(function (s) { return Object.keys(s).length; });
      for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
        var n = 0, a = sets[i], b = sets[j];
        for (var k in a) if (b[k]) n++;
        if (n / (basis === 'larger' ? Math.max(sizes[i], sizes[j]) : Math.min(sizes[i], sizes[j])) >= overlap) {
          (out[list[i].id] = out[list[i].id] || []).push(list[j].id);
          (out[list[j].id] = out[list[j].id] || []).push(list[i].id);
        }
      }
    });
    Object.keys(out).forEach(function (id) { out[id].sort(); });
    return out;
  }

  var ixCache = null;
  function index(data, sched) {
    if (ixCache && ixCache.data === data && ixCache.sched === sched) return ixCache.ix;
    var byId = {}, active = [];
    data.prompts.forEach(function (p) { byId[p.id] = p; if (!p.retired) active.push(p.id); });
    var tw = (sched && sched.twins) || computeTwins(data, rulesFor(sched).twinOverlap, rulesFor(sched).twinBasis);
    var twins = {};
    data.prompts.forEach(function (p) { twins[p.id] = [p.id].concat(tw[p.id] || []); });
    var ix = {
      byId: byId, active: active, twins: twins,
      fam: function (id) { return byId[id] ? byId[id].family || id : id; },
      cat: function (id) { return byId[id] ? byId[id].category : ''; },
      closed: function (id) { return !!(byId[id] && byId[id].closed); },
      narrow: function (id) { var p = byId[id]; return !!p && (p.closed || p.answers.length < 100); }
    };
    ixCache = { data: data, sched: sched, ix: ix };
    return ix;
  }

  // ---------- history: who played when ----------------------------------
  // Day i is the i-th consecutive date from `start`.
  function History(start) { this.start = start; this.days = []; this.apps = {}; }
  History.prototype.push = function (ids) {
    var i = this.days.length, apps = this.apps;
    this.days.push(ids);
    ids.forEach(function (id, r) { (apps[id] = apps[id] || []).push([i, r]); });
  };
  History.prototype.pop = function () {
    var ids = this.days.pop(), apps = this.apps;
    ids.forEach(function (id) { apps[id].pop(); });
    return ids;
  };
  History.prototype.last = function (id, before) {
    var a = this.apps[id];
    if (!a) return null;
    for (var k = a.length - 1; k >= 0; k--) if (before == null || a[k][0] < before) return a[k];
    return null;
  };
  History.prototype.key = function (i) { return D.addDays(this.start, i); };

  // ---------- one day's rules ------------------------------------------
  // Why `id` cannot join `picked` (the day so far) on day i, or '' if it can.
  function blocks(ix, R, h, i, picked, id, counts) {
    var p = ix.byId[id];
    if (!p || p.retired) return 'unknown or retired';
    if (picked.indexOf(id) >= 0) return 'twice in a day';
    var f = ix.fam(id), c = ix.cat(id), nCat = 0, closed = 0;
    for (var k = 0; k < picked.length; k++) {
      if (ix.fam(picked[k]) === f) return 'family ' + f + ' twice';
      if (ix.cat(picked[k]) === c) nCat++;
      if (ix.closed(picked[k])) closed++;
    }
    if (R.categoryMax[c] != null && nCat + 1 > R.categoryMax[c]) return 'too many ' + c;
    if (p.closed && closed + 1 > R.closedMax) return 'too many closed sets';
    var tw = ix.twins[id] || [id];
    for (k = 0; k < tw.length; k++) {
      var l = h.last(tw[k], i);
      if (l && i - l[0] < R.cooldown) return 'cooldown (' + tw[k] + ' ' + (i - l[0]) + 'd ago)';
    }
    if (counts) {
      var a = h.apps[id] || [];
      for (k = a.length - 1; k >= 0; k--) {
        if (a[k][0] >= i) continue;
        if (i - a[k][0] >= R.pairWindow) break;
        if ((counts[a[k][0]] || 0) + 1 > R.pairMax) return 'shares ' + (R.pairMax + 1) + ' with ' + h.key(a[k][0]);
      }
    }
    return '';
  }
  function addCounts(h, i, id, counts, R, sign) {
    var a = h.apps[id] || [];
    for (var k = a.length - 1; k >= 0; k--) {
      if (a[k][0] >= i) continue;
      if (i - a[k][0] >= R.pairWindow) break;
      counts[a[k][0]] = (counts[a[k][0]] || 0) + sign;
    }
  }
  function categories(ix, ids) {
    var s = {};
    ids.forEach(function (id) { s[ix.cat(id)] = 1; });
    return Object.keys(s).length;
  }

  // Round order for a chosen set: a prompt never repeats its last round, and
  // no round holds the same family as yesterday's. Among the valid orders,
  // prefer rounds the prompt has used least, closed sets spread across the
  // rounds, and broad and narrow prompts mixed rather than bunched.
  var PERMS = null;
  function perms() {
    if (PERMS) return PERMS;
    PERMS = [];
    (function rec(a, rest) {
      if (!rest.length) { PERMS.push(a); return; }
      for (var k = 0; k < rest.length; k++) rec(a.concat([rest[k]]), rest.slice(0, k).concat(rest.slice(k + 1)));
    })([], [0, 1, 2, 3, 4, 5, 6]);
    return PERMS;
  }
  function orderDay(ix, h, i, ids, rnd) {
    var n = ids.length;
    var yest = i > 0 && h.days[i - 1] ? h.days[i - 1] : null;
    var lastR = ids.map(function (id) { var l = h.last(id, i); return l ? l[1] : -1; });
    var used = ids.map(function (id) {
      var u = [0, 0, 0, 0, 0, 0, 0];
      (h.apps[id] || []).forEach(function (a) { if (a[0] < i) u[a[1]]++; });
      return u;
    });
    var fam = ids.map(function (id) { return ix.fam(id); });
    var narrow = ids.map(function (id) { return ix.narrow(id); });
    var jitter = ids.map(function () { return rnd ? rnd() : 0; });
    var best = null, bestScore = Infinity, list = n === 7 ? perms() : null;
    if (!list) { list = []; (function rec(a, rest) { if (!rest.length) { list.push(a); return; } for (var k = 0; k < rest.length; k++) rec(a.concat([rest[k]]), rest.slice(0, k).concat(rest.slice(k + 1))); })([], ids.map(function (x, k) { return k; })); }
    for (var q = 0; q < list.length; q++) {
      var perm = list[q], ok = true, score = 0;
      for (var r = 0; r < n && ok; r++) {
        var s = perm[r];
        if (lastR[s] === r) ok = false;
        else if (yest && yest[r] && ix.fam(yest[r]) === fam[s]) ok = false;
        else {
          score += used[s][r] * 2 + jitter[s] * (r + 1) * 0.15;
          if (r && narrow[s] && narrow[perm[r - 1]]) score += 1;
          if (ix.closed(ids[s]) && r === n - 1) score += 0.5;
        }
      }
      if (ok && score < bestScore) { bestScore = score; best = perm; }
    }
    return best ? best.map(function (s) { return ids[s]; }) : null;
  }

  // Pick day i: seven prompts, the ones rested longest first, under every
  // hard rule, with a bounded backtracking search. Returns null if none.
  function pickDay(ix, R, h, i, rnd, opts) {
    opts = opts || {};
    // A few searches, each with more shuffle in the candidate order: a
    // bounded depth-first search can get stuck in one corner of the order.
    var tries = opts.tries || 8, res = null;
    for (var t = 0; t < tries && !res; t++) res = pickDayOnce(ix, R, h, i, rnd, opts, (opts.jitter == null ? 3 : opts.jitter) + t * 6);
    return res;
  }
  function pickDayOnce(ix, R, h, i, rnd, opts, jitter) {
    var recent = {}, k;
    for (k = Math.max(0, i - 7); k < i; k++) (h.days[k] || []).forEach(function (id) { var c = ix.cat(id); recent[c] = (recent[c] || 0) + 1; });
    var cand = [];
    ix.active.forEach(function (id) {
      if (opts.exclude && opts.exclude[id]) return;
      if (blocks(ix, R, h, i, [], id, null)) return;
      var tw = ix.twins[id] || [id], age = 1e4;
      tw.forEach(function (t) { var l = h.last(t, i); if (l) age = Math.min(age, i - l[0]); });
      var score = (age >= 1e4 ? 400 + rnd() * 50 : age) + rnd() * jitter - (recent[ix.cat(id)] || 0) * 0.6;
      cand.push({ id: id, score: score });
    });
    cand.sort(function (a, b) { return b.score - a.score; });
    var ids = cand.map(function (c) { return c.id; });
    var counts = {}, picked = [], nodes = 0, limit = opts.nodes || 1500, result = null;
    (function dfs(from) {
      if (result || nodes > limit) return;
      if (picked.length === R.perDay) {
        if (categories(ix, picked) < R.minCategories) return;
        var ord = orderDay(ix, h, i, picked.slice(), rnd);
        if (ord) result = ord;
        return;
      }
      for (var q = from; q < ids.length && !result; q++) {
        if (ids.length - q < R.perDay - picked.length) return;
        nodes++;
        if (categories(ix, picked.concat([ids[q]])) + R.perDay - picked.length - 1 < R.minCategories) continue;
        if (blocks(ix, R, h, i, picked, ids[q], counts)) continue;
        picked.push(ids[q]); addCounts(h, i, ids[q], counts, R, 1);
        dfs(q + 1);
        addCounts(h, i, ids[q], counts, R, -1); picked.pop();
      }
    })(0);
    return result;
  }

  // ---------- the full check -------------------------------------------
  // Checks every date from `from` (inclusive) to the end of the schedule.
  // Returns { violations: [...], stats }.
  function check(data, sched, opts) {
    opts = opts || {};
    var R = rulesFor(sched, opts.rules), ix = index(data, sched);
    var keys = Object.keys(sched.days).sort(), v = [];
    if (!keys.length) return { violations: ['the schedule is empty'], stats: null };
    var h = new History(keys[0]);
    var from = opts.from || keys[0], fromI = D.dayNumber(from, keys[0]);
    for (var i = 0; i < keys.length; i++) {
      var k = h.key(i);
      if (keys[i] !== k) { v.push(k + ': missing from the schedule'); return { violations: v, stats: null }; }
      h.push(sched.days[k]);
    }
    var gaps = {}, own = {};
    for (i = Math.max(0, fromI); i < keys.length; i++) {
      var key = keys[i], ids = h.days[i], bad = function (m) { v.push(key + ': ' + m); };
      if (ids.length !== R.perDay) bad(ids.length + ' prompts, not ' + R.perDay);
      var seen = {}, fams = {}, cats = {}, closed = 0;
      ids.forEach(function (id, r) {
        var p = ix.byId[id];
        if (!p) { bad('unknown prompt ' + id); return; }
        if (p.retired) bad(id + ' is retired');
        if (seen[id]) bad(id + ' twice');
        seen[id] = 1;
        var f = ix.fam(id);
        if (fams[f]) bad('family ' + f + ' twice (' + fams[f] + ', ' + id + ')');
        fams[f] = id;
        cats[p.category] = (cats[p.category] || 0) + 1;
        if (p.closed) closed++;
        var prev = h.last(id, i);
        if (prev && prev[1] === r) bad(id + ' in round ' + (r + 1) + ' again (as on ' + h.key(prev[0]) + ')');
        if (prev) (own[id] = own[id] || []).push(i - prev[0]);
        (ix.twins[id] || [id]).forEach(function (t) {
          var l = h.last(t, i);
          if (!l) return;
          var g = i - l[0];
          gaps[id] = gaps[id] || [];
          if (t === id || !prev || l[0] > prev[0]) gaps[id].push(g);
          if (g < R.cooldown) bad(id + ' back after ' + g + ' days' + (t === id ? '' : ' (twin ' + t + ' on ' + h.key(l[0]) + ')'));
        });
      });
      Object.keys(R.categoryMax).forEach(function (c) { if ((cats[c] || 0) > R.categoryMax[c]) bad(cats[c] + ' ' + c + ' prompts (max ' + R.categoryMax[c] + ')'); });
      if (closed > R.closedMax) bad(closed + ' closed sets (max ' + R.closedMax + ')');
      if (Object.keys(cats).length < R.minCategories) bad(Object.keys(cats).length + ' categories (min ' + R.minCategories + ')');
      if (i > 0) {
        var y = h.days[i - 1];
        ids.forEach(function (id, r) {
          if (y.indexOf(id) >= 0) bad(id + ' also yesterday');
          if (y[r] && ix.byId[y[r]] && ix.fam(y[r]) === ix.fam(id)) bad('family ' + ix.fam(id) + ' in round ' + (r + 1) + ' two days running' + (r === 0 ? ' (leads off again)' : ''));
        });
      }
      var counts = {};
      ids.forEach(function (id) { addCounts(h, i, id, counts, R, 1); });
      Object.keys(counts).forEach(function (e) { if (counts[e] > R.pairMax) bad('shares ' + counts[e] + ' prompts with ' + h.key(+e)); });
    }
    return { violations: v, stats: { history: h, gaps: gaps, own: own, rules: R, from: from, keys: keys } };
  }

  // ---------- reading the schedule ----------------------------------------
  function lastKey(sched) { var k = Object.keys(sched.days).sort(); return k[k.length - 1]; }
  function firstKey(sched) { return Object.keys(sched.days).sort()[0]; }

  // Days past the end of the schedule: picked on the device with the same
  // rules, against the last 30 scheduled days. Same date, same answer on
  // every device. CI keeps 60+ days scheduled, so this should never run.
  var fbMemo = {};
  function fallback(data, sched, key) {
    var end = lastKey(sched), memo = fbMemo[end] || (fbMemo[end] = { h: null, upto: null });
    if (!memo.h) {
      var start = D.addDays(end, -29), h = new History(start);
      for (var k = start; k <= end; k = D.addDays(k, 1)) h.push(sched.days[k] || []);
      memo.h = h; memo.upto = end;
    }
    var ix = index(data, sched), R0 = rulesFor(sched);
    if (typeof console !== 'undefined') console.warn('Fishers: ' + key + ' is past the end of the schedule (' + end + '); picking it on this device.');
    while (memo.upto < key) {
      var next = D.addDays(memo.upto, 1), i = memo.h.days.length, rnd = D.rng('fallback|' + next), day = null;
      // Relax only if the bank cannot meet a rule: the pair rule first, then
      // the cooldown a day at a time, down to the absolute floor and below.
      var tries = [{}, { pairMax: 99 }];
      for (var cd = R0.cooldown - 1; cd >= 1; cd--) tries.push({ pairMax: 99, cooldown: cd });
      tries.push({ pairMax: 99, cooldown: 0, closedMax: 7, minCategories: 1, categoryMax: {} });
      for (var t = 0; t < tries.length && !day; t++) day = pickDay(ix, rulesFor(sched, tries[t]), memo.h, i, rnd, { nodes: 3000 });
      memo.h.push(day || ix.active.slice(0, R0.perDay));
      memo.upto = next;
    }
    return memo.h.days[memo.h.days.length - 1 - D.dayNumber(memo.upto, key)];
  }

  // The prompt ids for a date's daily cast.
  function dailyIds(data, sched, key, config) {
    if (sched && sched.days && sched.days[key]) return sched.days[key].slice();
    if (!sched || !sched.days || key <= lastKey(sched)) return D.pickDaily(data, key, config).map(function (p) { return p.id; });
    return fallback(data, sched, key);
  }

  // How many days until each prompt's next daily, within `days` days from
  // `key` (0 = in today's cast). Prompts not listed are further away.
  function upcoming(data, sched, key, days, config) {
    var out = {};
    for (var d = days - 1; d >= 0; d--) dailyIds(data, sched, D.addDays(key, d), config).forEach(function (id) { out[id] = d; });
    return out;
  }

  // Endless Cast #n on date `key`: seven prompts, none due as a daily in the
  // next 14 days, one per family, the daily's category limits. The same for
  // everyone on a date; it can change as new dailies come into the window.
  function endlessIds(data, sched, n, key, config) {
    var ix = index(data, sched), R = rulesFor(sched, { cooldown: 0 });
    var soon = upcoming(data, sched, key, 14, config);
    var order = D.shuffled(ix.active.length, 'endless|' + n).map(function (k) { return ix.active[k]; });
    for (var w = 14; w >= 0; w--) {
      var pool = order.filter(function (id) { return !(id in soon) || soon[id] >= w; });
      var picked = [], nodes = 0, res = null;
      (function dfs(from) {
        if (res || nodes > 3000) return;
        if (picked.length === R.perDay) { if (categories(ix, picked) >= R.minCategories) res = picked.slice(); return; }
        for (var q = from; q < pool.length && !res; q++) {
          nodes++;
          var p = ix.byId[pool[q]], c = p.category, f = ix.fam(pool[q]), nCat = 0, closed = 0, clash = false;
          picked.forEach(function (id) { if (ix.fam(id) === f) clash = true; if (ix.cat(id) === c) nCat++; if (ix.closed(id)) closed++; });
          if (clash || (R.categoryMax[c] != null && nCat >= R.categoryMax[c]) || (p.closed && closed >= R.closedMax)) continue;
          picked.push(pool[q]); dfs(q + 1); picked.pop();
        }
      })(0);
      if (res) return res;
    }
    return order.slice(0, R.perDay);
  }

  var api = {
    RULES: RULES, FLOOR: FLOOR, rulesFor: rulesFor, computeTwins: computeTwins, index: index,
    History: History, blocks: blocks, pickDay: pickDay, orderDay: orderDay, check: check,
    dailyIds: dailyIds, upcoming: upcoming, endlessIds: endlessIds, fallback: fallback,
    firstKey: firstKey, lastKey: lastKey,
    _resetMemo: function () { fbMemo = {}; ixCache = null; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FSHSchedule = api;
})(typeof window !== 'undefined' ? window : this);
