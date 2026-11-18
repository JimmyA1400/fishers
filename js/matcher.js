/* Fishers: answer matching.
 *
 * evaluate(input, compiled) returns one of:
 *   { type: 'empty' }
 *   { type: 'accept',  index, answer }            exact name, alias or form
 *   { type: 'near',    index, nearMiss }          exact near miss: teach, then cast again
 *   { type: 'suggest', index, answer, reason }    close but never accepted on its own;
 *                                                 reason is 'short', 'typo' or 'prefix'
 *   { type: 'miss' }                              not in the net: cast again
 *
 * Checks run in this order: exact answer, exact near miss, phrase match
 * (description prompts only), short form, typo, prefix. Near misses are only
 * ever matched exactly, so a typo can never land on one.
 *
 * Works in the browser (window.FSHMatcher) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  var STOP = ['the', 'a', 'an', 'of', 'and', 'st', 'saint'];

  // Number words become digits anywhere, so "Ten lepers" and "10 lepers" agree.
  var NUMBERS = {
    one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7',
    eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
    '1st': '1', '2nd': '2', '3rd': '3'
  };
  // Ordinals and Roman numerals only lead a book name: "First Kings", "I Kings".
  var LEADING = { first: '1', second: '2', third: '3', i: '1', ii: '2', iii: '3' };

  function baseTokens(str) {
    var s = String(str == null ? '' : str);
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    s = s.toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/['‘’`]s\b/g, '')   // possessive: Jairus's -> jairus
      .replace(/['‘’`]/g, '')
      .replace(/(\d),(?=\d{3}\b)/g, '$1')    // 5,000 -> 5000
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (!s) return [];
    return s.split(' ').map(function (t) {
      return Object.prototype.hasOwnProperty.call(NUMBERS, t) ? NUMBERS[t] : t;
    });
  }

  function tokens(str, ignoreWords) {
    var all = baseTokens(str);
    var stop = STOP.concat(ignoreWords || []);
    var kept = all.filter(function (t) { return stop.indexOf(t) === -1; });
    if (!kept.length) kept = all;
    if (kept.length > 1 && Object.prototype.hasOwnProperty.call(LEADING, kept[0])) {
      kept = [LEADING[kept[0]]].concat(kept.slice(1));
    }
    return kept;
  }

  // The typed key with a plural or possessive "s" dropped where it was written
  // without an apostrophe ("Solomons porch"). Compared only with exact keys, so
  // a missing letter ("Mose") is still a typo, never an acceptance.
  function looseKey(toks) {
    return toks.map(function (t) { return t.length > 3 && /[^s]s$/.test(t) ? t.slice(0, -1) : t; }).join('');
  }

  function keyOf(str, ignoreWords) { return tokens(str, ignoreWords).join(''); }

  // Light stemmer for description prompts, so "walked" and "walking" agree.
  function stem(t) {
    if (t.length > 4) {
      if (/ing$/.test(t)) return t.slice(0, -3);
      if (/ed$/.test(t)) return t.slice(0, -2);
      if (/es$/.test(t)) return t.slice(0, -2);
    }
    if (t.length > 3 && /s$/.test(t) && !/ss$/.test(t)) return t.slice(0, -1);
    return t;
  }

  // Damerau-Levenshtein (a swap of neighbouring letters is one edit), capped at max.
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev2 = null, prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var rowMin = cur[0];
      for (j = 1; j <= b.length; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 &&
            a.charCodeAt(i - 1) === b.charCodeAt(j - 2) &&
            a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
          v = Math.min(v, prev2[j - 2] + 1);
        }
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }

  // Typos allowed: none under 4 letters, 1 for 4-6 letters, 2 for 7 or more.
  function allowedTypos(len) { return len < 4 ? 0 : (len <= 6 ? 1 : 2); }
  var MIN_PREFIX = 4;

  function digitsOf(s) { return s.replace(/\D/g, ''); }
  function uniq(arr) { return arr.filter(function (t, i) { return arr.indexOf(t) === i; }); }

  function compile(prompt) {
    var ignore = prompt.ignoreWords || [];
    var answers = prompt.answers;
    var c = {
      prompt: prompt, ignore: ignore, phrase: prompt.match === 'phrase',
      nouns: !!prompt.nouns,   // common-noun prompts: singular and plural agree
      exact: {},        // key -> answer index (accept)
      short: {},        // key -> answer index (suggest)
      near: {},         // key -> near-miss index
      labels: [],       // { key, idx, toks } for typo and prefix suggestions
      phraseEntries: [],
      collisions: []
    };
    // Lower rank = more common: tier first, then the bank's own order.
    c.rank = function (idx) { return answers[idx].tier * 100000 + idx; };
    function put(map, k, idx) {
      if (map[k] == null || c.rank(idx) < c.rank(map[k])) map[k] = idx;
    }

    answers.forEach(function (ans, idx) {
      var full = [ans.name].concat(ans.aliases || [], ans.forms || []);
      full.forEach(function (label) {
        var k = keyOf(label, ignore);
        if (!k) return;
        put(c.exact, k, idx);
        c.labels.push({ key: k, idx: idx, toks: tokens(label, ignore) });
        if (c.phrase) c.phraseEntries.push({ kind: 'answer', idx: idx, toks: uniq(tokens(label, ignore).map(stem)) });
      });
      (ans.short || []).forEach(function (label) {
        var k = keyOf(label, ignore);
        if (k) put(c.short, k, idx);
      });
    });

    (prompt.nearMisses || []).forEach(function (nm, idx) {
      [nm.name].concat(nm.aliases || []).forEach(function (label) {
        var k = keyOf(label, ignore);
        if (!k) return;
        if (c.exact[k] != null) { c.collisions.push(label); return; }
        if (c.near[k] == null) c.near[k] = idx;
        if (c.phrase) c.phraseEntries.push({ kind: 'near', idx: idx, toks: uniq(tokens(label, ignore).map(stem)) });
      });
    });
    return c;
  }

  function accept(c, idx) { return { type: 'accept', index: idx, answer: c.prompt.answers[idx] }; }
  function suggest(c, idx, reason) { return { type: 'suggest', index: idx, answer: c.prompt.answers[idx], reason: reason }; }
  function near(c, idx) { return { type: 'near', index: idx, nearMiss: c.prompt.nearMisses[idx] }; }

  function evaluate(input, c) {
    var toks = tokens(input, c.ignore);
    if (!toks.length) return { type: 'empty' };
    var key = toks.join('');

    if (c.exact[key] != null) return accept(c, c.exact[key]);
    if (c.near[key] != null) return near(c, c.near[key]);
    var lk = looseKey(toks);
    if (lk !== key && c.exact[lk] != null) return accept(c, c.exact[lk]);
    if (lk !== key && c.near[lk] != null) return near(c, c.near[lk]);
    // A singular typed for a plural answer ("cucumber" for Cucumbers), on
    // common-noun prompts only, so "Mose" never becomes Moses.
    var plural = !c.nouns ? [] : [key + 's', key + 'es', /y$/.test(key) ? key.slice(0, -1) + 'ies' : null];
    for (var pi = 0; pi < plural.length; pi++) {
      if (plural[pi] && c.exact[plural[pi]] != null) return accept(c, c.exact[plural[pi]]);
    }

    // Description prompts: every word of some label appears in what was typed.
    if (c.phrase) {
      var have = uniq(toks.map(stem)), best = null;
      c.phraseEntries.forEach(function (e) {
        for (var i = 0; i < e.toks.length; i++) if (have.indexOf(e.toks[i]) === -1) return;
        var r = e.kind === 'answer' ? c.rank(e.idx) : 1e9 + e.idx;
        if (!best || e.toks.length > best.len || (e.toks.length === best.len && r < best.r)) {
          best = { e: e, len: e.toks.length, r: r };
        }
      });
      if (best) return best.e.kind === 'answer' ? accept(c, best.e.idx) : near(c, best.e.idx);
    }

    if (c.short[key] != null) return suggest(c, c.short[key], 'short');

    // A longer fragment that starts an answer is read as that answer, before
    // any typo: "Melchiz" means Melchizedek, not Melchi.
    var pre = key.length >= 5 ? prefixMatch(c, key, toks) : null;
    if (pre != null) return suggest(c, pre, 'prefix');

    // Typos: the closest answer within the allowance; ties go to the most common.
    var max = allowedTypos(key.length);
    if (max > 0) {
      var dIn = digitsOf(key), bestT = null;
      c.labels.forEach(function (l) {
        if (l.key.length < 4 || digitsOf(l.key) !== dIn) return;
        var d = distance(key, l.key, max);
        if (d > max) return;
        if (!bestT || d < bestT.d || (d === bestT.d && c.rank(l.idx) < c.rank(bestT.idx))) bestT = { d: d, idx: l.idx };
      });
      if (bestT) return suggest(c, bestT.idx, 'typo');
    }

    // Shorter prefixes: "Nebu" -> Nebuchadnezzar.
    var p4 = key.length >= MIN_PREFIX ? prefixMatch(c, key, toks) : null;
    if (p4 != null) return suggest(c, p4, 'prefix');

    return { type: 'miss' };
  }

  // The most common answer that the typed text starts (or starts a word of).
  function prefixMatch(c, key, toks) {
    if (toks.length !== 1) return null;
    var best = null;
    c.labels.forEach(function (l) {
      var hit = (l.key.length > key.length && l.key.indexOf(key) === 0) ||
        l.toks.some(function (t) { return t.length > key.length && t.indexOf(key) === 0; });
      if (hit && (best == null || c.rank(l.idx) < c.rank(best))) best = l.idx;
    });
    return best;
  }

  var api = {
    tokens: tokens, keyOf: keyOf, stem: stem, distance: distance,
    allowedTypos: allowedTypos, compile: compile, evaluate: evaluate
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FSHMatcher = api;
})(typeof window !== 'undefined' ? window : this);
