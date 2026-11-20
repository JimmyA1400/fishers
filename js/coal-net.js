/* Live Coal: the connection to the room server.
 *
 *   var conn = FSHCoalNet.connect({ code, onMessage, onStatus })
 *   conn.send({ type: 'submit', text })     v: 1 is added
 *   conn.serverNow()                        Date.now() corrected to the server clock
 *   conn.close()
 *
 * Time sync: on connect, every 30 s, and when the page comes back to the
 * foreground, five ping/pong samples are taken; the offset is the median of
 * (server time - local midpoint). Countdowns are drawn from
 * deadline - serverNow(), so every screen shows the same clock.
 *
 * Reconnects with backoff, except when the server closed us on purpose
 * (another tab, removed, room closed, left).
 *
 * The server URL is FSH_CONFIG.liveCoal.server. For testing, ?coal=<url> on
 * the page (kept for the tab in sessionStorage) points at another server, such
 * as a local `wrangler dev`.
 */
(function (root) {
  'use strict';
  var PROTOCOL = 1;
  var FINAL = { 4000: 'left', 4001: 'otherTab', 4003: 'removed', 4004: 'noRoom', 4008: 'flood', 4009: 'protocol' };

  function serverBase() {
    var cfg = (root.FSH_CONFIG && root.FSH_CONFIG.liveCoal) || {};
    var o = null;
    try {
      var m = /[?&]coal=([^&#]+)/.exec(location.search);
      if (m) { o = decodeURIComponent(m[1]); sessionStorage.setItem('fishers.coal.server', o); }
      else o = sessionStorage.getItem('fishers.coal.server');
    } catch (e) { /* storage blocked */ }
    if (o && /^https?:\/\/[^\s]+$/.test(o)) return o.replace(/\/$/, '');
    var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    return ((local && cfg.localServer) || cfg.server || '').replace(/\/$/, '');
  }
  function wsUrl(code) { return serverBase().replace(/^http/, 'ws') + '/room/' + encodeURIComponent(code); }

  function createRoom() {
    return fetch(serverBase() + '/create', { method: 'POST' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) { return j.code; });
  }

  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor(s.length / 2)]; }

  function connect(opts) {
    var ws = null, closedByUs = false, attempt = 0, retryTimer = null, syncTimer = null;
    var offset = 0, rtt = 0, synced = false, samples = [], pending = {};
    var api = {
      offset: function () { return offset; },
      rtt: function () { return rtt; },
      serverNow: function () { return Date.now() + offset; },
      send: send, close: close, resync: resync,
      isOpen: function () { return !!ws && ws.readyState === 1; }
    };

    function status(s, extra) { if (opts.onStatus) opts.onStatus(s, extra); }

    function open() {
      clearTimeout(retryTimer);
      status(attempt ? 'reconnecting' : 'connecting');
      try { ws = new WebSocket(wsUrl(opts.code)); } catch (e) { schedule(); return; }
      var me = ws;
      ws.onopen = function () { if (me !== ws) return; attempt = 0; };
      ws.onmessage = function (e) {
        if (me !== ws) return;
        var m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.type === 'pong') { onPong(m); return; }
        if (m.type === 'hello') {
          if (m.protocol !== PROTOCOL) { closedByUs = true; status('outdated'); try { ws.close(4009, 'protocol'); } catch (err) { /* ignore */ } return; }
          offset = m.now - Date.now();          // a first guess until the pings return
          status('open');
          resync();
        }
        opts.onMessage(m);
      };
      ws.onclose = function (e) {
        if (me !== ws) return;
        ws = null;
        clearInterval(syncTimer);
        if (closedByUs) return;
        if (FINAL[e.code]) { status('closed', FINAL[e.code]); return; }
        schedule();
      };
      ws.onerror = function () { /* onclose follows */ };
    }

    function schedule() {
      attempt++;
      var delay = Math.min(8000, 400 * Math.pow(1.7, attempt - 1)) * (0.8 + Math.random() * 0.4);
      status('reconnecting', { inMs: delay, attempt: attempt });
      retryTimer = setTimeout(open, delay);
    }

    function send(o) {
      if (!ws || ws.readyState !== 1) return false;
      var msg = { v: 1 };
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) msg[k] = o[k];
      ws.send(JSON.stringify(msg));
      return true;
    }

    // NTP-style: 5 pings 120 ms apart; the offset is the median sample.
    function resync() {
      clearInterval(syncTimer);
      samples = [];
      var n = 0;
      (function one() {
        if (!ws || ws.readyState !== 1 || n >= 5) return;
        n++;
        var t = performance.now();
        pending[t] = Date.now();
        send({ type: 'ping', t: t });
        setTimeout(one, 120);
      })();
      syncTimer = setInterval(resync, 30000);
    }
    function onPong(m) {
      var t0 = pending[m.t];
      if (t0 == null) return;
      delete pending[m.t];
      var t1 = Date.now(), r = t1 - t0;
      samples.push({ off: m.s - (t0 + r / 2), rtt: r });
      if (samples.length >= 3) {
        offset = median(samples.map(function (x) { return x.off; }));
        rtt = median(samples.map(function (x) { return x.rtt; }));
        synced = true;
        if (opts.onSync) opts.onSync(offset, rtt);
      }
    }

    function close() {
      closedByUs = true;
      clearTimeout(retryTimer); clearInterval(syncTimer);
      if (ws) { try { ws.close(1000, 'bye'); } catch (e) { /* ignore */ } }
      ws = null;
    }

    // Back from the background: the turn kept running on the server, so
    // reconnect if needed and resync the clock.
    function onVisible() {
      if (document.visibilityState !== 'visible' || closedByUs) return;
      if (!ws) { attempt = 0; open(); } else resync();
    }
    document.addEventListener('visibilitychange', onVisible);
    var baseClose = close;
    api.close = close = function () { document.removeEventListener('visibilitychange', onVisible); baseClose(); };

    open();
    return api;
  }

  // Name, fish colour and a random token, kept on this device so a refresh
  // rejoins the same seat. For testing several players in one browser,
  // ?seat=2 (kept for the tab) gives the tab its own identity.
  function idKey() {
    var seat = '';
    try {
      var m = /[?&]seat=([a-z0-9]{1,8})/i.exec(location.search);
      if (m) { seat = m[1]; sessionStorage.setItem('fishers.coal.seat', seat); }
      else seat = sessionStorage.getItem('fishers.coal.seat') || '';
    } catch (e) { /* storage blocked */ }
    return 'fishers.coal.me' + (seat ? '.' + seat : '');
  }
  function identity() {
    var me = {};
    try { me = JSON.parse(localStorage.getItem(idKey()) || '{}') || {}; } catch (e) { me = {}; }
    if (!me.token || !/^[A-Za-z0-9_-]{16,64}$/.test(me.token)) {
      var b = new Uint8Array(18);
      (root.crypto || root.msCrypto).getRandomValues(b);
      me.token = Array.prototype.map.call(b, function (x) { return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[x & 63]; }).join('');
      saveIdentity(me);
    }
    return me;
  }
  function saveIdentity(me) { try { localStorage.setItem(idKey(), JSON.stringify(me)); } catch (e) { /* private mode */ } }

  root.FSHCoalNet = { PROTOCOL: PROTOCOL, connect: connect, createRoom: createRoom, identity: identity, saveIdentity: saveIdentity, serverBase: serverBase };
})(window);
