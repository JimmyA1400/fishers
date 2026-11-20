/* Live Coal end-to-end: four players (2 desktop, 2 phone-emulated) in one
 * private room play a full game to a winner, then a rematch.
 *
 * Covered on the way: live typing reaching the others, a duplicate answer
 * ("Already said by"), a typo and its did-you-mean confirm, a phone that
 * disconnects and comes back to the same seat mid-game, timeouts and
 * eliminations, the winner screen, and the rematch.
 *
 *   node e2e.js                                  local: site on :8765, wrangler dev on :8787
 *   node e2e.js --site https://jimmya1400.github.io/fishers/
 *   node e2e.js --rtt 300                        one phone behind a 300 ms round-trip proxy
 *   node e2e.js --server http://127.0.0.1:8787   override the Worker URL (?coal=)
 *
 * Screenshots and the host's video go to tests/coal/results/ (gitignored).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium, devices } = require('playwright');
const { WebSocketServer, WebSocket } = require('ws');
const M = require('../../js/matcher.js');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i === -1 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const SITE = String(arg('site', 'http://localhost:8765/')).replace(/\/?$/, '/');
const SERVER = arg('server', null);
const RTT = Number(arg('rtt', 0));
const HEADED = !!arg('headed', false);
const OUT = path.join(__dirname, 'results', arg('tag', RTT ? 'rtt' + RTT : 'run'));
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let failures = 0;
function check(ok, what) {
  console.log((ok ? '  ok   ' : '  FAIL ') + what);
  if (!ok) failures++;
}
async function until(fn, ms = 20000, every = 100, what = 'condition') {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out: ' + what);
    await sleep(every);
  }
}

// ---------------------------------------------------------------- a 300 ms RTT proxy
async function latencyProxy(target, oneWay) {
  const srv = http.createServer((req, res) => { res.writeHead(404); res.end(); });
  const wss = new WebSocketServer({ server: srv });
  wss.on('connection', (client, req) => {
    const up = new WebSocket(target.replace(/^http/, 'ws') + req.url, { headers: { Origin: req.headers.origin } });
    const q = [];
    up.on('open', () => { q.splice(0).forEach(m => up.send(m)); });
    client.on('message', (m) => setTimeout(() => { const s = m.toString(); if (up.readyState === 1) up.send(s); else q.push(s); }, oneWay));
    up.on('message', (m) => setTimeout(() => { if (client.readyState === 1) client.send(m.toString()); }, oneWay));
    const end = (c) => { try { client.close(c && c >= 1000 && c < 5000 && c !== 1005 && c !== 1006 ? c : 1000); } catch (e) { /* */ } try { up.close(); } catch (e) { /* */ } };
    up.on('close', (c) => setTimeout(() => end(c), oneWay));
    client.on('close', () => setTimeout(() => { try { up.close(); } catch (e) { /* */ } }, oneWay));
    up.on('error', () => end(1011));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { url: 'http://127.0.0.1:' + srv.address().port, close: () => { wss.close(); srv.close(); } };
}

// ---------------------------------------------------------------- page helpers
async function state(page) {
  return page.evaluate(() => {
    const s = window.FSHCoal && window.FSHCoal.state();
    if (!s) return null;
    const r = s.room, g = r && r.game;
    return {
      view: s.view, me: s.me, code: s.code, offset: s.offset, rtt: s.rtt,
      phase: r && r.phase, hostId: r && r.hostId,
      players: r ? r.players.map(p => ({ id: p.id, name: p.name, connected: p.connected, out: p.out, inGame: p.inGame })) : [],
      game: g ? { round: g.round, stage: g.stage, holderId: g.holderId, promptId: g.prompt && g.prompt.id, said: g.said.map(x => x.answer), deadline: g.deadline, turnMs: g.turnMs, order: g.order } : null,
      last: r && r.last ? { winnerId: r.last.winnerId, rounds: r.last.rounds } : null,
      now: Date.now() + s.offset
    };
  });
}
// The slow player's proxy is plain ws:// on 127.0.0.1, which an https page
// may not open, so that one player loads the same build from SLOW_SITE
// (default: the local copy on :8765) and still plays on the live Worker.
const SLOW_SITE = String(arg('slow-site', /^https:/.test(SITE) ? 'http://localhost:8765/' : SITE)).replace(/\/?$/, '/');
function url(code, proxy) {
  const q = [];
  if (proxy || SERVER) q.push('coal=' + encodeURIComponent(proxy || SERVER));
  return (proxy ? SLOW_SITE : SITE) + (q.length ? '?' + q.join('&') : '') + '#/coal' + (code ? '/' + code : '');
}
async function sitDown(page, name) {
  await page.waitForSelector('#c-name', { timeout: 20000 });
  await page.fill('#c-name', name);
  await page.click('#c-setup button[type=submit]');
  await page.waitForSelector('#c-lobby-title, .coal-game', { timeout: 20000 });
}
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name + '.png') }); }

// ---------------------------------------------------------------- answers, from the same bank and matcher as the server
let bank = null;
const compiled = {};
function promptOf(id) { return bank.prompts.find(p => p.id === id); }
function comp(id) { return compiled[id] || (compiled[id] = M.compile(promptOf(id))); }
function freshAnswers(id, said) {
  const c = comp(id), p = promptOf(id);
  const usedIdx = new Set(said.map(s => { const r = M.evaluate(s, c); return r.index; }));
  return p.answers.filter((a, i) => {
    if (usedIdx.has(i)) return false;
    const r = M.evaluate(a.name, c);
    return r.type === 'accept' && r.index === i;
  }).map(a => a.name);
}
function typoOf(id, said) {
  const c = comp(id);
  for (const name of freshAnswers(id, said)) {
    if (!/^[A-Za-z]{7,}$/.test(name)) continue;
    const i = 3, t = name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2);
    const r = M.evaluate(t, c);
    if (r.type === 'suggest' && r.answer.name === name) return { typo: t, name };
  }
  return null;
}

// ---------------------------------------------------------------- the run
(async () => {
  console.log('Live Coal e2e: site ' + SITE + (SERVER ? ', server ' + SERVER : '') + (RTT ? ', one client at ' + RTT + ' ms RTT' : ''));
  bank = await (await fetch(SITE + 'data/prompts.json')).json();
  const browser = await chromium.launch({ headless: !HEADED });
  const target = SERVER || (/localhost|127\.0\.0\.1/.test(SITE) ? 'http://127.0.0.1:8787' : null);
  let proxy = null;
  if (RTT) {
    const live = target || await (async () => {
      const p = await browser.newPage(); await p.goto(SITE);
      const s = await p.evaluate(() => window.FSH_CONFIG.liveCoal.server); await p.close(); return s;
    })();
    proxy = await latencyProxy(live, RTT / 2);
  }

  const desk = { viewport: { width: 1280, height: 860 } };
  const cast = [
    { name: 'Hannah', opts: { ...desk, recordVideo: { dir: OUT, size: { width: 1280, height: 860 } } } },
    { name: 'Eli', opts: desk },
    { name: 'Ruth', opts: devices['Pixel 7'], slow: !!RTT },
    { name: 'Boaz', opts: { ...devices['iPhone 13'], defaultBrowserType: undefined } }
  ];
  for (const p of cast) {
    p.ctx = await browser.newContext(p.opts);
    // One player has sound on, so the Web Audio paths run too.
    if (p.name === 'Eli') await p.ctx.addInitScript(() => { try { localStorage.setItem('fishers.coal.sound', 'on'); } catch (e) { /* */ } });
    p.page = await p.ctx.newPage();
    p.page.on('pageerror', e => { console.log('  [' + p.name + ' page error] ' + e.message); failures++; });
  }
  const host = cast[0];

  // --- lobby: create a private room, everyone joins by link
  await host.page.goto(url(null));
  await sitDown(host.page, host.name);
  await host.page.click('.coal-more summary');
  await host.page.click('#c-create');
  await host.page.waitForURL(/#\/coal\/[A-Z]{4}$/, { timeout: 15000 });
  const code = /#\/coal\/([A-Z]{4})$/.exec(host.page.url())[1];
  check(/^[A-HJ-NP-Z]{4}$/.test(code), 'private room code ' + code + ' (4 letters, no I/O)');
  await host.page.waitForSelector('#c-lobby-title');
  for (const p of cast.slice(1)) {
    await p.page.goto(url(code, p.slow ? proxy.url : null));
    await sitDown(p.page, p.name);
  }
  await until(async () => (await state(host.page)).players.filter(p => p.connected).length === 4, 10000, 100, '4 in the lobby');
  check(true, '4 players in room ' + code);
  await shot(host.page, '01-lobby-host');
  await shot(cast[2].page, '01-lobby-phone');
  const ids = {};
  for (const p of cast) { p.id = (await state(p.page)).me; ids[p.id] = p; }
  check((await state(host.page)).hostId === host.id, 'room creator is host');

  // --- start
  await host.page.click('#c-start');
  await until(async () => (await state(cast[3].page)).view === 'game', 10000, 100, 'game view');
  await sleep(600);
  await shot(cast[3].page, '02-round-intro-phone');
  const holder = async () => {
    const s = await until(async () => { const x = await state(host.page); return x.game && x.game.stage === 'turn' && x.game.holderId ? x : null; }, 30000, 50, 'a holder');
    return { s, p: ids[s.game.holderId] };
  };

  // Timer sync: every client shows the same remaining time.
  async function syncSpread() {
    const vals = await Promise.all(cast.map(async p => {
      const s = await state(p.page);
      return s.game && s.game.deadline ? s.game.deadline - s.now : null;
    }));
    const v = vals.filter(x => x != null);
    return Math.max(...v) - Math.min(...v);
  }

  // Turn 1: type slowly; another player sees the live typing; then answer.
  let { s, p } = await holder();
  const ans1 = freshAnswers(s.game.promptId, s.game.said)[0];
  await p.page.click('#c-answer');
  await p.page.keyboard.type(ans1.slice(0, 3), { delay: 90 });
  const watcher = cast.find(c => c !== p);
  const seen = await until(async () => { const t = await watcher.page.textContent('#c-typing').catch(() => ''); return t === ans1.slice(0, 3) ? t : null; }, 5000, 50, 'live typing').catch(() => null);
  check(!!seen, 'live typing reached ' + watcher.name + ' ("' + ans1.slice(0, 3) + '")');
  await shot(watcher.page, '03-watching-live-typing');
  await shot(p.page, '03-holder-typing');
  const spread = await syncSpread();
  check(spread < (RTT ? 160 : 80), 'clocks agree across 4 clients (spread ' + Math.round(spread) + ' ms)');
  await p.page.fill('#c-answer', ans1);
  await p.page.press('#c-answer', 'Enter');
  await until(async () => (await state(host.page)).game.said.includes(ans1), 5000, 50, 'answer 1 accepted');
  check(true, p.name + ' answered "' + ans1 + '"; the coal passed');

  // Turn 2: a duplicate, then a fresh answer.
  ({ s, p } = await holder());
  await p.page.fill('#c-answer', ans1);
  await p.page.press('#c-answer', 'Enter');
  const dup = await until(async () => { const t = await p.page.textContent('#c-feedback'); return /Already said by/.test(t) ? t : null; }, 5000, 50, 'duplicate message').catch(() => null);
  check(!!dup, 'duplicate rejected: "' + (dup || '').trim() + '"');
  await shot(p.page, '04-duplicate');
  const ans2 = freshAnswers(s.game.promptId, (await state(host.page)).game.said)[0];
  await p.page.fill('#c-answer', ans2);
  await p.page.press('#c-answer', 'Enter');
  await until(async () => (await state(host.page)).game.said.includes(ans2), 5000, 50, 'answer 2');

  // Turn 3: a typo, did-you-mean, Enter again confirms.
  ({ s, p } = await holder());
  const ty = typoOf(s.game.promptId, s.game.said);
  if (ty) {
    await p.page.fill('#c-answer', ty.typo);
    await p.page.press('#c-answer', 'Enter');
    const dym = await until(async () => { const t = await p.page.textContent('#c-feedback'); return /Did you mean/.test(t) ? t : null; }, 5000, 50, 'did you mean').catch(() => null);
    check(!!dym, 'typo "' + ty.typo + '" → ' + (dym || '').trim());
    await shot(p.page, '05-did-you-mean');
    await p.page.press('#c-answer', 'Enter');
    const ok = await until(async () => (await state(host.page)).game.said.includes(ty.name), 5000, 50, 'typo confirmed').catch(() => null);
    check(!!ok, 'Enter confirmed "' + ty.name + '"');
  } else {
    check(false, 'no typo candidate in ' + s.game.promptId);
  }

  // Turn 4: a phone disconnects and comes back to the same seat mid-turn.
  ({ s, p } = await holder());
  const away = cast.find(c => c !== p && c !== host && c.opts !== desk) || cast.find(c => c !== p && c !== host);
  const awayId = away.id;
  await away.page.close();
  await until(async () => { const x = await state(host.page); const me = x.players.find(q => q.id === awayId); return me && !me.connected; }, 8000, 100, 'shown as away');
  check(true, away.name + ' disconnected; seat kept (shown as away)');
  away.page = await away.ctx.newPage();
  await away.page.goto(url(code, away.slow ? proxy.url : null));
  await until(async () => { const x = await state(away.page); return x && x.view === 'game' && x.me === awayId; }, 15000, 100, 'rejoined');
  const back = await state(away.page);
  check(back.me === awayId, away.name + ' reconnected to the same seat');
  const rem = back.game.deadline ? back.game.deadline - back.now : null;
  check(rem != null && rem > 0 && rem <= back.game.turnMs, 'reconnect snapshot has the live turn (' + (rem != null ? Math.round(rem) : '?') + ' ms left)');
  await shot(away.page, '06-reconnected');
  // That turn's holder answers.
  ({ s, p } = await holder());
  const ans4 = freshAnswers(s.game.promptId, s.game.said)[0];
  await p.page.fill('#c-answer', ans4);
  await p.page.press('#c-answer', 'Enter');
  await until(async () => (await state(host.page)).game.said.includes(ans4), 5000, 50, 'answer 4');

  // Latency fairness: the slow client answers with ~300 ms showing on its clock.
  if (RTT) {
    const slow = cast.find(c => c.slow);
    for (let i = 0; i < 8; i++) {
      ({ s, p } = await holder());
      if (p === slow) break;
      const a = freshAnswers(s.game.promptId, s.game.said)[0];
      await p.page.fill('#c-answer', a); await p.page.press('#c-answer', 'Enter');
      await until(async () => { const x = await state(host.page); return !x.game || x.game.holderId !== s.game.holderId; }, 5000, 30, 'pass');
    }
    ({ s, p } = await holder());
    if (p === slow) {
      const a = freshAnswers(s.game.promptId, s.game.said)[0];
      await p.page.fill('#c-answer', a);
      await until(async () => { const x = await state(p.page); return x.game.deadline - x.now <= 300 ? x : null; }, 20000, 10, 'last 300 ms');
      await p.page.press('#c-answer', 'Enter');
      const ok = await until(async () => (await state(host.page)).game && (await state(host.page)).game.said.includes(a), 3000, 30, 'late answer').catch(() => null);
      check(!!ok, 'at ' + RTT + ' ms RTT, an answer sent with 300 ms on the clock counts');
    } else check(false, 'the slow client never got the coal');
  }

  // --- timeouts until one is left
  let outs = 0;
  for (let k = 0; k < 6; k++) {
    const x = await state(host.page);
    if (x.phase !== 'game') break;
    ({ s, p } = await holder());
    const who = p.name;
    if (k === 0) { await sleep(Math.max(0, s.game.deadline - s.now - 2500)); await shot(p.page, '07-holder-low-time'); }
    await until(async () => { const y = await state(host.page); return !y.game || y.game.holderId !== s.game.holderId || y.game.stage !== 'turn'; }, 25000, 100, 'timeout');
    await sleep(200);
    const y = await state(host.page);
    const out = y.players.find(q => q.id === s.game.holderId);
    check(!out || out.out || y.phase !== 'game', who + '\'s coal went out (round ' + s.game.round + ', ' + (s.game.turnMs / 1000) + ' s turns)');
    outs++;
    if (k === 0) await shot(host.page, '08-elimination');
  }
  await until(async () => (await state(host.page)).view === 'over', 8000, 100, 'game over screen');
  const fin = await state(host.page);
  check(!!fin.last.winnerId, 'a winner: ' + (ids[fin.last.winnerId] || {}).name + ' after ' + fin.last.rounds + ' rounds');
  const title = await host.page.textContent('#c-over-title');
  check(/last one by the fire/.test(title), 'game over title: "' + title.trim() + '"');
  await shot(host.page, '09-game-over-host');
  await shot(cast[3].page, '09-game-over-phone');

  // --- rematch
  await host.page.click('#c-rematch');
  await until(async () => { const z = await state(cast[1].page); return z.phase === 'game' && z.game && z.game.order.length === 4; }, 10000, 100, 'rematch');
  check(true, 'rematch started with all 4');
  await sleep(1200);
  await shot(cast[1].page, '10-rematch');

  // --- a late joiner spectates the game in progress
  const lateCtx = await browser.newContext(devices['Pixel 7']);
  const late = await lateCtx.newPage();
  await late.goto(url(code));
  await sitDown(late, 'Late');
  const ls = await until(async () => { const z = await state(late); return z && z.view === 'game' ? z : null; }, 10000, 100, 'late joiner sees the game');
  const lateMe = ls.players.find(q => q.id === ls.me);
  check(lateMe && !lateMe.inGame && !ls.game.order.includes(ls.me), 'late joiner watches (not in this game)');
  check(/watching/i.test(await late.textContent('.coal-game')), 'late joiner is told they will join the next game');
  await shot(late, '11-late-joiner-watching');
  await lateCtx.close();

  for (const c of cast) await c.ctx.close();
  await browser.close();
  if (proxy) proxy.close();
  console.log(failures ? '\n' + failures + ' check(s) failed' : '\nAll checks passed. Media in ' + OUT);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
