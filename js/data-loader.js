/* Fishers: loads the prompt bank.
 *
 * data/prompts.json is the source of truth. Browsers refuse to fetch local
 * files, so when the game is opened by double-clicking index.html it loads
 * data/prompts.js instead, which is the same content wrapped in a script.
 * After editing the JSON, run `node tools/sync-data.js` to refresh that copy.
 */
(function () {
  'use strict';

  function fromScript() {
    return new Promise(function (resolve, reject) {
      if (window.FSH_DATA) return resolve(window.FSH_DATA);
      var s = document.createElement('script');
      s.src = 'data/prompts.js';
      s.onload = function () {
        if (window.FSH_DATA) resolve(window.FSH_DATA);
        else reject(new Error('data/prompts.js did not define the prompt bank'));
      };
      s.onerror = function () { reject(new Error('Could not load data/prompts.js')); };
      document.head.appendChild(s);
    });
  }

  function load() {
    if (/^https?:$/.test(location.protocol) && window.fetch) {
      // On the web only the JSON is published; the service worker keeps a
      // copy for offline play. data/prompts.js exists only for file://.
      return fetch('data/prompts.json', { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        });
    }
    return fromScript();
  }

  window.FSHData = { load: load };
})();
