/* Fishers: Live Coal artwork, drawn in the same flat, layered style as the
 * main game's scene (js/scene.js): the Sea of Galilee at night, the boat
 * pulled up on the beach, and "a fire of coals there, and fish laid thereon,
 * and bread" (John 21:9 KJV).
 *
 * Everything is inline SVG built here: no image files. Shapes that should
 * look hand-made (charcoal lumps, stones) come from a small seeded generator,
 * so they are the same on every device and every visit.
 */
(function (root) {
  'use strict';

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function f(n) { return Math.round(n * 10) / 10; }

  // A rounded irregular blob: n points on an ellipse, jittered, joined with
  // quadratic curves through the midpoints (soft corners, like charcoal).
  function blob(cx, cy, rx, ry, n, jitter, r, angle) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (angle || 0) + i / n * Math.PI * 2 + (r() - .5) * .5;
      var k = 1 - jitter / 2 + r() * jitter;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    var mid = function (p, q) { return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
    var d = 'M' + mid(pts[n - 1], pts[0]).map(f).join(' ');
    for (var j = 0; j < n; j++) {
      var p = pts[j], m = mid(p, pts[(j + 1) % n]);
      d += 'Q' + f(p[0]) + ' ' + f(p[1]) + ' ' + f(m[0]) + ' ' + f(m[1]);
    }
    return d + 'Z';
  }
  // A crack: a short jagged line inside a lump.
  function crack(cx, cy, len, r) {
    var a = r() * Math.PI, x = cx - Math.cos(a) * len / 2, y = cy - Math.sin(a) * len / 2;
    var d = 'M' + f(x) + ' ' + f(y);
    for (var i = 1; i <= 3; i++) {
      x += Math.cos(a) * len / 3 + (r() - .5) * len * .35;
      y += Math.sin(a) * len / 3 + (r() - .5) * len * .35;
      d += 'L' + f(x) + ' ' + f(y);
    }
    return d;
  }

  // ------------------------------------------------------------------ the night shore
  // Far hills: the main game's hill line, in night colours.
  var HILLS =
    '<svg class="cs-hills" viewBox="0 0 400 70" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="M0 42C40 26 70 32 100 36s60-20 100-17 70 22 110 17 60-14 90-9v43H0z" fill="#3a3866" opacity=".75"/>' +
      '<path d="M0 54c50-14 90-9 130-3s80-14 130-11 90 14 140 6v24H0z" fill="#2a2a50"/>' +
    '</svg>';

  // The main game's boat, pulled up on the sand: no sail up, a net drying over the side.
  var BOAT =
    '<svg class="cs-boat" viewBox="0 0 150 100" aria-hidden="true">' +
      '<path d="M75 10v58" stroke="#2e2030" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M50 30L75 12l30 20" stroke="#4a3a52" stroke-width="1" fill="none" opacity=".7"/>' +
      '<path d="M8 66h134c-6 18-19 27-36 27H44C27 93 15 84 8 66z" fill="#3b2a24"/>' +
      '<path d="M8 66h134l-3 8H11z" fill="#4e382b"/>' +
      '<path d="M20 79h110M30 86h90" stroke="#24181a" stroke-width="1.6" opacity=".6"/>' +
      '<path d="M2 66c4-3 7-6 6-12M148 66c-4-3-7-6-6-12" stroke="#3b2a24" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      // the net over the gunwale
      '<path d="M96 66c2 10 4 18 2 26M104 66c2 9 5 17 4 25M112 66c1 9 4 16 4 24M120 66c0 8 2 15 1 22M92 72c10 2 20 2 30 0M94 80c10 2 20 2 28 0M96 88c8 1 16 1 24 0" stroke="#a6977a" stroke-width="1" fill="none" opacity=".55"/>' +
      '<path d="M90 66c10 3 26 3 36 0" stroke="#b9a988" stroke-width="2" fill="none" opacity=".7"/>' +
    '</svg>';

  var MOON =
    '<svg class="cs-moon" viewBox="0 0 120 120" aria-hidden="true">' +
      '<defs><radialGradient id="cs-moonglow"><stop offset="0" stop-color="#fff6dc" stop-opacity=".55"/><stop offset=".35" stop-color="#cfd8ff" stop-opacity=".18"/><stop offset="1" stop-color="#cfd8ff" stop-opacity="0"/></radialGradient></defs>' +
      '<circle cx="60" cy="60" r="58" fill="url(#cs-moonglow)"/>' +
      '<circle cx="60" cy="60" r="17" fill="#fbf1d6"/>' +
      '<circle cx="54" cy="55" r="3.2" fill="#e8dcbc"/><circle cx="66" cy="66" r="2.4" fill="#e8dcbc"/><circle cx="64" cy="52" r="1.6" fill="#e8dcbc"/>' +
    '</svg>';

  // Moonlight on the water: broken horizontal strokes under the moon.
  var GLITTER = (function () {
    var r = rng(7), s = '';
    for (var i = 0; i < 16; i++) {
      var y = 4 + i * 5.5, w = 34 - i * 1.4 + r() * 10, x = 50 - w / 2 + (r() - .5) * 6;
      s += '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="1.6" rx=".8" fill="#e9eeff" opacity="' + f(.55 - i * .028) + '"/>';
    }
    return '<svg class="cs-glitter" viewBox="0 0 100 95" preserveAspectRatio="none" aria-hidden="true">' + s + '</svg>';
  })();

  function stars() {
    var r = rng(21), s = '';
    for (var i = 0; i < 70; i++) {
      var big = r() < .12;
      s += '<circle cx="' + f(r() * 100) + '" cy="' + f(r() * 100) + '" r="' + (big ? .32 : .16) + '" fill="#fff" opacity="' + f(.35 + r() * .6) + '"' + (big ? ' class="tw" style="animation-delay:' + f(r() * 4) + 's"' : '') + '/>';
    }
    return '<svg class="cs-stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + s + '</svg>';
  }

  function scene() {
    return '<div class="cs-sky"></div>' + stars() + MOON +
      '<div class="cs-far">' + HILLS + '</div>' +
      '<div class="cs-sea"><div class="cs-sea-shine">' + GLITTER + '</div></div>' +
      '<div class="cs-waterline"></div>' +
      '<div class="cs-sand"></div>' +
      '<div class="cs-boat-wrap">' + BOAT + '</div>';
  }

  // ------------------------------------------------------------------ the fire of coals
  function fire() {
    var r = rng(1919);   // John 21:9
    var cx = 100, cy = 92, s = '';
    s += '<svg class="cf" viewBox="0 0 200 150" aria-hidden="true">';
    s += '<defs>' +
      '<radialGradient id="cf-ground" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff9a3c" stop-opacity=".55"/><stop offset=".55" stop-color="#ff6a1f" stop-opacity=".16"/><stop offset="1" stop-color="#ff6a1f" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="cf-bed" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#ffb347"/><stop offset=".35" stop-color="#d9531d"/><stop offset=".75" stop-color="#5a1e10"/><stop offset="1" stop-color="#1c1210"/></radialGradient>' +
      '<radialGradient id="cf-ember" cx=".45" cy=".4" r=".65"><stop offset="0" stop-color="#ffe7a3"/><stop offset=".4" stop-color="#ff9433"/><stop offset=".8" stop-color="#c2351a" stop-opacity=".85"/><stop offset="1" stop-color="#7a1d0e" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="cf-char" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c211e"/><stop offset=".7" stop-color="#171010"/><stop offset="1" stop-color="#5a1e10"/></linearGradient>' +
      '<linearGradient id="cf-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d6f66"/><stop offset="1" stop-color="#3e3530"/></linearGradient>' +
      '<linearGradient id="cf-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a1a" stop-opacity=".95"/><stop offset=".35" stop-color="#ff9a2e"/><stop offset=".7" stop-color="#ffd76a"/><stop offset="1" stop-color="#fff4c4" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="cf-fish" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2b77e"/><stop offset=".55" stop-color="#b98548"/><stop offset="1" stop-color="#7a4a24"/></linearGradient>' +
      '<filter id="cf-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.6"/></filter>' +
      '<linearGradient id="cf-loaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6b26a"/><stop offset="1" stop-color="#9c6630"/></linearGradient>' +
    '</defs>';
    // Light thrown on the sand.
    s += '<ellipse class="cf-groundglow" cx="' + cx + '" cy="' + (cy + 6) + '" rx="100" ry="56" fill="url(#cf-ground)"/>';
    // Stones, back half first (behind the coals).
    var stones = [];
    for (var i = 0; i < 11; i++) {
      var a = i / 11 * Math.PI * 2 + .15;
      stones.push({ a: a, x: cx + Math.cos(a) * 66, y: cy + Math.sin(a) * 32, rx: 10 + r() * 4, ry: 7.5 + r() * 3, seed: r() });
    }
    function stone(st) {
      var rr = rng(Math.floor(st.seed * 1e6));
      var d = blob(st.x, st.y, st.rx, st.ry, 7, .28, rr);
      // The edge that faces the fire catches the light: a thin crescent.
      var ix = -Math.cos(st.a), iy = -Math.sin(st.a);
      var lit = 'M' + f(st.x - st.rx * .75) + ' ' + f(st.y - st.ry * .35) +
        'Q' + f(st.x + ix * st.rx * .5) + ' ' + f(st.y - st.ry * 1.05 + iy * 2) + ' ' + f(st.x + st.rx * .75) + ' ' + f(st.y - st.ry * .35);
      var warm = Math.sin(st.a) < 0 ? .75 : .4;
      return '<path d="' + d + '" fill="url(#cf-stone)"/>' +
        '<path d="' + d + '" fill="#ff8a3c" opacity="' + f(warm * .16) + '"/>' +
        '<path d="' + lit + '" stroke="#ffb070" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="' + f(warm * .7) + '"/>';
    }
    stones.filter(function (st) { return Math.sin(st.a) < 0; }).forEach(function (st) { s += stone(st); });
    // The bed of embers.
    s += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="60" ry="27" fill="url(#cf-bed)"/>';
    // Charcoal: black lumps lit from below, with glowing seams. One in four
    // burns right through and glows red-orange all over.
    var lumps = [];
    for (var j = 0; j < 24; j++) {
      var t = j / 24 * Math.PI * 2 * 2.3, rad = Math.sqrt((j + .5) / 24);
      lumps.push({ x: cx + Math.cos(t) * 48 * rad + (r() - .5) * 6, y: cy - 1 + Math.sin(t) * 20 * rad + (r() - .5) * 3, w: 7 + r() * 5, h: 5 + r() * 3.5, hot: r() < .25 });
    }
    lumps.sort(function (p, q) { return p.y - q.y; });
    lumps.forEach(function (l, k) {
      var rr = rng(k * 97 + 5);
      var d = blob(l.x, l.y, l.w, l.h, 6, .45, rr, rr() * 3);
      var face = blob(l.x - .5, l.y - l.h * .3, l.w * .7, l.h * .45, 6, .35, rr);
      s += '<g class="cf-lump" style="--d:' + f(rr() * 3) + 's;--p:' + f(1.8 + rr() * 1.6) + 's">' +
        '<path class="cf-glow" d="' + d + '" fill="none" stroke="#ff7a2a" stroke-width="2.6" filter="url(#cf-soft)"/>' +   // light from below
        '<path d="' + d + '" fill="' + (l.hot ? 'url(#cf-ember)' : 'url(#cf-char)') + '"/>' +
        (l.hot ? '' : '<path d="' + face + '" fill="#3a2c28" opacity=".8"/>') +
        '<path class="cf-crack" d="' + crack(l.x, l.y, l.w * 1.2, rr) + '" stroke="' + (l.hot ? '#fff0b0' : '#ff9a3c') + '" stroke-width="' + (l.hot ? .7 : .9) + '" fill="none" stroke-linecap="round"/>' +
        '<path d="' + blob(l.x - 1, l.y - l.h * .5, l.w * .5, l.h * .22, 5, .3, rr) + '" fill="#cbbfb8" opacity="' + f(.15 + rr() * .25) + '"/>' +   // white ash on top
      '</g>';
    });
    // A few low flames, behind the fish: a fire of coals burns low.
    [[78, 84, .95], [97, 78, 1.25], [114, 82, 1.05], [128, 88, .75], [64, 92, .6]].forEach(function (fl, i) {
      s += '<g transform="translate(' + fl[0] + ' ' + fl[1] + ') scale(' + fl[2] + ')"><path class="cf-flame" style="--fd:' + f(i * .37) + 's;--fp:' + f(.7 + (i % 3) * .22) + 's" d="M0 0C-6 -5 -6 -12 -2 -19C-1 -14 1.5 -13 1.5 -17C6 -11 7 -5 0 0z" fill="url(#cf-flame)"/></g>';
    });
    // Two fish laid on the coals, and a loaf of bread on a flat stone.
    function fish(x, y, rot, flip) {
      return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')' + (flip ? ' scale(-1 1)' : '') + '">' +
        '<ellipse cx="-3" cy="3" rx="20" ry="4" fill="#000" opacity=".35"/>' +
        '<path d="M15 0l11 -8c-2 5 -2 11 0 16z" fill="#b07a44" stroke="#3a2210" stroke-width=".7"/>' +
        '<path d="M-24 0C-15 -10 6 -11 17 0C6 11 -15 10 -24 0z" fill="url(#cf-fish)" stroke="#3a2210" stroke-width=".8"/>' +
        '<path d="M-21 -1C-12 -7 5 -8 14 -1" stroke="#f3d6a2" stroke-width="1.6" fill="none" opacity=".55" stroke-linecap="round"/>' +   // the lit back
        '<path d="M-7 -5.5l-2 9M0 -6.5l-2 11M7 -5l-2 9" stroke="#5a3418" stroke-width="1.3" opacity=".55" stroke-linecap="round"/>' +  // char lines from the coals
        '<path d="M-15 -4.5c1.6 2.8 1.6 6.2 0 9" stroke="#7a4a24" stroke-width=".9" fill="none"/>' +
        '<circle cx="-18.5" cy="-1.5" r="1.3" fill="#24150b"/>' +
      '</g>';
    }
    s += fish(84, 86, -10, false) + fish(118, 93, 12, true);
    // Front stones, over the coals.
    stones.filter(function (st) { return Math.sin(st.a) >= 0; }).forEach(function (st) { s += stone(st); });
    // The bread on its own flat stone, to the side.
    s += '<path d="' + blob(170, 118, 15, 6, 7, .2, rng(3)) + '" fill="url(#cf-stone)"/>' +
      '<path d="M158 115c0-8 6-12 12-12s12 4 12 12c-6 2-18 2-24 0z" fill="url(#cf-loaf)"/>' +
      '<path d="M164 108c2 2 2 5 0 7M170 106c2 3 2 6 0 9M176 108c2 2 2 5 0 7" stroke="#7c4a20" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M160 113c6 2 14 2 20 0" stroke="#f3cf91" stroke-width="1" fill="none" opacity=".5"/>';
    s += '</svg>';
    // Sparks: HTML, so they can rise past the drawing.
    var sp = '<div class="cf-sparks">';
    for (var k = 0; k < 12; k++) sp += '<i style="left:' + f(36 + r() * 28) + '%;--sd:' + f(r() * 4) + 's;--sp:' + f(2.4 + r() * 2) + 's;--sx:' + f((r() - .5) * 40) + 'px"></i>';
    sp += '</div>';
    return s + sp;
  }

  // ------------------------------------------------------------------ the live coal
  // One lump of charcoal. Its heat (--heat, 1 -> 0) is the clock: the veins
  // and the glow underneath fade, grey ash creeps over it, and it ends as a
  // black lump with dull red cracks.
  function coal() {
    var r = rng(4219);
    var d = blob(28, 24, 19, 14.5, 9, .32, r, .3);
    var top = blob(26, 19, 15, 8, 7, .3, r);
    var veins = '';
    // Seams: one long crack across the lump with two branches off it.
    veins += '<path d="M12 22L19 20.5L24 23L30 21L37 24L43 22.5" stroke-width="1.9"/>' +
      '<path d="M24 23L23 28L26 32" stroke-width="1.4"/><path d="M30 21L31.5 16L35 13.5" stroke-width="1.3"/>' +
      '<path d="M19 20.5L17 16" stroke-width="1"/>';
    var ash = '';
    [[20, 15, 6, 2.6], [34, 29, 5, 2.2], [15, 27, 3.5, 1.6], [39, 17, 3, 1.4]].forEach(function (a) { ash += '<path d="' + blob(a[0], a[1], a[2], a[3], 6, .45, r) + '"/>'; });
    return '<svg class="lc" viewBox="0 0 56 48" aria-hidden="true">' +
      '<defs>' +
        '<radialGradient id="lc-under" cx=".5" cy=".6" r=".6"><stop offset="0" stop-color="#ff8a2a"/><stop offset=".6" stop-color="#b8361a"/><stop offset="1" stop-color="#3a1510"/></radialGradient>' +
        '<linearGradient id="lc-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3a36"/><stop offset=".5" stop-color="#2a1d1a"/><stop offset="1" stop-color="#140c0a"/></linearGradient>' +
        '<filter id="lc-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4"/></filter>' +
      '</defs>' +
      '<path class="lc-under" d="' + d + '" fill="url(#lc-under)" transform="translate(0 1.5)"/>' +
      '<path d="' + d + '" fill="url(#lc-body)"/>' +
      '<path class="lc-rim" d="' + d + '" fill="none" stroke-width="2.2"/>' +
      '<path d="' + top + '" fill="#5a4a46" opacity=".45"/>' +
      '<g class="lc-veinglow" stroke-linecap="round" stroke-linejoin="round" fill="none" filter="url(#lc-blur)">' + veins + '</g>' +
      '<g class="lc-cracks" stroke-linecap="round" stroke-linejoin="round" fill="none">' + veins + '</g>' +
      '<g class="lc-ash" fill="#cfc8c2">' + ash + '</g>' +
    '</svg>';
  }

  root.FSHCoalArt = { scene: scene, fire: fire, coal: coal };
})(window);
