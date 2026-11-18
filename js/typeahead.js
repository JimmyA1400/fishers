/* Fishers: type-ahead for the answer box.
 *
 * Completes what the player is typing from a word list drawn from the whole
 * Bible (every capitalized name in the WEB and KJV, and every answer label in
 * the bank), most familiar first. Because the list is not limited to the
 * current prompt, a completion helps with spelling without saying whether the
 * word is a valid answer here. Filling in a completion never casts it.
 *
 * Works in the browser (window.FSHTypeahead) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  var MIN = 3;   // letters typed before anything is offered

  function simplify(s) {
    s = String(s || '');
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.toLowerCase().replace(/['‘’]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/^ +/, '');
  }

  // lexicon: [[display, weight], ...] sorted by weight, highest first.
  function create(lexicon) {
    var list = (lexicon || []).map(function (e) { return { display: e[0], key: simplify(e[0]) }; });

    function complete(typed) {
      var t = simplify(typed);
      if (t.replace(/ /g, '').length < MIN) return null;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.key.length > t.length && e.key.indexOf(t) === 0) return e.display;
      }
      return null;
    }
    return { complete: complete };
  }

  // The part of the completion to show after the typed text, if the typed
  // text is a literal prefix of it (ignoring case); otherwise ''.
  function remainder(typed, display) {
    if (!display) return '';
    return display.toLowerCase().indexOf(String(typed).toLowerCase()) === 0 ? display.slice(String(typed).length) : '';
  }

  var api = { create: create, remainder: remainder, simplify: simplify, MIN: MIN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FSHTypeahead = api;
})(typeof window !== 'undefined' ? window : this);
