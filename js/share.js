/* Fishers: the spoiler-free result card. It shows tiers and the score, never answers. */
(function () {
  'use strict';

  var NOTHING = '⬛';   // black square: nothing landed

  // opts: { label, number, score, tiers: [0-6 per round], tierDefs, url }
  function cardText(opts) {
    var row = opts.tiers.map(function (t) { return t ? opts.tierDefs[t - 1].emoji : NOTHING; }).join('');
    var lines = [(opts.label || 'Fishers') + ' #' + opts.number + ' \u{1F41F}', opts.score + ' / 700', row];
    if (opts.url) lines.push(opts.url);
    return lines.join('\n');
  }

  // Tries the phone's share sheet, then the clipboard. Resolves to
  // 'shared', 'copied', or 'manual' (caller should show the text to copy).
  function share(text) {
    if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      return navigator.share({ text: text }).then(function () { return 'shared'; })
        .catch(function () { return copy(text); });
    }
    return copy(text);
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
