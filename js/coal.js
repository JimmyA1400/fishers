/* Fishers: Live Coal, the multiplayer elimination mode.
 *
 * Routes: #/coal (The Shore, the public room) and #/coal/ABCD (a private
 * room). The screen is an overlay over the solo game; leaving the route
 * closes it. Everything here is presentation: the server decides turns,
 * answers, time and the winner (see server/src/engine.js).
 *
 * The client keeps a mirror of the room built from the server's snapshot and
 * the small events after it. Countdowns are drawn from the server deadline
 * minus the synced server clock (FSHCoalNet).
 */
(function () {
  'use strict';
  var Net = window.FSHCoalNet;
  var SHORE = 'SHORE';
  var CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;
  var COLORS = { ember: '#ee7a3f', gold: '#e9b04a', sea: '#4fa8de', reed: '#7cc06b', dawn: '#f293b4', olive: '#b5b44f', plum: '#ad8ce0', sand: '#dcc49a' };
  var COLOR_NAMES = { ember: 'Ember', gold: 'Gold', sea: 'Sea', reed: 'Reed', dawn: 'Dawn', olive: 'Olive', plum: 'Plum', sand: 'Sand' };
  var TIERS = [null,
    { name: 'Mustard Seed', emoji: '🌱' }, { name: 'Best Seat', emoji: '🪑' }, { name: 'Five Loaves', emoji: '🍞' },
    { name: 'Lost Coin', emoji: '🪙' }, { name: 'Hidden Treasure', emoji: '💎' }, { name: 'The Lost Sheep', emoji: '🐑' }];
  var PRESET_TEXT = { relaxed: 'Relaxed · 20 s, down to 7 s', standard: 'Standard · 15 s, down to 5 s', fast: 'Fast · 10 s, down to 4 s' };
  var ERRORS = {
    nameTaken: 'Someone in this room already has that name.',
    nameLength: 'Names are 2 to 16 characters.',
    nameBlocked: 'Please pick a different name.',
    full: 'This room is full (16 people).',
    removed: 'The host removed you from this room.',
    otherTab: 'Opened in another tab. This tab has stopped.',
    noRoom: 'That room has closed, or the code is wrong.',
    needPlayers: 'You need at least 2 people to start.',
    notHost: 'Only the host can do that.',
    flood: 'Too many messages. Reload to rejoin.',
    left: 'You left the room.'
  };

  var root, main, liveEl, alertEl, topEl;
  var conn = null, code = null, me = null, room = null;
  var view = '';            // 'setup' | 'lobby' | 'game' | 'over' | 'stopped'
  var ui = {};              // per-screen state
  var raf = 0;
  var cameFromHome = false;  // opened from the home screen, so Back returns there
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ------------------------------------------------------------------ helpers
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel) { return root.querySelector(sel); }
  function fish(color, cls) {
    return '<svg class="fish ' + (cls || '') + '" viewBox="0 0 40 24" aria-hidden="true" style="color:' + (COLORS[color] || COLORS.ember) + '">' +
      '<path d="M3 12Q19-4 37 18M3 12Q19 28 37 6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>';
  }
  function say(text) { liveEl.textContent = ''; setTimeout(function () { liveEl.textContent = text; }, 40); }
  function alertSay(text) { alertEl.textContent = ''; setTimeout(function () { alertEl.textContent = text; }, 40); }
  function player(id) { return room && room.players.find(function (p) { return p.id === id; }); }
  function nameOf(id) { var p = player(id); return p ? p.name : 'Someone'; }
  function isHost() { return room && me && room.hostId === me; }
  function secs(ms) { var s = ms / 1000; return (Math.round(s * 10) / 10).toString().replace(/\.0$/, '') + ' s'; }
  function siteUrl() { return location.origin + location.pathname; }
  function roomUrl() { return siteUrl() + '#/coal' + (code && code !== SHORE ? '/' + code : ''); }
  function serverNow() { return conn ? conn.serverNow() : Date.now(); }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  // ------------------------------------------------------------------ sound
  // Off by default. Every sound is made here; nothing is downloaded.
  var Sound = (function () {
    var ctx = null, on = false, crackle = null;
    try { on = localStorage.getItem('fishers.coal.sound') === 'on'; } catch (e) { /* ignore */ }
    function ac() {
      if (!on) return null;
      if (!ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function noiseBuf(c, secsLen) {
      var b = c.createBuffer(1, Math.floor(c.sampleRate * secsLen), c.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }
    function burst(dur, f0, f1, peak, type) {
      var c = ac(); if (!c) return;
      var t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noiseBuf(c, dur + 0.05);
      f.type = type || 'bandpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur + 0.05);
    }
    function startCrackle() {
      var c = ac(); if (!c || crackle) return;
      // Soft fire: low brown-ish noise with random pops.
      var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noiseBuf(c, 2); s.loop = true; f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = 0.025;
      s.connect(f).connect(g).connect(c.destination); s.start();
      var pops = setInterval(function () { if (Math.random() < 0.55) burst(0.03 + Math.random() * 0.04, 1800 + Math.random() * 2400, 900, 0.05 + Math.random() * 0.05, 'highpass'); }, 260);
      crackle = { s: s, pops: pops };
    }
    function stopCrackle() { if (crackle) { try { crackle.s.stop(); } catch (e) { /* ignore */ } clearInterval(crackle.pops); crackle = null; } }
    return {
      isOn: function () { return on; },
      set: function (v) {
        on = !!v;
        try { localStorage.setItem('fishers.coal.sound', on ? 'on' : 'off'); } catch (e) { /* ignore */ }
        if (on && (view === 'game' || view === 'lobby')) startCrackle(); else stopCrackle();
      },
      crackle: function (v) { if (v) startCrackle(); else stopCrackle(); },
      whoosh: function () { burst(0.32, 300, 2400, 0.12); },
      tick: function () { var c = ac(); if (!c) return; var t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.frequency.value = 1150; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.08); },
      hiss: function () { burst(0.9, 5000, 1200, 0.15, 'highpass'); }
    };
  })();

  // ------------------------------------------------------------------ shell
  function build() {
    root = document.createElement('section');
    root.id = 'coal';
    root.className = 'coal';
    root.setAttribute('aria-label', 'Live Coal');
    root.hidden = true;
    root.innerHTML =
      '<div class="coal-sky" aria-hidden="true"><div class="coal-stars"></div><div class="coal-hills"></div><div class="coal-sea"></div><div class="coal-sand"></div></div>' +
      '<header class="coal-top">' +
        '<button type="button" class="coal-icon" id="coal-back" aria-label="Back to Fishers">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
        '<p class="coal-where" id="coal-where"></p>' +
        '<span class="coal-net" id="coal-net" role="status"></span>' +
        '<button type="button" class="coal-icon" id="coal-sound" aria-label="Sound" aria-pressed="false">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path class="on" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="off" d="M16 9.5l5 5M21 9.5l-5 5"/></svg></button>' +
      '</header>' +
      '<div class="coal-main" id="coal-main"></div>' +
      '<div class="sr-only" aria-live="polite" aria-atomic="true" id="coal-live"></div>' +
      '<div class="sr-only" aria-live="assertive" aria-atomic="true" id="coal-alert"></div>';
    document.body.appendChild(root);
    main = $('#coal-main'); liveEl = $('#coal-live'); alertEl = $('#coal-alert'); topEl = $('.coal-top');
    $('#coal-back').onclick = function () { leaveRoute(); };
    var sb = $('#coal-sound');
    sb.setAttribute('aria-pressed', String(Sound.isOn()));
    sb.onclick = function () { Sound.set(!Sound.isOn()); sb.setAttribute('aria-pressed', String(Sound.isOn())); toast(Sound.isOn() ? 'Sound on' : 'Sound off'); };
  }

  function leaveRoute() {
    if (cameFromHome) history.back();
    else location.hash = '';
  }

  function route() {
    var m = /^#\/coal(?:\/([A-Za-z]{4}))?\/?$/.exec(location.hash);
    if (!m) { if (code) closeRoom(); return; }
    var c = m[1] ? m[1].toUpperCase() : SHORE;
    if (!root) build();
    root.hidden = false;
    document.body.classList.add('coal-on');
    if (c === code && conn) return;
    if (code) closeRoom(true);
    if (m[1] && !CODE_RE.test(c)) { code = c; stopped('That room code is not valid. Codes are 4 letters.'); return; }
    openRoom(c);
  }

  function closeRoom(keepOverlay) {
    if (conn) {
      if (room && room.phase === 'lobby' && me) conn.send({ type: 'leave' });
      var c = conn; conn = null;
      setTimeout(function () { c.close(); }, 50);
    }
    cancelAnimationFrame(raf);
    Sound.crackle(false);
    code = null; me = null; room = null; view = ''; ui = {};
    if (!keepOverlay && root) {
      root.hidden = true;
      document.body.classList.remove('coal-on');
      var go = document.getElementById('coal');
      if (go && document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
    }
  }

  function openRoom(c) {
    code = c;
    $('#coal-where').innerHTML = c === SHORE ? '<strong>The Shore</strong> · public room' : 'Room <strong class="mono">' + esc(c) + '</strong>';
    if (!Net.serverBase()) { stopped('Live Coal is not switched on for this copy of the game yet.'); return; }
    var id = Net.identity();
    if (!id.name) { renderSetup(); return; }
    connectNow();
  }

  function connectNow() {
    var id = Net.identity();
    main.innerHTML = '<div class="coal-card"><p class="coal-wait">Walking down to the shore…</p></div>';
    conn = Net.connect({
      code: code,
      onMessage: onMessage,
      onStatus: onStatus
    });
    ui.joinSent = false;
    ui.id = id;
  }

  function onStatus(s, extra) {
    var el = $('#coal-net');
    if (!el) return;
    el.className = 'coal-net ' + s;
    el.textContent = s === 'open' ? '' : s === 'reconnecting' ? 'Reconnecting…' : s === 'connecting' ? 'Connecting…' : '';
    // Never got in after several tries: say so instead of waiting forever.
    if (s === 'reconnecting' && extra && extra.attempt >= 5 && !room && conn) {
      var c = conn; conn = null; c.close();
      stopped('Could not reach the fire. Check your connection, or try again in a minute.', true);
      return;
    }
    if (s === 'outdated') stopped('Live Coal has been updated. Refresh to update.', true);
    if (s === 'closed') stopped(ERRORS[extra] || 'Disconnected.', extra !== 'otherTab');
  }

  function stopped(text, canRetry) {
    view = 'stopped';
    var net = $('#coal-net'); if (net) { net.textContent = ''; net.className = 'coal-net'; }
    cancelAnimationFrame(raf);
    Sound.crackle(false);
    main.innerHTML = '<div class="coal-card" role="alert"><h2>' + esc(text) + '</h2>' +
      '<div class="coal-actions">' +
      (canRetry ? '<button type="button" class="btn primary" id="c-reload">Refresh</button>' : '') +
      '<button type="button" class="btn" id="c-shore">Go to The Shore</button>' +
      '<button type="button" class="btn quiet" id="c-home">Back to Fishers</button></div></div>';
    var r = $('#c-reload'); if (r) r.onclick = function () { location.reload(); };
    $('#c-shore').onclick = function () { conn = null; code = null; location.hash = '#/coal'; route(); };
    $('#c-home').onclick = leaveRoute;
  }

  // ------------------------------------------------------------------ setup (name and fish)
  function renderSetup(error) {
    view = 'setup';
    var id = Net.identity();
    var color = id.color || Object.keys(COLORS)[Math.floor(Math.random() * 8)];
    main.innerHTML =
      '<form class="coal-card coal-setup" id="c-setup" novalidate>' +
        '<p class="coal-eyebrow">Live Coal</p>' +
        '<h2>Who is coming to the fire?</h2>' +
        '<p class="coal-lede">Pass the live coal by naming answers. Run out of time and your coal goes out. Last one by the fire wins.</p>' +
        '<label for="c-name">Your name</label>' +
        '<input id="c-name" type="text" maxlength="16" autocomplete="nickname" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="go" value="' + esc(id.name || '') + '" aria-describedby="c-name-err">' +
        '<p class="coal-err" id="c-name-err" role="alert">' + esc(error || '') + '</p>' +
        '<fieldset class="coal-colors"><legend>Your fish</legend>' +
          Object.keys(COLORS).map(function (k) {
            return '<label class="coal-color"><input type="radio" name="c-color" value="' + k + '"' + (k === color ? ' checked' : '') + '>' +
              fish(k) + '<span class="sr-only">' + COLOR_NAMES[k] + '</span></label>';
          }).join('') +
        '</fieldset>' +
        '<button type="submit" class="btn primary">Sit by the fire</button>' +
        '<p class="coal-small">No account. Your name and fish are kept on this device so a refresh puts you back in your seat.</p>' +
      '</form>';
    var input = $('#c-name');
    input.focus();
    $('#c-setup').onsubmit = function (e) {
      e.preventDefault();
      var name = input.value.replace(/\s+/g, ' ').trim();
      if (name.length < 2 || name.length > 16) { $('#c-name-err').textContent = ERRORS.nameLength; input.focus(); return; }
      var picked = root.querySelector('input[name="c-color"]:checked');
      var idn = Net.identity();
      idn.name = name; idn.color = picked ? picked.value : 'ember';
      Net.saveIdentity(idn);
      if (conn && conn.isOpen()) {
        if (me) conn.send({ type: 'setName', name: idn.name, color: idn.color });
        else conn.send({ type: 'join', token: idn.token, name: idn.name, color: idn.color });
        ui.renamePending = !!me;
      } else connectNow();
    };
  }

  // ------------------------------------------------------------------ messages
  function onMessage(m) {
    switch (m.type) {
      case 'hello': {
        var id = Net.identity();
        conn.send({ type: 'join', token: id.token, name: id.name || '', color: id.color });
        break;
      }
      case 'snapshot':
        me = m.you;
        room = { phase: m.phase, hostId: m.hostId, preset: m.preset, players: m.players, game: m.game, last: m.last };
        if (room.game) { room.game.typing = ''; }
        ui.renamePending = false;
        if (room.phase === 'game') renderGame();
        else if (room.last && ui.seenOver !== room.last.no + ':' + room.last.endedAt && ui.showOverFromSnapshot !== false && recentlyEnded(room.last)) renderOver();
        else renderLobby();
        break;
      case 'players':
        if (!room) return;
        room.players = m.players; room.hostId = m.hostId; room.preset = m.preset;
        if (ui.renamePending) { ui.renamePending = false; renderLobby(); return; }
        if (view === 'lobby') renderLobby(); else if (view === 'game') drawSeats(); else if (view === 'over') drawOverButtons();
        break;
      case 'host':
        if (!room) return;
        room.hostId = m.hostId;
        if (m.hostId === me) say('You are now the host.');
        if (view === 'lobby') renderLobby(); else if (view === 'over') drawOverButtons();
        break;
      case 'gameStarted':
        room.phase = 'game';
        room.last = null;
        room.game = { order: m.order, startedAt: m.startedAt, round: 0, said: [], counts: {}, stage: 'intro', typing: '' };
        room.players.forEach(function (p) { p.inGame = m.order.indexOf(p.id) !== -1; p.out = false; p.outRound = null; });
        renderGame();
        break;
      case 'roundStarted': {
        var g = room.game;
        if (!g) return;
        g.round = m.round; g.prompt = m.prompt; g.turnMs = m.turnMs; g.stage = 'intro'; g.stageEnds = m.introEnds;
        g.said = []; g.counts = {}; g.holderId = null; g.deadline = null; g.remaining = m.prompt.total; g.nextHolder = m.firstHolder; g.typing = '';
        g.lastEnd = null;
        if (view !== 'game') renderGame(); else drawGameFrame();
        say('Round ' + m.round + '. ' + m.prompt.text + ' ' + secs(m.turnMs) + ' a turn.');
        break;
      }
      case 'turnStarted': {
        var g2 = room.game;
        if (!g2) return;
        var prev = g2.holderId || ui.lastHolder;
        g2.stage = 'turn'; g2.holderId = m.playerId; g2.deadline = m.deadline; g2.turnMs = m.turnMs; g2.typing = '';
        ui.feedback = null; ui.suggestion = null; ui.vibrated = false; ui.lastTick = null;
        moveCoal(prev, m.playerId);
        drawGameFrame();
        if (m.playerId === me) {
          alertSay('Your turn! ' + (g2.prompt ? g2.prompt.text : ''));
          if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) { /* ignore */ } }
        } else say(nameOf(m.playerId) + ' has the coal.');
        break;
      }
      case 'typing':
        if (room && room.game && m.playerId === room.game.holderId) { room.game.typing = m.text; drawTyping(); }
        break;
      case 'answerAccepted': {
        var g3 = room.game;
        if (!g3) return;
        g3.said.push({ by: m.playerId, answer: m.answer, tier: m.tier });
        g3.counts[m.playerId] = m.count;
        g3.remaining = m.remaining;
        ui.lastHolder = m.playerId;
        flashAccepted(m);
        drawSaid();
        Sound.whoosh();
        say(nameOf(m.playerId) + ' said ' + m.answer + '.');
        if (m.playerId === me) { var inp = $('#c-answer'); if (inp) inp.value = ''; }
        break;
      }
      case 'answerRejected':
        onRejected(m);
        break;
      case 'eliminated': {
        var p = player(m.playerId);
        if (p) { p.out = true; p.outRound = m.round; }
        if (room.game) { room.game.stage = 'pause'; room.game.holderId = null; room.game.lastEnd = { reason: 'eliminated', playerId: m.playerId }; }
        ui.lastHolder = m.playerId;
        puff(m.playerId, m.why);
        Sound.hiss();
        if (!m.why || m.why === 'timeout') banner(m.playerId === me ? 'Your coal went out' : nameOf(m.playerId) + '’s coal went out', 'Out for the rest of the game.', 'out');
        var line = m.why === 'removed' ? nameOf(m.playerId) + ' was removed.' : m.why === 'left' ? nameOf(m.playerId) + ' left the fire.' : (m.playerId === me ? 'Your coal went out.' : nameOf(m.playerId) + '’s coal went out.');
        alertSay(line);
        break;
      }
      case 'roundEnded':
        if (!room.game) return;
        room.game.stage = 'pause'; room.game.holderId = null; room.game.lastEnd = { reason: m.reason };
        drawGameFrame();
        banner(m.reason === 'empty' ? 'The net is empty!' : 'Everyone answered three times. Next round!', m.reason === 'empty' ? 'No one is out this round.' : 'No one is out; the clock gets shorter.');
        say(m.reason === 'empty' ? 'The net is empty! No one is out.' : 'Round over. No one is out.');
        break;
      case 'gameOver':
        room.phase = 'lobby'; room.game = null;
        room.players.forEach(function (p) { p.inGame = false; p.out = false; });
        if (!m.recap) { room.last = null; toast('Everyone left, so the game ended.'); renderLobby(); return; }
        room.last = m.recap;
        setTimeout(function () { if (room && room.last === m.recap) renderOver(); }, reduce ? 300 : 1600);
        break;
      case 'error':
        if (m.code === 'nameTaken' || m.code === 'nameLength' || m.code === 'nameBlocked') { renderSetup(ERRORS[m.code]); return; }
        if (m.code === 'full' || m.code === 'noRoom' || m.code === 'removed' || m.code === 'otherTab') { stopped(ERRORS[m.code], m.code === 'noRoom' ? false : m.code !== 'otherTab'); return; }
        toast(ERRORS[m.code] || 'Something went wrong.');
        break;
    }
  }
  function recentlyEnded(last) { return serverNow() - last.endedAt < 5 * 60000; }

  // ------------------------------------------------------------------ lobby
  function renderLobby() {
    if (!room) return;
    view = 'lobby';
    cancelAnimationFrame(raf);
    Sound.crackle(true);
    var meP = player(me);
    var playing = room.phase === 'game';
    var connected = room.players.filter(function (p) { return p.connected; }).length;
    var host = isHost();
    var title = code === SHORE ? 'The Shore' : 'Room ' + code;
    main.innerHTML =
      '<div class="coal-card coal-lobby">' +
        '<p class="coal-eyebrow">Live Coal · ' + (code === SHORE ? 'public room' : 'private room') + '</p>' +
        '<h2 id="c-lobby-title" tabindex="-1">' + esc(title) + '</h2>' +
        '<p class="coal-lede">Pass the live coal around the fire by naming answers. If your time runs out, your coal goes out. Last one by the fire wins.</p>' +
        '<p class="coal-ready" id="c-ready"><strong>' + connected + '</strong> by the fire' + (room.players.length > connected ? ' · ' + (room.players.length - connected) + ' away' : '') + ' · up to 16</p>' +
        '<ul class="coal-players" id="c-players">' + room.players.map(playerRow).join('') + '</ul>' +
        '<div class="coal-settings">' +
          '<p class="coal-small"><strong>Timer:</strong> <span id="c-preset-text">' + esc(PRESET_TEXT[room.preset] || PRESET_TEXT.standard) + '</span>, 1.5 s shorter each round.</p>' +
          (host ? '<div class="coal-presets" role="radiogroup" aria-label="Timer">' + ['relaxed', 'standard', 'fast'].map(function (k) {
            return '<button type="button" role="radio" class="coal-preset" data-preset="' + k + '" aria-checked="' + (room.preset === k) + '">' + k.charAt(0).toUpperCase() + k.slice(1) + '</button>';
          }).join('') + '</div>' : '') +
        '</div>' +
        (playing ? '<p class="coal-note">A game is on. You are watching and will join the next game automatically.</p>' : '') +
        '<div class="coal-actions">' +
          (host && !playing ? '<button type="button" class="btn primary" id="c-start"' + (connected < 2 ? ' disabled aria-describedby="c-start-why"' : '') + '>Light the fire</button>' +
            (connected < 2 ? '<p class="coal-small" id="c-start-why">Waiting for at least one more person.</p>' : '') : '') +
          (!host && !playing ? '<p class="coal-small">Waiting for ' + esc(nameOf(room.hostId)) + ' (host) to start.</p>' : '') +
          (playing ? '<button type="button" class="btn primary" id="c-watch">Watch the game</button>' : '') +
          '<button type="button" class="btn" id="c-share">' + (code === SHORE ? 'Share The Shore' : 'Share room') + '</button>' +
        '</div>' +
        '<details class="coal-more"><summary>More</summary>' +
          '<div class="coal-actions">' +
            '<button type="button" class="btn" id="c-rename">Change name or fish' + (meP ? ' (' + esc(meP.name) + ')' : '') + '</button>' +
            (code === SHORE ? '<button type="button" class="btn" id="c-create">Create a private room</button>' : '<button type="button" class="btn" id="c-to-shore">Go to The Shore</button>') +
            '<form class="coal-code" id="c-code-form" novalidate><label for="c-code">Join a room code</label>' +
              '<div class="coal-row"><input id="c-code" type="text" maxlength="4" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" placeholder="ABCD">' +
              '<button type="submit" class="btn">Join</button></div><p class="coal-err" id="c-code-err" role="alert"></p></form>' +
          '</div></details>' +
      '</div>';
    wirePlayers();
    root.querySelectorAll('.coal-preset').forEach(function (b) {
      b.onclick = function () { conn.send({ type: 'settings', preset: b.getAttribute('data-preset') }); };
    });
    var st = $('#c-start'); if (st) st.onclick = function () { conn.send({ type: 'start' }); };
    var w = $('#c-watch'); if (w) w.onclick = function () { renderGame(); };
    $('#c-share').onclick = shareRoom;
    $('#c-rename').onclick = function () { renderSetup(); };
    var cr = $('#c-create'); if (cr) cr.onclick = createPrivate;
    var ts = $('#c-to-shore'); if (ts) ts.onclick = function () { location.hash = '#/coal'; };
    $('#c-code-form').onsubmit = function (e) {
      e.preventDefault();
      var v = $('#c-code').value.trim().toUpperCase();
      if (!CODE_RE.test(v)) { $('#c-code-err').textContent = 'Codes are 4 letters (no I or O).'; return; }
      location.hash = '#/coal/' + v;
    };
    if (!ui.lobbyFocused) { ui.lobbyFocused = true; var h = $('#c-lobby-title'); if (h) h.focus({ preventScroll: true }); }
  }

  function playerRow(p) {
    var tags = [];
    if (p.id === room.hostId) tags.push('<span class="coal-tag host">host</span>');
    if (p.id === me) tags.push('<span class="coal-tag you">you</span>');
    if (room.phase === 'game' && !p.inGame) tags.push('<span class="coal-tag">watching</span>');
    if (room.phase === 'game' && p.out) tags.push('<span class="coal-tag out">out</span>');
    var kick = isHost() && p.id !== me ? '<button type="button" class="coal-kick" data-kick="' + esc(p.id) + '" aria-label="Remove ' + esc(p.name) + '">Remove</button>' : '';
    return '<li class="coal-player' + (p.connected ? '' : ' away') + '">' + fish(p.color) +
      '<span class="coal-pname">' + esc(p.name) + '</span>' + tags.join('') +
      '<span class="coal-dot ' + (p.connected ? 'on' : 'off') + '" title="' + (p.connected ? 'connected' : 'away') + '"><span class="sr-only">' + (p.connected ? 'connected' : 'away') + '</span></span>' +
      kick + '</li>';
  }

  // Remove asks once more before it acts.
  function wirePlayers() {
    root.querySelectorAll('[data-kick]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-kick');
        if (b.getAttribute('data-armed') === '1') { conn.send({ type: 'kick', target: id }); return; }
        b.setAttribute('data-armed', '1');
        b.textContent = 'Remove ' + nameOf(id) + '?';
        b.classList.add('armed');
        setTimeout(function () { if (b.isConnected) { b.removeAttribute('data-armed'); b.textContent = 'Remove'; b.classList.remove('armed'); } }, 4000);
      };
    });
  }

  function shareRoom() {
    var link = roomUrl();
    var text = code === SHORE ? 'Come play Live Coal with me on Fishers: tap Live Coal on the home screen, or open this link.' : 'Join my Live Coal room (' + code + ') on Fishers:';
    var Share = window.FSHShare;
    var done = function (r) { toast(r === 'copied' ? 'Link copied ✓' : 'Copy this link: ' + link); };
    if (!Share) { done('manual'); return; }
    Share.share(text, link).then(function (how) { if (how === 'failed') Share.copy(text + '\n' + link).then(done); });
  }

  function createPrivate() {
    var b = $('#c-create');
    if (b) { b.disabled = true; b.textContent = 'Making a room…'; }
    Net.createRoom().then(function (c) { location.hash = '#/coal/' + c; })
      .catch(function () { toast('Could not make a room. Try again.'); if (b) { b.disabled = false; b.textContent = 'Create a private room'; } });
  }

  // ------------------------------------------------------------------ game screen
  function renderGame() {
    if (!room || !room.game) { renderLobby(); return; }
    view = 'game';
    Sound.crackle(true);
    var meP = player(me);
    main.innerHTML =
      '<div class="coal-game">' +
        '<div class="coal-head">' +
          '<p class="coal-round" id="c-round"></p>' +
          '<h2 class="coal-cat" id="c-cat"></h2>' +
        '</div>' +
        '<div class="coal-stage" id="c-stage">' +
          '<div class="coal-fire" aria-hidden="true">' +
            '<div class="fire-glow"></div>' +
            '<svg class="fire-logs" viewBox="0 0 120 50"><rect x="8" y="26" width="104" height="12" rx="6" transform="rotate(-9 60 32)"/><rect x="8" y="26" width="104" height="12" rx="6" transform="rotate(9 60 32)"/></svg>' +
            '<div class="fire-coals"><i></i><i></i><i></i><i></i><i></i></div>' +
            '<div class="fire-fish">' + fish('sand', 'grill') + fish('sand', 'grill b') + '</div>' +
          '</div>' +
          '<div class="coal-seats" id="c-seats"></div>' +
          '<div class="coal-coal" id="c-coal" aria-hidden="true"><i></i></div>' +
          '<div class="coal-intro" id="c-intro" hidden></div>' +
          '<div class="coal-banner" id="c-banner" hidden></div>' +
        '</div>' +
        '<div class="coal-bar" id="c-bar"></div>' +
        '<details class="coal-said" id="c-said-box"><summary>Said this round <span id="c-said-n">0</span></summary><ol id="c-said"></ol></details>' +
        (meP && !meP.inGame ? '<p class="coal-note watch">You are watching. You will join the next game.</p>' : '') +
        '<button type="button" class="btn quiet coal-lobby-link" id="c-to-lobby">Room and players</button>' +
      '</div>';
    $('#c-to-lobby').onclick = function () { ui.lobbyFocused = false; renderLobby(); };
    ui.barFor = null;
    drawSeats();
    drawGameFrame();
    drawSaid();
    loop();
  }

  // Seats sit on an ellipse, clockwise from the top, in the server's order.
  function seatPos(i, n) {
    var a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: 50 + 41 * Math.cos(a), y: 50 + 39 * Math.sin(a) };
  }
  function drawSeats() {
    var g = room && room.game, box = $('#c-seats');
    if (!g || !box) return;
    var n = g.order.length;
    box.innerHTML = g.order.map(function (id, i) {
      var p = player(id) || { name: 'Gone', color: 'sand', out: true, connected: false };
      var pos = seatPos(i, n);
      var cls = 'coal-seat' + (p.out ? ' out' : '') + (p.connected ? '' : ' away') + (id === me ? ' me' : '') + (id === g.holderId ? ' holder' : '');
      return '<div class="' + cls + '" data-seat="' + esc(id) + '" style="left:' + pos.x + '%;top:' + pos.y + '%">' +
        '<svg class="seat-ring" viewBox="0 0 64 64" aria-hidden="true"><circle class="ring-bg" cx="32" cy="32" r="28"/><circle class="ring" cx="32" cy="32" r="28" pathLength="100"/></svg>' +
        '<span class="seat-fish">' + fish(p.color) + '</span>' +
        '<span class="seat-name">' + esc(p.name) + (id === me ? ' <span class="sr-only">(you)</span>' : '') + '</span>' +
        '<span class="seat-secs mono" aria-hidden="true"></span>' +
        (p.out ? '<span class="seat-out">out</span>' : '') +
        '<span class="seat-count" aria-hidden="true">' + countDots(g.counts[id] || 0) + '</span>' +
        '</div>';
    }).join('');
    placeCoal(g.holderId || g.nextHolder || ui.lastHolder, false);
  }
  function countDots(n) { var s = ''; for (var i = 0; i < 3; i++) s += '<i class="' + (i < n ? 'on' : '') + '"></i>'; return s; }
  function seatEl(id) { return id ? root.querySelector('[data-seat="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]') : null; }
  function seatXY(id) {
    var g = room.game; var i = g.order.indexOf(id);
    if (i === -1) return { x: 50, y: 52 };
    return seatPos(i, g.order.length);
  }

  // The coal: placed by a seat, or flown in an arc to the next one (~300 ms).
  function placeCoal(id, show) {
    var c = $('#c-coal'); if (!c) return;
    var p = id ? seatXY(id) : { x: 50, y: 52 };
    var at = toward(p, 0.62);
    c.style.left = at.x + '%'; c.style.top = at.y + '%';
    c.classList.toggle('lit', !!show);
  }
  function toward(p, k) { return { x: 50 + (p.x - 50) * k, y: 52 + (p.y - 52) * k }; }
  function moveCoal(fromId, toId) {
    var c = $('#c-coal'); if (!c) return;
    var to = toward(seatXY(toId), 0.62);
    if (!fromId || reduce || !c.animate) { placeCoal(toId, true); return; }
    var from = toward(seatXY(fromId), 0.62);
    var stage = $('#c-stage'), w = stage.clientWidth, h = stage.clientHeight;
    // A quadratic arc that bows up toward the fire.
    var mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 18 };
    var frames = [];
    for (var k = 0; k <= 10; k++) {
      var t = k / 10, x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * mid.x + t * t * to.x, y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * mid.y + t * t * to.y;
      frames.push({ transform: 'translate(' + ((x - to.x) / 100 * w) + 'px,' + ((y - to.y) / 100 * h) + 'px) scale(' + (1 + 0.35 * Math.sin(Math.PI * t)) + ')' });
    }
    c.style.left = to.x + '%'; c.style.top = to.y + '%';
    c.classList.add('lit');
    c.animate(frames, { duration: 300, easing: 'ease-in-out' });
  }

  function puff(id, why) {
    var s = seatEl(id);
    drawSeats();
    s = seatEl(id);
    var c = $('#c-coal');
    if (c) { c.classList.remove('lit'); c.classList.add('puff'); setTimeout(function () { if (c.isConnected) c.classList.remove('puff'); }, 1400); }
    if (!s) return;
    var t = document.createElement('span');
    t.className = 'seat-went';
    t.textContent = why === 'removed' ? 'Removed' : why === 'left' ? 'Left the fire' : 'Their coal went out';
    s.appendChild(t);
    var smoke = document.createElement('span');
    smoke.className = 'seat-smoke';
    s.appendChild(smoke);
    drawGameFrame();
  }

  function banner(title, sub, kind) {
    var b = $('#c-banner'); if (!b) return;
    b.className = 'coal-banner' + (kind ? ' ' + kind : '');
    b.innerHTML = '<strong>' + esc(title) + '</strong>' + (sub ? '<span>' + esc(sub) + '</span>' : '');
    b.hidden = false;
    clearTimeout(banner.t);
    banner.t = setTimeout(function () { if (b.isConnected) b.hidden = true; }, 1500);
  }

  function drawGameFrame() {
    var g = room && room.game;
    if (!g || view !== 'game') return;
    var round = $('#c-round'), cat = $('#c-cat');
    if (g.prompt) {
      round.innerHTML = 'Round ' + g.round + ' · <strong>' + secs(g.turnMs) + '</strong> a turn' + (g.prompt.category ? ' · ' + esc(g.prompt.category) : '');
      if (cat.textContent !== g.prompt.text) cat.textContent = g.prompt.text;
    }
    root.querySelectorAll('.coal-seat').forEach(function (el) {
      var id = el.getAttribute('data-seat');
      el.classList.toggle('holder', id === g.holderId && g.stage === 'turn');
      var cnt = el.querySelector('.seat-count'); if (cnt) cnt.innerHTML = countDots(g.counts[id] || 0);
    });
    var intro = $('#c-intro');
    if (g.stage === 'intro' && g.prompt) {
      intro.hidden = false;
      intro.innerHTML = '<p class="intro-round">Round ' + g.round + ' · get ready</p><p class="intro-cat">' + esc(g.prompt.text) + '</p>' +
        '<p class="intro-time"><strong>' + secs(g.turnMs) + '</strong> a turn · <span id="c-intro-first">' + esc(nameOf(g.nextHolder)) + (g.nextHolder === me ? ' (you)' : '') + '</span> starts</p><p class="intro-count mono" id="c-intro-count"></p>';
      placeCoal(g.nextHolder, false);
    } else intro.hidden = true;
    drawBar();
  }

  function drawBar() {
    var g = room.game, bar = $('#c-bar');
    if (!bar) return;
    var mine = g.stage === 'turn' && g.holderId === me;
    var key = (mine ? 'me' : 'watch') + ':' + g.holderId + ':' + g.stage;
    if (ui.barFor === key) { drawTyping(); return; }
    ui.barFor = key;
    if (mine) {
      bar.className = 'coal-bar mine';
      bar.innerHTML =
        '<p class="coal-feedback" id="c-feedback" aria-live="polite"></p>' +
        '<form class="coal-answer" id="c-form" autocomplete="off" novalidate>' +
          '<label class="sr-only" for="c-answer">Your answer: ' + esc(g.prompt ? g.prompt.text : '') + '</label>' +
          '<input id="c-answer" type="text" inputmode="text" maxlength="60" placeholder="Your turn: name one…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" aria-describedby="c-feedback">' +
          '<button type="submit" class="btn primary">Pass</button>' +
        '</form>';
      var input = $('#c-answer');
      input.focus({ preventScroll: true });
      ui.sentTyping = '';
      input.addEventListener('input', function () {
        if (ui.suggestion && input.value !== ui.suggestion.input) { ui.suggestion = null; setFeedback(null); }
        queueTyping(input.value);
      });
      $('#c-form').onsubmit = function (e) {
        e.preventDefault();
        var text = input.value.trim();
        if (!text) return;
        if (ui.suggestion && input.value === ui.suggestion.input) conn.send({ type: 'confirmSuggestion' });
        else conn.send({ type: 'submit', text: text.slice(0, 200) });
        input.focus({ preventScroll: true });
      };
    } else {
      bar.className = 'coal-bar watch';
      var line;
      if (g.stage === 'turn') line = '<strong>' + esc(nameOf(g.holderId)) + '</strong> is holding the coal…';
      else if (g.stage === 'intro') line = 'Get ready…';
      else line = '&nbsp;';
      bar.innerHTML = '<p class="coal-watching">' + line + '</p><p class="coal-typing" aria-hidden="true">' + (g.stage === 'turn' ? '<span id="c-typing"></span><i class="caret"></i>' : '') + '</p>';
      drawTyping();
    }
  }
  function drawTyping() {
    var el = $('#c-typing');
    if (el && room.game) el.textContent = room.game.stage === 'turn' ? room.game.typing || '' : '';
  }

  // Live typing: only when the text changes, at most 8 updates a second.
  function queueTyping(text) {
    ui.typingNext = text.slice(0, 60);
    if (ui.typingTimer) return;
    var send = function () {
      ui.typingTimer = null;
      if (ui.typingNext === ui.sentTyping) return;
      ui.sentTyping = ui.typingNext;
      if (conn) conn.send({ type: 'typing', text: ui.sentTyping });
      ui.typingTimer = setTimeout(function () { ui.typingTimer = null; if (ui.typingNext !== ui.sentTyping) queueTyping(ui.typingNext); }, 125);
    };
    send();
  }

  function setFeedback(f) {
    ui.feedback = f;
    var el = $('#c-feedback');
    if (!el) return;
    el.className = 'coal-feedback' + (f ? ' ' + f.kind : '');
    el.innerHTML = f ? f.html : '';
    if (f) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }
  function onRejected(m) {
    if (m.reason === 'miss') setFeedback({ kind: 'miss', html: 'Not in the net. Keep trying.' });
    else if (m.reason === 'duplicate') setFeedback({ kind: 'dup', html: 'Already said by <strong>' + esc(m.by === me ? 'you' : m.byName) + '</strong>' + (m.answer ? ' (' + esc(m.answer) + ')' : '') + '.' });
    else if (m.reason === 'near') setFeedback({ kind: 'near', html: '<strong>' + esc(m.name) + ':</strong> ' + esc(m.message) });
    else if (m.reason === 'suggest') {
      var input = $('#c-answer');
      ui.suggestion = { answer: m.answer, input: input ? input.value : '' };
      setFeedback({ kind: 'suggest', html: 'Did you mean <strong>' + esc(m.answer) + '</strong>? Press Enter again to confirm.' });
    }
  }

  function flashAccepted(m) {
    var s = seatEl(m.playerId);
    if (s) {
      var tag = document.createElement('span');
      tag.className = 'seat-said ct-' + m.tier + (seatXY(m.playerId).y < 40 ? ' below' : '');
      tag.textContent = m.answer;
      s.appendChild(tag);
      setTimeout(function () { if (tag.isConnected) tag.remove(); }, 1800);
    }
  }

  function drawSaid() {
    var g = room && room.game, ol = $('#c-said');
    if (!g || !ol) return;
    $('#c-said-n').textContent = g.said.length + (g.prompt ? ' of ' + g.prompt.total : '');
    ol.innerHTML = g.said.slice().reverse().map(function (s) {
      var t = TIERS[s.tier] || TIERS[1];
      return '<li class="ct-' + s.tier + '"><span class="said-ans">' + esc(s.answer) + '</span>' +
        '<span class="said-tier" title="' + esc(t.name) + '">' + t.emoji + ' ' + esc(t.name) + '</span>' +
        '<span class="said-by">' + esc(nameOf(s.by)) + '</span></li>';
    }).join('');
  }

  // One animation loop draws the coal's glow, the ring and the seconds.
  function loop() {
    cancelAnimationFrame(raf);
    var frame = function () {
      if (view !== 'game' || !room || !room.game) return;
      var g = room.game, now = serverNow();
      if (g.stage === 'intro') {
        var ic = $('#c-intro-count');
        if (ic) { var left = Math.max(0, Math.ceil((g.stageEnds - now) / 1000)); ic.textContent = left > 0 ? left : ''; }
      }
      var coal = $('#c-coal');
      if (g.stage === 'turn' && g.deadline) {
        var rem = Math.max(0, g.deadline - now), frac = Math.max(0, Math.min(1, rem / g.turnMs));
        var seat = seatEl(g.holderId);
        if (seat) {
          var ring = seat.querySelector('.ring'); if (ring) ring.style.strokeDashoffset = String(100 - frac * 100);
          var sx = seat.querySelector('.seat-secs'); if (sx) sx.textContent = (rem / 1000).toFixed(rem < 3000 ? 1 : 0);
          seat.classList.toggle('low', rem < 3000);
        }
        if (coal) {
          coal.style.setProperty('--heat', frac.toFixed(3));
          coal.classList.toggle('flicker', rem < 3000 && rem > 0 && !reduce);
          coal.classList.add('lit');
        }
        if (rem < 3000 && rem > 0) {
          var sec = Math.ceil(rem / 1000);
          if (ui.lastTick !== sec) { ui.lastTick = sec; Sound.tick(); }
          if (!ui.vibrated && g.holderId === me) { ui.vibrated = true; if (navigator.vibrate) { try { navigator.vibrate([60, 40, 60]); } catch (e) { /* ignore */ } } alertSay('3 seconds!'); }
        }
      } else if (coal) coal.classList.remove('flicker');
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ game over
  function renderOver() {
    var last = room && room.last;
    if (!last) { renderLobby(); return; }
    view = 'over';
    cancelAnimationFrame(raf);
    ui.seenOver = last.no + ':' + last.endedAt;
    var winner = last.players.find(function (p) { return p.id === last.winnerId; });
    var rows = last.players.slice().sort(function (a, b) { return (a.place || 99) - (b.place || 99); });
    main.innerHTML =
      '<div class="coal-card coal-over">' +
        '<div class="coal-winner" aria-hidden="true"><div class="fire-glow small"></div>' + fish(winner ? winner.color : 'sand', 'big') + '</div>' +
        '<p class="coal-eyebrow">Game over · ' + last.rounds + ' round' + (last.rounds === 1 ? '' : 's') + '</p>' +
        '<h2 id="c-over-title" tabindex="-1">' + (winner ? esc(winner.id === me ? 'You are' : winner.name + ' is') + ' the last one by the fire' : 'The fire went out') + '</h2>' +
        (winner ? '<p class="coal-lede">“Last one by the fire.”</p>' : '<p class="coal-lede">No winner this time.</p>') +
        '<ol class="coal-recap" aria-label="How everyone did">' +
          rows.map(function (p) {
            var r = p.rarest, t = r ? (TIERS[r.tier] || TIERS[1]) : null;
            return '<li class="' + (p.id === me ? 'me' : '') + '">' +
              '<span class="rc-place">' + (p.place || '–') + '</span>' +
              '<span class="rc-who">' + fish(p.color) + '<strong>' + esc(p.name) + '</strong>' + (p.place === 1 ? ' <span aria-label="winner">🔥</span>' : '') + '</span>' +
              '<span class="rc-line">' + (p.place === 1 ? 'Lasted all ' + p.lastedTo + ' round' + (p.lastedTo === 1 ? '' : 's') : 'Out in round ' + p.lastedTo) + ' · ' + p.answers.length + ' answer' + (p.answers.length === 1 ? '' : 's') + '</span>' +
              (r ? '<span class="rc-rare ct-' + r.tier + '">Rarest: <strong>' + esc(r.answer) + '</strong> ' + t.emoji + ' ' + esc(t.name) + '</span>' : '') +
              (p.answers.length ? '<details class="rc-all"><summary>All answers</summary><ul>' + p.answers.map(function (a) { return '<li>' + esc(a.answer) + ' <span title="' + esc((TIERS[a.tier] || TIERS[1]).name) + '">' + (TIERS[a.tier] || TIERS[1]).emoji + '</span> <span class="coal-small">round ' + a.round + '</span></li>'; }).join('') + '</ul></details>' : '') +
              '</li>';
          }).join('') +
        '</ol>' +
        '<div class="coal-actions" id="c-over-actions"></div>' +
      '</div>';
    drawOverButtons();
    var h = $('#c-over-title'); if (h) h.focus({ preventScroll: true });
    alertSay(winner ? winner.name + ' wins: last one by the fire.' : 'Game over. No winner.');
  }
  function drawOverButtons() {
    var box = $('#c-over-actions'); if (!box) return;
    var host = isHost();
    var connected = room.players.filter(function (p) { return p.connected; }).length;
    box.innerHTML =
      (host ? '<button type="button" class="btn primary" id="c-rematch"' + (connected < 2 ? ' disabled' : '') + '>Rematch</button>' : '<p class="coal-small">' + esc(nameOf(room.hostId)) + ' (host) can start a rematch.</p>') +
      '<button type="button" class="btn" id="c-back-lobby">Back to lobby</button>' +
      '<button type="button" class="btn" id="c-share-result">Share result</button>';
    var r = $('#c-rematch'); if (r) r.onclick = function () { conn.send({ type: 'rematch' }); };
    $('#c-back-lobby').onclick = function () { ui.lobbyFocused = false; renderLobby(); };
    $('#c-share-result').onclick = shareResult;
  }
  function shareResult() {
    var last = room.last; if (!last) return;
    var mine = last.players.find(function (p) { return p.id === me; });
    var winner = last.players.find(function (p) { return p.id === last.winnerId; });
    var lines = ['Fishers · Live Coal 🔥'];
    if (mine) lines.push(mine.place === 1 ? 'I was the last one by the fire! (' + last.players.length + ' players, ' + last.rounds + ' rounds)' : 'I lasted to round ' + mine.lastedTo + ' of ' + last.rounds + (winner ? '; ' + winner.name + ' won' : ''));
    if (mine && mine.rarest) lines.push('Rarest answer: ' + mine.rarest.answer + ' ' + (TIERS[mine.rarest.tier] || TIERS[1]).emoji);
    var text = lines.join('\n'), link = roomUrl();
    var Share = window.FSHShare;
    if (!Share) return;
    Share.share(text, link).then(function (how) { if (how === 'failed') Share.copy(text + '\n' + link).then(function (r) { toast(r === 'copied' ? 'Result copied ✓' : 'Could not copy'); }); });
  }

  // ------------------------------------------------------------------ start
  window.addEventListener('hashchange', function (e) {
    if (/#\/coal/.test(location.hash) && !/#\/coal/.test(e.oldURL || '')) cameFromHome = true;
    if (!/#\/coal/.test(location.hash)) cameFromHome = false;
    route();
  });
  window.FSHCoal = {
    open: function () { location.hash = '#/coal'; },
    state: function () { return { view: view, code: code, me: me, room: room, offset: conn ? conn.offset() : 0, rtt: conn ? conn.rtt() : 0 }; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', route); else route();
})();
