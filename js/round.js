/* Fishers: one round of guessing.
 *
 * A round ends only when an answer is accepted or the clock runs out. Wrong
 * guesses, near misses and suggestions all leave it open. Time is passed in,
 * so the logic can be tested without waiting.
 *
 *   var r = FSHRound.create({ compiled, tiers, limitMs, startedAt });
 *   r.cast(text, now)  -> evaluation, plus { done, points } once it ends
 *   r.tick(now)        -> the timeout result once time is up, otherwise null
 *
 * Confirming a suggestion is simply casting its canonical name, which the
 * game places in the input box; that is an exact match and is accepted.
 */
(function (root) {
  'use strict';
  var M = (typeof module !== 'undefined' && module.exports) ? require('./matcher.js') : root.FSHMatcher;

  function create(opts) {
    var deadline = opts.startedAt + opts.limitMs;
    var state = { done: false, result: null, guesses: [] };

    function finish(result) {
      state.done = true;
      state.result = result;
      return result;
    }

    function timeout() {
      return finish({ type: 'timeout', done: true, points: 0, tier: 0 });
    }

    function cast(text, now) {
      if (state.done) return state.result;
      if (now >= deadline) return timeout();
      var r = M.evaluate(text, opts.compiled);
      state.guesses.push({ text: String(text).slice(0, 60), type: r.type });
      if (r.type === 'accept') {
        var t = opts.tiers[r.answer.tier - 1];
        r.done = true; r.tier = r.answer.tier; r.points = t.points;
        return finish(r);
      }
      r.done = false;
      return r;
    }

    function tick(now) {
      if (state.done) return null;
      return now >= deadline ? timeout() : null;
    }

    return {
      cast: cast, tick: tick, state: state, deadline: deadline,
      remaining: function (now) { return Math.max(0, deadline - now); }
    };
  }

  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FSHRound = api;
})(typeof window !== 'undefined' ? window : this);
