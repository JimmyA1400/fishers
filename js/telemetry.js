/* Fishers: OPTIONAL answer logging. Off by default.
 *
 * When FSH_CONFIG.telemetry.enabled is true and an endpoint is set, each
 * Daily Cast answer is posted as:
 *
 *   { "promptId": "paul-cities", "answer": "Miletus", "matched": true }
 *
 * - For a valid answer, "answer" is the canonical name from the bank.
 * - For anything else it is the normalized text the player typed, cut to
 *   40 characters, which is how missing answers get discovered.
 * - When a Daily Cast finishes, its score is posted as { cast, score } so
 *   the results screen can say "better than X% of players".
 * - No player id, no streak, no cookies. Practice, Archive and Endless
 *   answers are not logged.
 *
 * Nothing in the game depends on this file. Delete the <script> tag in
 * index.html and the game plays exactly the same.
 */
(function () {
  'use strict';

  function log(promptId, answer, matched) {
    var cfg = (window.FSH_CONFIG && window.FSH_CONFIG.telemetry) || {};
    if (!cfg.enabled || !cfg.endpoint) return;
    try {
      var body = JSON.stringify({
        promptId: String(promptId),
        answer: String(answer || '').slice(0, 40),
        matched: !!matched
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(cfg.endpoint, new Blob([body], { type: 'text/plain' }));
      } else if (window.fetch) {
        fetch(cfg.endpoint, { method: 'POST', body: body, keepalive: true, mode: 'no-cors' })
          .catch(function () {});
      }
    } catch (e) { /* logging must never break the game */ }
  }

  function cfg() { return (window.FSH_CONFIG && window.FSH_CONFIG.telemetry) || {}; }
  function base() { return String(cfg().endpoint || '').replace(/\/log$/, ''); }

  // A finished Daily Cast's score, so "better than X% of players" can be shown.
  function logScore(castNumber, score) {
    if (!cfg().enabled || !cfg().endpoint) return;
    try {
      var body = JSON.stringify({ cast: Number(castNumber), score: Number(score) });
      if (navigator.sendBeacon) navigator.sendBeacon(base() + '/score', new Blob([body], { type: 'text/plain' }));
      else fetch(base() + '/score', { method: 'POST', body: body, keepalive: true, mode: 'no-cors' }).catch(function () {});
    } catch (e) { /* never break the game */ }
  }

  // Resolves to a whole percentage, or null when telemetry is off, the server
  // cannot be reached, or fewer than 20 players have finished that cast.
  function percentile(castNumber, score) {
    if (!cfg().enabled || !cfg().endpoint || !window.fetch) return Promise.resolve(null);
    return fetch(base() + '/percentile?cast=' + encodeURIComponent(castNumber) + '&score=' + encodeURIComponent(score))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return j && typeof j.better === 'number' && j.players >= 20 ? Math.round(j.better) : null; })
      .catch(function () { return null; });
  }

  window.FSHTelemetry = { log: log, logScore: logScore, percentile: percentile };
})();
