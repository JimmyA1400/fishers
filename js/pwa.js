/* Fishers: installable app.
 *
 * - Registers the service worker (only on a built site served over http(s);
 *   the unbuilt dev copy has version "dev" and skips it).
 * - When a new version has downloaded, shows "New version available" with a
 *   Refresh button. Tapping it switches to the new build and reloads.
 * - Install hints after a finished cast: Android/desktop Chrome get an
 *   "Add Fishers to your home screen" button (beforeinstallprompt); iPhone
 *   and iPad Safari, which have no install prompt, get a one-time tip.
 */
(function () {
  'use strict';
  var CFG = window.FSH_CONFIG || {};
  var deferred = null;            // the saved beforeinstallprompt event
  var TIP_KEY = 'fishers.iosTipDismissed';

  function toast(msg, action, fn) { if (window.FSHToast) window.FSHToast(msg, action, fn); }

  // ---------- service worker and updates ----------------------------------
  function offerUpdate(reg) {
    if (!reg.waiting || !navigator.serviceWorker.controller) return;
    toast('New version available', 'Tap to refresh', function () {
      if (reg.waiting) reg.waiting.postMessage('skip-waiting');
    });
  }

  function register() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol) || CFG.version === 'dev') return;
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      offerUpdate(reg);
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', function () { if (w.state === 'installed') offerUpdate(reg); });
      });
      // Check for a new deploy whenever the player comes back to the tab,
      // and every half hour while it stays open.
      document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
      setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
    }).catch(function () { /* no offline support; the game still works */ });
  }

  // ---------- install hints ----------------------------------------------
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
  });
  window.addEventListener('appinstalled', function () { deferred = null; });

  function standalone() {
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function iosSafari() {
    var ua = navigator.userAgent;
    var ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
  }
  function tipDismissed() { try { return localStorage.getItem(TIP_KEY) === '1'; } catch (e) { return true; } }

  // Called by the results screen after a finished cast. Fills `box` with an
  // install button or the iPhone tip, or leaves it empty.
  function installOffer(box) {
    if (!box || standalone()) return;
    if (deferred) {
      box.innerHTML = '<button type="button" class="btn" id="install-app">Add Fishers to your home screen</button>';
      box.hidden = false;
      document.getElementById('install-app').onclick = function () {
        var e = deferred; deferred = null;
        box.hidden = true;
        e.prompt();
        if (e.userChoice) e.userChoice.catch(function () {});
      };
      return;
    }
    if (iosSafari() && !tipDismissed()) {
      box.innerHTML = '<div class="ios-tip" role="note"><p>Add Fishers to your home screen: tap <strong>Share</strong> ' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" class="share-glyph"><path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9"/></svg>' +
        ' then <strong>Add to Home Screen</strong>.</p>' +
        '<button type="button" class="link-btn" id="ios-tip-close">Got it</button></div>';
      box.hidden = false;
      document.getElementById('ios-tip-close').onclick = function () {
        try { localStorage.setItem(TIP_KEY, '1'); } catch (e) { /* ignore */ }
        box.hidden = true;
      };
    }
  }

  register();
  window.FSHPwa = { installOffer: installOffer };
})();
