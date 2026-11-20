/* Real Room Durable Objects in workerd: sockets, storage, alarms, hibernation. */
import { describe, it, expect } from 'vitest';
import { env, SELF, runInDurableObject, runDurableObjectAlarm, evictDurableObject } from 'cloudflare:test';

const ORIGIN = 'http://localhost:8080';

class Client {
  constructor(ws) {
    this.ws = ws;
    this.msgs = [];
    this.waiters = [];
    this.closed = null;
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      this.msgs.push(m);
      this.waiters = this.waiters.filter(w => (w.pred(m) ? (w.resolve(m), false) : true));
    });
    ws.addEventListener('close', (e) => { this.closed = { code: e.code, reason: e.reason }; this.waiters.forEach(w => w.closeCb && w.closeCb(e)); });
  }
  send(o) { this.ws.send(JSON.stringify({ v: 1, ...o })); }
  raw(s) { this.ws.send(s); }
  wait(type, pred = () => true, ms = 4000) {
    const is = (m) => (Array.isArray(type) ? type.includes(m.type) : m.type === type);
    const hit = this.msgs.find(m => is(m) && pred(m) && !m.__seen);
    if (hit) { hit.__seen = true; return Promise.resolve(hit); }
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timed out waiting for ' + type + '; got ' + this.msgs.map(m => m.type).join(','))), ms);
      this.waiters.push({ pred: (m) => is(m) && pred(m), resolve: (m) => { m.__seen = true; clearTimeout(t); resolve(m); } });
    });
  }
  waitClose(ms = 4000) {
    if (this.closed) return Promise.resolve(this.closed);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('no close')), ms);
      this.waiters.push({ pred: () => false, closeCb: (e) => { clearTimeout(t); resolve({ code: e.code, reason: e.reason }); } });
    });
  }
  last(type) { return this.msgs.filter(m => m.type === type).pop(); }
  close() { try { this.ws.close(1000, 'bye'); } catch (e) { /* ignore */ } }
}

async function connect(code, origin = ORIGIN) {
  const res = await SELF.fetch('http://live.test/room/' + code, { headers: { Upgrade: 'websocket', Origin: origin } });
  if (!res.webSocket) return { status: res.status };
  res.webSocket.accept();
  const c = new Client(res.webSocket);
  await c.wait(['hello', 'error'], () => true);
  c.msgs.forEach(m => { if (m.type === 'error') m.__seen = false; });
  return c;
}
async function createRoom() {
  const r = await SELF.fetch('http://live.test/create', { method: 'POST', headers: { Origin: ORIGIN } });
  expect(r.status).toBe(200);
  return (await r.json()).code;
}
const token = (n) => (n + '-tok-' + 'x'.repeat(20)).slice(0, 24);
const stubFor = (code) => env.ROOMS.get(env.ROOMS.idFromName(code));
// The room's clock is moved forward (kept in storage, so it survives eviction).
async function skew(code, ms) {
  await runInDurableObject(stubFor(code), async (room, st) => { await room.load(); room.skew += ms; await st.storage.put('testSkew', room.skew); });
}
async function state(code) { return runInDurableObject(stubFor(code), async (room) => { await room.load(); return room.s; }); }

async function table(names = ['Hannah', 'Eli']) {
  const code = await createRoom();
  const cs = {};
  for (const n of names) {
    cs[n] = await connect(code);
    cs[n].send({ type: 'join', token: token(n), name: n, color: 'gold' });
    await cs[n].wait('snapshot');
  }
  return { code, cs };
}
async function startGame(code, cs, host = 'Hannah') {
  cs[host].send({ type: 'start' });
  await cs[host].wait('roundStarted');
  await skew(code, 3000);
  expect(await runDurableObjectAlarm(stubFor(code))).toBe(true);
  return cs[host].wait('turnStarted');
}
function holderName(cs, ts) {
  const snapYou = Object.fromEntries(Object.entries(cs).map(([n, c]) => [c.msgs.find(m => m.type === 'snapshot').you, n]));
  return snapYou[ts.playerId];
}
async function answerFor(code) {
  return runInDurableObject(stubFor(code), async (room) => {
    await room.load();
    const g = room.s.game;
    const { prompts } = (await import('../../../data/prompts.json')).default;
    const p = prompts.find(x => x.id === g.prompt.id);
    const used = new Set(g.said.map(x => x.answer));
    return p.answers.find(a => !used.has(a.name) && a.name.length > 3).name;
  });
}

describe('worker routing', () => {
  it('health answers with the protocol version', async () => {
    const r = await SELF.fetch('http://live.test/health');
    expect(await r.json()).toMatchObject({ ok: true, protocol: 1 });
  });
  it('refuses other origins and bad codes', async () => {
    expect((await connect('SHORE', 'https://evil.example')).status).toBe(403);
    expect((await connect('AB1D')).status).toBe(404);
    expect((await connect('ABOD')).status).toBe(404);   // no O in codes
    const r = await SELF.fetch('http://live.test/create', { method: 'POST', headers: { Origin: 'https://evil.example' } });
    expect(r.status).toBe(403);
  });
  it('accepts the Pages origin and any localhost port', async () => {
    expect(await connect('SHORE', 'https://jimmya1400.github.io')).toBeInstanceOf(Client);
    expect(await connect('SHORE', 'http://localhost:5173')).toBeInstanceOf(Client);
    expect((await connect('SHORE', 'http://localhost.evil.example')).status).toBe(403);
  });
  it('create makes a 4-letter code without I or O; an unknown code says the room has closed', async () => {
    const code = await createRoom();
    expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    const c = await connect(code === 'ZZZZ' ? 'ZZZY' : 'ZZZZ');
    await c.wait('error', m => m.code === 'noRoom');
    expect((await c.waitClose()).code).toBe(4004);
  });
});

describe('room', () => {
  it('two players play a turn: snapshot, round intro, alarm-driven turn, accepted answer', async () => {
    const { code, cs } = await table();
    const ts = await startGame(code, cs);
    const h = holderName(cs, ts);
    const other = h === 'Hannah' ? 'Eli' : 'Hannah';
    // Live typing reaches the other player, not the typist.
    cs[h].send({ type: 'typing', text: 'Mo' });
    expect((await cs[other].wait('typing')).text).toBe('Mo');
    // A rejection goes only to the submitter.
    cs[h].send({ type: 'submit', text: 'qqqqzzzz' });
    expect((await cs[h].wait('answerRejected')).reason).toBe('miss');
    const ans = await answerFor(code);
    cs[h].send({ type: 'submit', text: ans });
    const acc = await cs[other].wait('answerAccepted');
    expect(acc.answer).toBe(ans);
    const next = await cs[other].wait('turnStarted', m => m.playerId !== ts.playerId);
    expect(holderName(cs, next)).toBe(other);
    expect(cs[other].msgs.some(m => m.type === 'answerRejected')).toBe(false);
  });

  it('hibernation: the room wakes mid-game with its state and sockets', async () => {
    const { code, cs } = await table();
    const ts = await startGame(code, cs);
    const h = holderName(cs, ts);
    await evictDurableObject(stubFor(code));            // memory gone, sockets hibernated
    await runInDurableObject(stubFor(code), (room) => { expect(room.loaded).toBe(false); });
    const ans = await answerFor(code);
    cs[h].send({ type: 'submit', text: ans });
    const acc = await cs[h].wait('answerAccepted');
    expect(acc.playerId).toBe(ts.playerId);
    const s = await state(code);
    expect(s.game.said.length).toBe(1);
    expect(s.game.holderId).not.toBe(ts.playerId);
  });

  it('alarm: a turn deadline eliminates the holder and the game ends with a winner', async () => {
    const { code, cs } = await table();
    const ts = await startGame(code, cs);
    await skew(code, 15000 + 300);
    expect(await runDurableObjectAlarm(stubFor(code))).toBe(true);
    const el = await cs.Hannah.wait('eliminated');
    expect(el.playerId).toBe(ts.playerId);
    expect(el.why).toBe('timeout');
    const over = await cs.Eli.wait('gameOver');
    expect(over.recap.winnerId).not.toBe(ts.playerId);
    expect((await state(code)).phase).toBe('lobby');
  });

  it('alarm after hibernation still resolves the timeout', async () => {
    const { code, cs } = await table(['Hannah', 'Eli', 'Ruth']);
    const ts = await startGame(code, cs);
    await evictDurableObject(stubFor(code));
    await skew(code, 15000 + 300);
    expect(await runDurableObjectAlarm(stubFor(code))).toBe(true);
    expect((await cs.Ruth.wait('eliminated')).playerId).toBe(ts.playerId);
    const s = await state(code);
    expect(s.game.stage).toBe('pause');
    // And the next alarm (end of the pause) is set.
    const at = await runInDurableObject(stubFor(code), (r, st) => st.storage.getAlarm());
    expect(at).toBe(s.game.stageEnds);
  });

  it('reconnect with the same token: full snapshot, same seat, the real remaining time', async () => {
    const { code, cs } = await table(['Hannah', 'Eli', 'Ruth']);
    const ts = await startGame(code, cs);
    const h = holderName(cs, ts);
    const before = cs[h].msgs.find(m => m.type === 'snapshot').you;
    cs[h].close();
    // The server notices the closed socket (a slow CI machine can take a few seconds).
    for (let i = 0; i < 150; i++) {
      const st = await state(code);
      if (st.players[before] && !st.players[before].connected) break;
      await new Promise(r => setTimeout(r, 100));
    }
    expect((await state(code)).players[before].connected).toBe(false);
    await skew(code, 4000);
    const again = await connect(code);
    again.send({ type: 'join', token: token(h), name: h });
    const snap = await again.wait('snapshot');
    expect(snap.you).toBe(before);
    expect(snap.game.holderId).toBe(before);
    const left = snap.game.deadline - snap.now;     // 15 s turn, 4 s skipped, plus a few real ms
    expect(left).toBeLessThanOrEqual(11000);
    expect(left).toBeGreaterThan(10000);
    expect(snap.players.find(p => p.id === before).connected).toBe(true);
  });

  it('two tabs with the same token: the newest wins, the older is told why', async () => {
    const { code, cs } = await table();
    const tab2 = await connect(code);
    tab2.send({ type: 'join', token: token('Eli'), name: 'Eli' });
    await tab2.wait('snapshot');
    expect((await cs.Eli.wait('error')).code).toBe('otherTab');
    expect((await cs.Eli.waitClose()).code).toBe(4001);
    // The player is still connected (through the new tab).
    const s = await state(code);
    expect(Object.values(s.players).find(p => p.name === 'Eli').connected).toBe(true);
  });

  it('host removes a player: they are closed with a reason and cannot rejoin', async () => {
    const { code, cs } = await table(['Hannah', 'Eli', 'Ruth']);
    const eli = cs.Eli.msgs.find(m => m.type === 'snapshot').you;
    cs.Hannah.send({ type: 'kick', target: eli });
    expect((await cs.Eli.wait('error')).code).toBe('removed');
    expect((await cs.Eli.waitClose()).code).toBe(4003);
    const back = await connect(code);
    back.send({ type: 'join', token: token('Eli'), name: 'Eli' });
    expect((await back.wait('error')).code).toBe('removed');
  });

  it('bad messages are dropped; flooding closes the socket', async () => {
    const { cs } = await table();
    cs.Hannah.raw('not json');
    cs.Hannah.raw(JSON.stringify({ v: 1, type: 'eliminate', target: 'x' }));
    cs.Hannah.raw(JSON.stringify({ v: 1, type: 'submit', text: 'x'.repeat(201) }));
    cs.Hannah.send({ type: 'ping', t: 1 });
    const pong = await cs.Hannah.wait('pong');
    expect(pong.t).toBe(1);
    expect(cs.Hannah.msgs.filter(m => m.type === 'error').length).toBe(0);
    for (let i = 0; i < 400; i++) cs.Eli.send({ type: 'setName', name: 'Eli' });
    expect((await cs.Eli.waitClose()).code).toBe(4008);
  });

  it('everyone leaves mid-game: the game ends and the room resets', async () => {
    const { code, cs } = await table();
    await startGame(code, cs);
    cs.Hannah.close(); cs.Eli.close();
    for (let i = 0; i < 50; i++) {
      const s = await state(code);
      if (s && s.phase === 'lobby') break;
      await new Promise(r => setTimeout(r, 20));
    }
    const s = await state(code);
    expect(s.phase).toBe('lobby');
    expect(s.game).toBe(null);
    expect(s.cleanupAt).toBeGreaterThan(0);
    // Ten minutes later the room's storage is deleted.
    await skew(code, 11 * 60000);
    await runDurableObjectAlarm(stubFor(code));
    expect(await state(code)).toBe(null);
    const stored = await runInDurableObject(stubFor(code), (r, st) => st.storage.get('state'));
    expect(stored).toBeUndefined();
  });
});
