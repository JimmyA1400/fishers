/* Fishers: the spoiler-free result card. It shows tiers and the score, never answers. */
(function () {
  'use strict';

  var NOTHING = '⬛';   // black square: nothing landed

  // opts: { label, number, score, tiers: [0-6 per round], tierDefs, url }
  function cardText(opts) {
    var row = opts.tiers.map(function (t) { return t ? opts.tierDefs[t - 1].emoji : NOTHING; }).join('');
    var lines = [(opts.label || 'Fishers') + (opts.number != null ? ' #' + opts.number : '') + ' \u{1F41F}', opts.score + ' / 700', row];
    if (opts.url) lines.push(opts.url);
    return lines.join('\n');
  }

  // Opens the device's share sheet (phones, and some desktop browsers).
  // Resolves to 'shared', 'cancelled' (the player closed the sheet), or
  // 'failed' (no share sheet, or it refused: the caller copies instead).
  function share(text, url) {
    if (!navigator.share) return Promise.resolve('failed');
    var data = url ? { text: text, url: url } : { text: text };
    if (navigator.canShare && !navigator.canShare(data)) return Promise.resolve('failed');
    return navigator.share(data).then(function () { return 'shared'; }, function (err) {
      return err && err.name === 'AbortError' ? 'cancelled' : 'failed';
    });
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return 'copied'; })
        .catch(function () { return 'manual'; });
    }
    return Promise.resolve('manual');
  }

  window.FSHShare = { cardText: cardText, share: share, copy: copy };
})();
