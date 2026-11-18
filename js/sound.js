/* Fishers: sound. Every sound is made here with the Web Audio API, so there are
 * no audio files and nothing to license. Off by default; the corner button and
 * Settings turn it on. */
(function () {
  'use strict';

  var ctx = null, on = false;

  function ac() {
    if (!on) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function env(g, t, peak, attack, release) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }

  function tone(type, freq, peak, attack, release, when, glideTo) {
    var c = ac(); if (!c) return;
    var t = c.currentTime + (when || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + attack + release);
    env(g, t, peak, attack, release);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + attack + release + 0.05);
  }

  function noise(dur, filterFrom, filterTo, peak, when) {
    var c = ac(); if (!c) return;
    var t = c.currentTime + (when || 0);
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(filterFrom, t);
    f.frequency.exponentialRampToValueAtTime(filterTo, t + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t); src.stop(t + dur + 0.05);
  }

  // Bell pitches climb with the tier: a pentatonic scale on D.
  var BELL = [0, 587.3, 659.3, 740, 880, 987.8, 1174.7];

  window.FSHSound = {
    set: function (v) { on = !!v; if (on) ac(); },
    enabled: function () { return on; },
    plop: function () { tone('sine', 520, 0.18, 0.005, 0.16, 0, 180); },
    thud: function () { tone('sine', 110, 0.28, 0.005, 0.22, 0, 60); tone('triangle', 70, 0.12, 0.005, 0.18); },
    whoosh: function (sec) { noise(Math.max(0.6, sec || 1.5), 300, 2400, 0.08); },
    bell: function (tier) {
      var f = BELL[tier] || 660;
      tone('sine', f, 0.12, 0.004, 1.1);
      tone('sine', f * 2.76, 0.03, 0.004, 0.5);
    },
    chord: function () {
      [293.7, 370, 440, 587.3].forEach(function (f, i) { tone('triangle', f, 0.07, 0.04 + i * 0.03, 2.2, i * 0.06); });
    }
  };
})();
