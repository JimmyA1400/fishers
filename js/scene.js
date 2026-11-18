/* Fishers: the world. One continuous painted strip, from dawn over Galilee to
 * the floor of the sea at 7,000 m, which the player lives inside for the whole
 * game. A camera (a translateY) moves through it; 1 m is 1 px.
 *
 * Layers, back to front, each moved with transforms only:
 *   water      a full-screen gradient whose colors follow the camera's depth
 *   rays       light shafts under the surface, fading out by ~800 m
 *   kelp       swaying seagrass and kelp silhouettes (parallax 0.85)
 *   world      sky, hills, sun, boat, zones, gauge, specks, the 153 (parallax 1)
 *   marks      tier lines drawn for a sink (parallax 1)
 *   ambient    passing schools of fish and rising bubbles (screen space)
 *   front      rocks and seagrass at the screen edges (parallax 1.2)
 *   dim        darkness that gathers below 3,000 m
 *   line       the net rope from the boat to the fish
 *   mascot     the ichthys, which keeps its glow in the dark
 *   veil       a quick cross-fade used instead of pans when motion is reduced
 *
 * API: init(el, markers), go({depth, view, ms, settle}) -> Promise,
 * setDepth(m, animate), setMascot(tier), burst(x, y, n), onFrame(fn),
 * metres(), fishPoint(), zoneName(m), fmt(n).
 *
 * Views: 'home' puts the waterline 60% of the way down the screen with the
 * fish waiting just under it; 'play' looks down from just below the surface.
 */
(function () {
  'use strict';

  var SKY = 900;              // px of sky above the waterline
  var MAX_M = 7000;
  var FLOOR = 520;            // px of sea floor below 7,000 m
  var HOME_DEPTH = 70;        // the fish hangs this far under the waterline at 0 m
  var ZERO = SKY + HOME_DEPTH; // world y of 0 m on the gauge
  var WORLD_H = ZERO + MAX_M + FLOOR;
  var PLAY_AT = 0.26;         // in play the fish sits this far down the screen
  var HOME_WATER = 0.60;      // on the home screen the waterline sits this far down

  var ZONES = [[0, 'Sunlit shallows']];
  var el, layers = {}, markers = [];
  var shown = 0, view = 'home', frac = 0.6, tween = null, H = 800, W = 400, frameFn = null, veilTimer = 0;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function zoneName(m) {
    var name = ZONES[0][1];
    ZONES.forEach(function (z) { if (m >= z[0]) name = z[1]; });
    return name;
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  // ---------- water color by depth ------------------------------------------
  // sunrise teal -> deep blue -> indigo -> near-black
  var STOPS = [
    [0, [74, 168, 178]], [250, [44, 128, 166]], [800, [28, 92, 148]], [1800, [27, 58, 118]],
    [3200, [22, 32, 86]], [5000, [12, 16, 52]], [7000, [4, 6, 18]], [8000, [3, 4, 12]]
  ];
  function colorAt(m) {
    for (var i = 1; i < STOPS.length; i++) {
      if (m <= STOPS[i][0]) {
        var a = STOPS[i - 1], b = STOPS[i], t = (m - a[0]) / (b[0] - a[0]);
        return 'rgb(' + a[1].map(function (c, j) { return Math.round(c + (b[1][j] - c) * t); }).join(',') + ')';
      }
    }
    return 'rgb(3,4,12)';
  }

  // ---------- art ---------------------------------------------------------
  var BOAT =
    '<svg class="boat" viewBox="0 0 150 100" width="150" height="100" aria-hidden="true">' +
      '<path d="M40 30L75 8l35 22M75 8L22 66M75 8l55 58" stroke="#5a4128" stroke-width="1" opacity=".55" fill="none"/>' +
      '<path d="M75 6v62" stroke="#5a3b1f" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M58 22h34" stroke="#6b4a2a" stroke-width="3" stroke-linecap="round" opacity=".7"/>' +
      '<path d="M60 25c8 4 22 4 30 0" stroke="#efe2c4" stroke-width="4" stroke-linecap="round" fill="none" opacity=".9"/>' +
      '<circle cx="104" cy="60" r="5" fill="#3a2a1c"/><path d="M98 64h13v7H98z" fill="#3a2a1c"/>' +
      '<path d="M108 63l14 6" stroke="#3a2a1c" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M8 66h134c-6 18-19 27-36 27H44C27 93 15 84 8 66z" fill="#7b4b25"/>' +
      '<path d="M8 66h134l-3 8H11z" fill="#9b6634"/>' +
      '<path d="M20 79h110M30 86h90" stroke="#5a3b1f" stroke-width="1.6" opacity=".55"/>' +
      '<path d="M2 66c4-3 7-6 6-12M148 66c-4-3-7-6-6-12" stroke="#7b4b25" stroke-width="4" stroke-linecap="round" fill="none"/>' +
    '</svg>';

  var HILLS =
    '<svg class="hills" viewBox="0 0 400 70" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="M0 42C40 26 70 32 100 36s60-20 100-17 70 22 110 17 60-14 90-9v43H0z" fill="#9b8296" opacity=".5"/>' +
      '<path d="M0 54c50-14 90-9 130-3s80-14 130-11 90 14 140 6v24H0z" fill="#806c84" opacity=".72"/>' +
    '</svg>';

  function cloud(x, y, s, o) {
    return '<svg class="cloud" style="left:' + x + '%;bottom:' + y + 'px;width:' + (120 * s) + 'px;opacity:' + o + '" viewBox="0 0 120 40" aria-hidden="true">' +
      '<path d="M10 34c-8 0-10-10-2-12 0-8 10-12 17-7 4-9 18-10 23-1 6-6 18-3 18 6 9-2 15 6 10 12z" fill="#fff4e6"/>' +
      '<path d="M18 34c8-3 22-3 34-1s26 2 40 0" stroke="#f3c9a8" stroke-width="3" fill="none" opacity=".6"/></svg>';
  }

  function kelpSvg(h, tint, flip) {
    var w = 40 + Math.round(h / 8);
    return '<svg viewBox="0 0 60 ' + h + '" width="' + w + '" height="' + h + '" preserveAspectRatio="none" aria-hidden="true"' +
      (flip ? ' style="transform:scaleX(-1)"' : '') + '>' +
      '<path d="M30 ' + h + 'C26 ' + (h * .7) + ' 36 ' + (h * .5) + ' 30 ' + (h * .3) + 'S26 ' + (h * .08) + ' 32 0" stroke="' + tint + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M30 ' + (h * .62) + 'q-14 -8 -20 -24M31 ' + (h * .42) + 'q14 -8 18 -22M29 ' + (h * .22) + 'q-12 -6 -14 -18" stroke="' + tint + '" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M44 ' + h + 'C42 ' + (h * .8) + ' 50 ' + (h * .66) + ' 46 ' + (h * .5) + '" stroke="' + tint + '" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>' +
      '</svg>';
  }

  function rockSvg(w, h, tint, flip) {
    return '<svg viewBox="0 0 100 60" width="' + w + '" height="' + h + '" preserveAspectRatio="none" aria-hidden="true"' + (flip ? ' style="transform:scaleX(-1)"' : '') + '>' +
      '<path d="M0 60V18C8 6 22 2 34 10s20-2 30 4 18 4 24 14 12 12 12 14v10z" fill="' + tint + '"/>' +
      '<path d="M8 60C10 40 14 30 12 14M22 60c2-16 6-26 2-40" stroke="' + tint + '" stroke-width="4" fill="none" stroke-linecap="round"/></svg>';
  }

  function fishShape(color) {
    return '<svg viewBox="0 0 30 14" aria-hidden="true"><path d="M2 7C7 1 17 1 22 7 17 13 7 13 2 7z" fill="' + color + '"/><path d="M21 7l8-5v10z" fill="' + color + '"/></svg>';
  }

  // ---------- building -------------------------------------------------
  function buildWorld(rand) {
    var html = '';
    // Sky: dawn over Galilee, with a faint painted-paper grain.
    html += '<div class="sky" style="height:' + SKY + 'px">' +
      '<div class="sun"></div>' + cloud(6, 300, 1, .8) + cloud(58, 360, 1.3, .65) + cloud(76, 230, .8, .6) +
      cloud(-4, 520, 1.5, .4) + cloud(40, 600, .9, .35) + cloud(30, 160, .7, .5) + HILLS + '<div class="grain"></div></div>';
    html += '<div class="waterline" style="top:' + (SKY - 7) + 'px"></div>';
    html += '<div class="glitter" style="top:' + SKY + 'px"></div>';
    html += '<div class="boat-wrap" style="top:' + (SKY - 86) + 'px">' + BOAT + '</div>';

    // Depth gauge on the right edge: a tick every 100 m, labelled.
    var g = '<div class="gauge" style="top:' + ZERO + 'px;height:' + MAX_M + 'px">';
    for (var m = 100; m <= MAX_M; m += 100) {
      g += '<div class="tick' + (m % 500 === 0 ? ' major' : '') + '" style="top:' + m + 'px"><span>-' + m + 'm</span></div>';
    }
    html += g + '</div>';

    // Zones and their verses, floating at fixed depths.
    markers.forEach(function (z) {
      if (z.egg) return;
      var y = ZERO + z.depth + (z.depth === 0 ? 30 : 0);
      if (z.depth >= MAX_M) y = ZERO + MAX_M - 10;
      html += '<div class="zone" style="top:' + y + 'px"><span class="rule"></span>' +
        '<span class="zone-name">' + z.name + '</span>' +
        (z.ref ? '<span class="zone-ref">' + z.ref + '</span>' : '') +
        (z.sub ? '<span class="zone-sub">' + z.sub + '</span>' : '') + '</div>';
    });

    // Bioluminescent specks, only below 1,000 m, growing denser with depth.
    var sp = [];
    for (var i = 0; i < 260; i++) {
      var d = 1000 + Math.pow(rand(), 0.7) * (MAX_M - 1000);
      sp.push((rand() * 100).toFixed(1) + 'vw ' + (ZERO + d).toFixed(0) + 'px 0 ' + (rand() < 0.25 ? '1.5px' : '0') +
        ' rgba(' + (rand() < 0.5 ? '150,245,225' : '200,220,255') + ',' + (0.3 + rand() * 0.55).toFixed(2) + ')');
    }
    html += '<div class="specks" style="box-shadow:' + sp.join(',') + '"></div>';

    // The 153 (John 21:11): one school of exactly 153 small fish, at 1,530 m.
    var egg = markers.filter(function (z) { return z.egg; })[0];
    if (egg) {
      var school = '';
      for (var f = 0; f < 153; f++) {
        var row = Math.floor(f / 17), col = f % 17;
        var x = col * 12 + (row % 2 ? 6 : 0) + (rand() - .5) * 5, y2 = row * 8 + (rand() - .5) * 4;
        school += '<i style="left:' + x.toFixed(1) + 'px;top:' + y2.toFixed(1) + 'px"></i>';
      }
      html += '<div class="egg" style="top:' + (ZERO + egg.depth - 36) + 'px">' +
        '<div class="egg-school" title="153">' + school + '</div>' +
        '<div class="zone egg-note"><span class="rule"></span><span class="zone-name">153</span><span class="zone-ref">' + egg.ref + '</span></div></div>';
    }

    html += '<div class="seabed" style="top:' + (ZERO + MAX_M) + 'px;height:' + FLOOR + 'px"></div>';
    return html;
  }

  function buildKelp(rand) {
    var html = '';
    for (var y = 120; y < MAX_M * 0.85 + 600; y += 140 + rand() * 260) {
      var deep = y / 0.85;
      var tint = deep < 800 ? 'rgba(20,70,70,.55)' : deep < 3000 ? 'rgba(10,30,60,.55)' : 'rgba(6,12,32,.6)';
      var h = 120 + rand() * 180, left = rand() < 0.5;
      html += '<div class="kelp" style="top:' + (ZERO * 0.85 + y).toFixed(0) + 'px;' + (left ? 'left:' : 'right:') + (-8 + rand() * 22).toFixed(0) +
        'px;animation-delay:' + (-rand() * 7).toFixed(2) + 's;animation-duration:' + (5 + rand() * 4).toFixed(1) + 's">' + kelpSvg(h, tint, !left) + '</div>';
    }
    return html;
  }

  function buildFront(rand) {
    var html = '';
    for (var y = 300; y < MAX_M * 1.2 + 900; y += 600 + rand() * 700) {
      var deep = y / 1.2, left = rand() < 0.5;
      var tint = deep < 1000 ? '#0f3a44' : deep < 3500 ? '#0a1a33' : '#05091a';
      var w = 70 + rand() * 60, h = 50 + rand() * 50;
      html += '<div class="front-piece" style="top:' + (ZERO * 1.2 + y).toFixed(0) + 'px;' + (left ? 'left:-14px' : 'right:-14px') + '">' +
        rockSvg(w, h, tint, !left) +
        (rand() < 0.7 ? '<div class="front-grass" style="animation-delay:' + (-rand() * 5).toFixed(2) + 's">' + kelpSvg(70 + rand() * 60, tint, left) + '</div>' : '') +
        '</div>';
    }
    return html;
  }

  // The ichthys: drawn as a filled outline so it can take each tier's color.
  var MASCOT =
    '<div class="mascot" data-tier="0">' +
      '<span class="radiance"></span><span class="halo"></span>' +
      '<svg class="ichthys-svg" viewBox="0 0 64 36" aria-hidden="true">' +
        '<path class="body" d="M4 18Q30-6 60 28Q30 42 4 18z" />' +
        '<path class="line" d="M4 18Q30-6 60 28M4 18Q30 42 60 8" />' +
      '</svg>' +
    '</div>';

  function init(container, list) {
    el = container;
    markers = (list || []).slice().sort(function (a, b) { return a.depth - b.depth; });
    ZONES = markers.filter(function (z) { return !z.egg; }).map(function (z) { return [z.depth, z.name]; });
    if (!markers.length) ZONES = [[0, 'Sunlit shallows']];
    var rand = (window.FSHDaily ? window.FSHDaily.rng('world-v3') : Math.random);
    el.innerHTML =
      '<div class="layer water"></div>' +
      '<div class="layer rays"><i></i><i></i><i></i><i></i></div>' +
      '<div class="layer kelp-layer">' + buildKelp(rand) + '</div>' +
      '<div class="layer world" style="height:' + WORLD_H + 'px">' + buildWorld(rand) + '<div class="marks"></div></div>' +
      '<div class="layer ambient"></div>' +
      '<div class="layer front">' + buildFront(rand) + '</div>' +
      '<div class="layer dim"></div>' +
      '<svg class="layer line" aria-hidden="true"><path class="rope-shadow"/><path class="rope"/></svg>' +
      '<div class="you-mark" aria-hidden="true">YOU</div>' +
      MASCOT +
      '<div class="layer veil"></div>';
    ['water', 'rays', 'kelp-layer', 'world', 'ambient', 'front', 'dim', 'line', 'veil', 'marks'].forEach(function (k) { layers[k] = el.querySelector('.' + k); });
    layers.rope = el.querySelector('.rope');
    layers.ropeShadow = el.querySelector('.rope-shadow');
    layers.mascot = el.querySelector('.mascot');
    layers.you = el.querySelector('.you-mark');
    measure();
    window.addEventListener('resize', function () { measure(); if (!tween) frac = fracFor(view); render(); });
    shown = 0; frac = fracFor('home');
    requestAnimationFrame(loop);
    startAmbient();
  }

  // The verse zones and the 153 come with the prompt bank, which loads after
  // the first paint; the world is redrawn with them when it arrives.
  function setMarkers(list) {
    markers = (list || []).slice().sort(function (a, b) { return a.depth - b.depth; });
    ZONES = markers.filter(function (z) { return !z.egg; }).map(function (z) { return [z.depth, z.name]; });
    if (!markers.length) ZONES = [[0, 'Sunlit shallows']];
    var rand = (window.FSHDaily ? window.FSHDaily.rng('world-v3') : Math.random);
    layers.world.innerHTML = buildWorld(rand) + '<div class="marks"></div>';
    layers.marks = layers.world.querySelector('.marks');
  }

  function measure() { H = el.clientHeight || window.innerHeight; W = el.clientWidth || window.innerWidth; }

  // ---------- the camera -----------------------------------------------
  // The fish is `shown` metres down; it sits `frac` of the way down the screen.
  function fracFor(v) { return v === 'home' ? (H * HOME_WATER + HOME_DEPTH) / H : PLAY_AT; }

  // Near the surface in play, the fish rides higher so the waterline sits
  // up behind the score panel and the sun and hills scroll off the top. The
  // lift fades out over the first 400 m, and blends in during the pan down.
  var SHALLOW_WATER_Y = 40, LIFT_FADE_M = 400;
  function lift() {
    var fHome = fracFor('home');
    var playness = fHome > PLAY_AT ? clamp((fHome - frac) / (fHome - PLAY_AT), 0, 1) : 1;
    var full = Math.max(0, H * PLAY_AT - (HOME_DEPTH + SHALLOW_WATER_Y));
    return full * playness * clamp(1 - shown / LIFT_FADE_M, 0, 1);
  }
  function fishScreenY() { return H * frac - lift(); }
  function camTop() { return ZERO + shown - fishScreenY(); }

  function render(t) {
    var top = camTop();
    var topDepth = top - SKY, botDepth = top + H - SKY;
    layers.water.style.background = 'linear-gradient(' + colorAt(Math.max(0, topDepth)) + ',' + colorAt(Math.max(0, botDepth)) + ')';
    layers.world.style.transform = 'translate3d(0,' + (-top).toFixed(1) + 'px,0)';
    var kelpK = reduce ? 1 : 0.85, frontK = reduce ? 1 : 1.2;   // no parallax when motion is reduced
    layers['kelp-layer'].style.transform = 'translate3d(0,' + (-top * kelpK).toFixed(1) + 'px,0)';
    layers.front.style.transform = 'translate3d(0,' + (-top * frontK).toFixed(1) + 'px,0)';

    // Light shafts start at the waterline and fade out by ~800 m.
    var waterY = SKY - top;
    layers.rays.style.transform = 'translate3d(0,' + Math.max(0, waterY).toFixed(1) + 'px,0)';
    layers.rays.style.opacity = clamp(1 - shown / 800, 0, 1).toFixed(3);

    // Darkness gathers below 3,000 m; only the fish keeps its glow.
    layers.dim.style.opacity = clamp((shown - 3000) / 3500, 0, 0.62).toFixed(3);

    // The fish, the YOU marker, and the rope.
    var fishY = fishScreenY(), fishX = W / 2;
    layers.mascot.style.transform = 'translate3d(' + (fishX - 32).toFixed(1) + 'px,' + (fishY - 18).toFixed(1) + 'px,0)';
    layers.you.style.transform = 'translate3d(0,' + (fishY - 9).toFixed(1) + 'px,0)';
    var boatX = W / 2 + 22, boatY = SKY - top - 18;
    var sway = Math.sin((t || 0) / 1400) * Math.min(26, 6 + (fishY - boatY) * 0.02);
    var midY = (boatY + fishY) / 2;
    var d = 'M' + boatX.toFixed(1) + ' ' + boatY.toFixed(1) + ' Q ' + (boatX - 20 + sway).toFixed(1) + ' ' + midY.toFixed(1) + ' ' + (fishX + 22).toFixed(1) + ' ' + (fishY - 4).toFixed(1);
    layers.rope.setAttribute('d', d);
    layers.ropeShadow.setAttribute('d', d);
    if (frameFn) frameFn(Math.max(0, shown), fishY);
  }

  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

  function loop(t) {
    if (tween) {
      if (!tween.start) tween.start = t;
      var k = clamp((t - tween.start) / tween.dur, 0, 1), e = tween.ease(k);
      shown = tween.from + (tween.to - tween.from) * e;
      frac = tween.f0 + (tween.f1 - tween.f0) * e;
      if (k >= 1) { var fin = tween.done; shown = tween.to; frac = tween.f1; tween = null; if (fin) fin(); }
    }
    render(t);
    requestAnimationFrame(loop);
  }

  // How long a sink takes: about 1.2 s for 100 m, up to about 4 s for 1,000 m.
  function sinkMs(dist) { return clamp(1200 + (dist - 100) * 3.1, 900, 4200); }

  // Move the camera. opts: depth (metres), view ('home' | 'play'), ms, settle
  // (true = fast start, gentle settle, for a sink). Resolves when it arrives.
  function go(opts) {
    opts = opts || {};
    if (tween && tween.done) { var prev = tween.done; shown = tween.to; frac = tween.f1; tween = null; prev(); }
    var to = opts.depth == null ? shown : clamp(opts.depth, 0, MAX_M);
    view = opts.view || view;
    var f1 = fracFor(view);
    return new Promise(function (resolve) {
      var dist = Math.abs(to - shown) + Math.abs(f1 - frac) * H;
      if (dist < 1 || opts.ms === 0) { shown = to; frac = f1; resolve(); return; }
      if (reduce) {
        // A quick cross-fade instead of a pan.
        layers.veil.classList.add('on');
        clearTimeout(veilTimer);
        veilTimer = setTimeout(function () {
          shown = to; frac = f1;
          layers.veil.classList.remove('on');
          resolve();
        }, 160);
        return;
      }
      var ms = opts.ms || sinkMs(Math.abs(to - shown));
      tween = { from: shown, to: to, f0: frac, f1: f1, start: 0, dur: ms, ease: opts.settle ? easeOut : easeInOut, done: resolve };
    });
  }

  function setDepth(m, animate) { return go({ depth: m, ms: animate ? undefined : 0, settle: true }); }
  function metres() { return Math.max(0, shown); }
  function fishPoint() { return { x: W / 2, y: fishScreenY() }; }

  // The fish takes the color of its last catch; the Lost Sheep turns it gold.
  function setMascot(tier) {
    if (layers.mascot) layers.mascot.setAttribute('data-tier', String(tier || 0));
  }

  // ---------- passing life ---------------------------------------------
  function startAmbient() {
    if (reduce) return;
    var rand = Math.random;
    function school() {
      var m = shown, n = 5 + Math.floor(rand() * 9), deep = m > 3000;
      var color = m < 600 ? 'rgba(240,236,220,.75)' : m < 2000 ? 'rgba(150,200,220,.6)' : deep ? 'rgba(120,240,220,.55)' : 'rgba(110,150,210,.55)';
      var s = document.createElement('div');
      var ltr = rand() < 0.5, y = H * (0.08 + rand() * 0.55), dur = 9 + rand() * 9;
      s.className = 'school ' + (ltr ? 'ltr' : 'rtl') + (deep ? ' glow' : '');
      s.style.top = y.toFixed(0) + 'px';
      s.style.animationDuration = dur.toFixed(1) + 's';
      var inner = '';
      for (var i = 0; i < n; i++) {
        inner += '<span style="left:' + (i * 16 + rand() * 10).toFixed(0) + 'px;top:' + ((rand() - .5) * 26).toFixed(0) + 'px;width:' + (12 + rand() * 8).toFixed(0) + 'px;animation-delay:' + (-rand()).toFixed(2) + 's">' + fishShape(color) + '</span>';
      }
      s.innerHTML = inner;
      layers.ambient.appendChild(s);
      setTimeout(function () { s.remove(); }, dur * 1000 + 200);
      setTimeout(school, (deep ? 9000 : 4000) + rand() * 6000);
    }
    function bubble() {
      var b = document.createElement('i');
      var fromFish = rand() < 0.6;
      b.className = 'bubble';
      var size = 3 + rand() * 6;
      b.style.width = b.style.height = size.toFixed(1) + 'px';
      b.style.left = (fromFish ? W / 2 - 18 + rand() * 30 : rand() * W).toFixed(0) + 'px';
      b.style.top = (fromFish ? fishScreenY() - 10 : H * (0.4 + rand() * 0.6)).toFixed(0) + 'px';
      b.style.animationDuration = (3 + rand() * 3).toFixed(1) + 's';
      layers.ambient.appendChild(b);
      setTimeout(function () { b.remove(); }, 6500);
      setTimeout(bubble, 500 + rand() * 1100);
    }
    setTimeout(school, 1200);
    bubble();
  }

  // A small burst of bubbles from a point on the screen (each submit).
  function burst(x, y, n, spread) {
    spread = spread == null ? 90 : spread;
    if (reduce || !layers.ambient) return;
    for (var i = 0; i < (n || 8); i++) {
      var b = document.createElement('i');
      var size = 3 + Math.random() * 7;
      b.className = 'bubble quick';
      b.style.width = b.style.height = size.toFixed(1) + 'px';
      b.style.left = (x + (Math.random() - .5) * spread).toFixed(0) + 'px';
      b.style.top = (y - Math.random() * 12).toFixed(0) + 'px';
      b.style.animationDelay = (Math.random() * 0.25).toFixed(2) + 's';
      b.style.animationDuration = (1.4 + Math.random() * 1.2).toFixed(1) + 's';
      layers.ambient.appendChild(b);
      setTimeout(function (node) { node.remove(); }.bind(null, b), 3200);
    }
  }

  // A few small fish dart out of the sinking net's path.
  function scatter(x, y) {
    if (reduce || !layers.ambient) return;
    for (var i = 0; i < 6; i++) {
      var f = document.createElement('div'), right = i % 2 === 0;
      f.className = 'scatter' + (right ? ' right' : '');
      f.style.left = (x - 7 + (Math.random() - .5) * 40).toFixed(0) + 'px';
      f.style.top = (y + 70 + Math.random() * 110).toFixed(0) + 'px';
      f.style.setProperty('--dx', ((right ? 1 : -1) * (90 + Math.random() * 120)).toFixed(0) + 'px');
      f.style.setProperty('--dy', ((Math.random() - .6) * 70).toFixed(0) + 'px');
      f.style.animationDelay = (Math.random() * 0.25).toFixed(2) + 's';
      f.innerHTML = fishShape('rgba(226, 238, 242, .8)');
      layers.ambient.appendChild(f);
      setTimeout(function (node) { node.remove(); }.bind(null, f), 1700);
    }
  }

  window.FSHScene = {
    scatter: scatter, sinkMs: sinkMs, reduced: reduce,
    init: init, setMarkers: setMarkers, go: go, setDepth: setDepth, setMascot: setMascot, burst: burst,
    onFrame: function (fn) { frameFn = fn; }, metres: metres, fishPoint: fishPoint,
    zoneName: zoneName, fmt: fmt, ZERO: ZERO, MAX_M: MAX_M, layer: function (k) { return layers[k]; }
  };
})();
