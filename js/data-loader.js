/* Fishers: loads the prompt bank and the daily schedule.
 *
 * data/schedule.json (the daily casts, see scripts/build-schedule.js) is
 * attached as data.schedule. If it cannot be loaded the game still runs: the
 * schedule module picks each day on the device (see js/schedule.js).
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
      var bank = fetch('data/prompts.json', { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        });
      var sched = fetch('data/schedule.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
      return Promise.all([bank, sched]).then(function (both) {
        both[0].schedule = both[1];
        if (!both[1] && window.console) console.warn('Fishers: data/schedule.json did not load; picking dailies on this device.');
        return both[0];
      });
    }
    return fromScript();
  }

  window.FSHData = { load: load };
})();
