/* Live Coal load test: many rooms of 16 simulated players at once.
 *
 *   node load.js                                   10 rooms x 16 players, 75 s, local wrangler dev
 *   node load.js --server https://<worker>.workers.dev --rooms 10 --players 16 --secs 75
 *
 * Each bot joins a private room; the first one starts the game. When a bot
 * gets the coal it types its answer a letter at a time (live typing, at most
 * 8 a second) and then submits a fresh answer, or (1 in 6) lets its coal go
 * out. Reports, per room and overall:
 *   - messages sent to the server (what Cloudflare bills) and received
 *   - server-side handoff time (answer received -> next turn sent), from the
 *     room's /metrics/<CODE> numbers
 *   - client-side handoff time (submit -> next turnStarted, includes the network)
 */
'use strict';
const WebSocket = require('ws');
const M = require('../../js/matcher.js');
const bank = require('../../data/prompts.json');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i === -1 ? d : argv[i + 1]; };
const SERVER = String(arg('server', 'http://127.0.0.1:8787')).replace(/\/$/, '');
const ROOMS = Number(arg('rooms', 10)), PLAYERS = Number(arg('players', 16)), SECS = Number(arg('secs', 75));
const ORIGIN = arg('origin', 'http://localhost');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const compiled = {};
const comp = (id) => compiled[id] || (compiled[id] = M.compile(bank.prompts.find(p => p.id === id)));

function pct(arr, f) { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; }

async function createRoom() {
  const r = await fetch(SERVER + '/create', { method: 'POST', headers: { Origin: ORIGIN } });
  if (!r.ok) throw new Error('create ' + r.status);
  return (await r.json()).code;
}

function bot(code, n, stats) {
  return new Promise((resolve) => {
    const ws = new WebSocket(SERVER.replace(/^http/, 'ws') + '/room/' + code, { headers: { Origin: ORIGIN } });
    const me = { ws, id: null, prompt: null, said: [], holder: null, submitAt: 0, closed: false };
    const send = (o) => { if (ws.readyState === 1) { ws.send(JSON.stringify({ v: 1, ...o })); stats.sent++; if (o.type === 'typing') stats.typing++; } };
    me.send = send;
    ws.on('open', () => send({ type: 'join', token: ('loadtest' + code + 'p' + n + 'xxxxxxxxxxxxxxxx').slice(0, 32), name: 'Bot ' + n, color: 'sea' }));
    ws.on('message', async (raw) => {
      stats.recv++;
      const m = JSON.parse(raw);
      if (m.type === 'snapshot') { me.id = m.you; resolve(me); }
      if (m.type === 'roundStarted') { me.prompt = m.prompt.id; me.said = []; }
      if (m.type === 'answerAccepted') me.said.push(m.answer);
      if (n === 0 && m.type === 'gameOver') stats.games++;
      if (n === 0 && m.type === 'eliminated') stats.outs++;
      if (m.type === 'turnStarted') {
        if (me.submitAt) { stats.clientHandoff.push(Date.now() - me.submitAt); me.submitAt = 0; }
        if (m.playerId !== me.id) return;
        // My turn.
        const turn = m.deadline;
        if (Math.random() < 1 / 6) return;                          // let the coal go out
        const c = comp(me.prompt), p = c.prompt;
        const fresh = p.answers.find((a, i) => !me.said.includes(a.name) && M.evaluate(a.name, c).index === i);
        if (!fresh) return;
        await sleep(300 + Math.random() * 900);
        for (let k = 1; k <= Math.min(fresh.name.length, 6); k++) { send({ type: 'typing', text: fresh.name.slice(0, k) }); await sleep(130); }
        if (Math.random() < 0.15) { send({ type: 'submit', text: 'zzqqxx' }); await sleep(150); }   // a miss first
        me.submitAt = Date.now();
        send({ type: 'submit', text: fresh.name });
      }
    });
    ws.on('close', () => { me.closed = true; });
    ws.on('error', (e) => { stats.errors++; resolve(me); });
  });
}

async function room(i, all) {
  const stats = { code: null, sent: 0, typing: 0, recv: 0, games: 0, outs: 0, errors: 0, clientHandoff: [] };
  all.push(stats);
  stats.code = await createRoom();
  const bots = [];
  for (let n = 0; n < PLAYERS; n++) bots.push(await bot(stats.code, n, stats));
  const host = bots[0];
  const t0 = Date.now();
  host.send({ type: 'start' });
  // Rematch whenever a game ends, until time is up.
  const timer = setInterval(() => host.send({ type: 'rematch' }), 2500);
  await sleep(SECS * 1000);
  clearInterval(timer);
  stats.secs = (Date.now() - t0) / 1000;
  const met = await (await fetch(SERVER + '/metrics/' + stats.code)).json().catch(() => null);
  stats.server = met;
  bots.forEach(b => { try { b.ws.close(); } catch (e) { /* */ } });
  return stats;
}

(async () => {
  console.log('Live Coal load: ' + ROOMS + ' rooms x ' + PLAYERS + ' players for ' + SECS + ' s against ' + SERVER);
  const all = [];
  await Promise.all(Array.from({ length: ROOMS }, (_, i) => room(i, all)));
  let sent = 0, recv = 0, typing = 0, games = 0, outs = 0, errors = 0, ch = [], sh95 = [], shMax = [], shCount = 0;
  for (const s of all) {
    sent += s.sent; recv += s.recv; typing += s.typing; games += s.games; outs += s.outs; errors += s.errors; ch = ch.concat(s.clientHandoff);
    if (s.server && s.server.handoffs.count) { sh95.push(s.server.handoffs.p95); shMax.push(s.server.handoffs.max); shCount += s.server.handoffs.count; }
    console.log('  room ' + s.code + ': sent ' + s.sent + ' (' + (s.sent / s.secs).toFixed(1) + '/s, typing ' + s.typing + '), received ' + s.recv +
      ', eliminations ' + s.outs + ', games ' + s.games + (s.server ? ', server handoff p50 ' + s.server.handoffs.p50 + ' ms p95 ' + s.server.handoffs.p95 + ' ms max ' + s.server.handoffs.max + ' ms (' + s.server.handoffs.count + ')' : ''));
  }
  const secs = all[0].secs;
  console.log('\nTotal: ' + sent + ' messages to the server (' + (sent / secs).toFixed(1) + '/s; ' + typing + ' typing), ' + recv + ' delivered to clients, ' + errors + ' socket errors');
  console.log('Per room per minute: ' + (sent / ROOMS / secs * 60).toFixed(0) + ' messages in, ' + (recv / ROOMS / secs * 60).toFixed(0) + ' out');
  console.log('Server handoff (answer in -> next turn out): ' + shCount + ' handoffs, worst room p95 ' + Math.max(...sh95) + ' ms, max ' + Math.max(...shMax) + ' ms');
  console.log('Client handoff (submit -> next turn, includes network): p50 ' + pct(ch, 0.5) + ' ms, p95 ' + pct(ch, 0.95) + ' ms');
  const ok = shMax.length && Math.max(...sh95) < 150 && errors === 0;
  console.log(ok ? '\nPASS: handoff under 150 ms on the server' : '\nCHECK: see numbers above');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
