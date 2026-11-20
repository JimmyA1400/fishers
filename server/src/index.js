/* Live Coal: the Worker and the Room Durable Object.
 *
 *   GET  /room/<CODE>   WebSocket upgrade into one room (The Shore is SHORE)
 *   POST /create        makes a private room; returns { code }
 *   GET  /health        { ok, protocol }
 *
 * One Room instance per code. The rules live in engine.js; this file only
 * moves messages, keeps storage and the alarm in step with the engine, and
 * enforces origin, size and rate limits.
 *
 * Hibernation: sockets are accepted with ctx.acceptWebSocket, so the object
 * can sleep between messages. Each socket carries { pid, cid } as its
 * attachment. After a wake-up the state is read back from storage; it is
 * written after every change, so nothing is lost.
 */
import { DurableObject } from 'cloudflare:workers';
import bank from '../../data/prompts.json';
import matcher from '../../js/matcher.js';
import { reduce, initialState, PROTOCOL, CLEANUP_MS } from './engine.js';
import { makeCatalog } from './catalog.js';
import { parseClient, makeLimiter, limit, MAX_RAW } from './protocol.js';
import { SHORE, CODE_LETTERS, validCode, originAllowed } from './rooms.js';

// Built (and every prompt compiled) once, at startup: the free plan allows
// 1 s of startup but little CPU per message, and answer checks then cost
// about 2 ms at worst.
const catalog = makeCatalog(bank, matcher);
for (const e of catalog.list) catalog.evaluate(e.id, '');
const getCatalog = () => catalog;

function cors(origin, env) {
  const h = { 'Vary': 'Origin', 'Content-Type': 'application/json' };
  if (originAllowed(origin, env.ALLOWED_ORIGINS)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return h;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const headers = cors(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(JSON.stringify({ ok: true, protocol: PROTOCOL, name: 'Fishers Live Coal' }), { headers });
    }

    if (url.pathname === '/create' && request.method === 'POST') {
      if (!originAllowed(origin, env.ALLOWED_ORIGINS)) return new Response('{"error":"origin"}', { status: 403, headers });
      for (let i = 0; i < 12; i++) {
        let code = '';
        const bytes = crypto.getRandomValues(new Uint8Array(4));
        for (const b of bytes) code += CODE_LETTERS[b % CODE_LETTERS.length];
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch('https://room/create', { method: 'POST', headers: { 'X-Room-Code': code } });
        if (r.status === 200) return new Response(JSON.stringify({ code }), { headers });
      }
      return new Response('{"error":"busy"}', { status: 503, headers });
    }

    // Timing numbers for the load test: no names, answers or tokens.
    const mm = /^\/metrics\/([A-Za-z]{4,5})$/.exec(url.pathname);
    if (mm && validCode(mm[1].toUpperCase())) {
      const stub = env.ROOMS.get(env.ROOMS.idFromName(mm[1].toUpperCase()));
      return stub.fetch('https://room/metrics', { headers: { 'X-Room-Code': mm[1].toUpperCase() } }).then(r => new Response(r.body, { headers }));
    }
    const m = /^\/room\/([A-Za-z]{4,5})$/.exec(url.pathname);
    if (m) {
      const code = m[1].toUpperCase();
      if (!validCode(code)) return new Response('bad room code', { status: 404, headers });
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected a WebSocket', { status: 426, headers });
      if (!originAllowed(origin, env.ALLOWED_ORIGINS)) return new Response('origin not allowed', { status: 403, headers });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      const fwd = new Request(request);
      fwd.headers.set('X-Room-Code', code);
      return stub.fetch(fwd);
    }
    return new Response('not found', { status: 404, headers });
  }
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.s = null;            // the game state; null until read from storage
    this.loaded = false;
    this.limiters = new Map();
    // Every handoff is timed (from receiving the answer to sending the next
    // turn) so the load test can read it back.
    this.metrics = { handoffs: [], messages: 0 };
    // Tests move the room's clock forward instead of waiting (see test/worker).
    this.skew = 0;
  }

  now() { return Date.now() + this.skew; }

  async load() {
    if (!this.loaded) {
      this.s = (await this.ctx.storage.get('state')) || null;
      this.skew = (await this.ctx.storage.get('testSkew')) || 0;
      this.loaded = true;
    }
    return this.s;
  }

  async fetch(request) {
    const code = request.headers.get('X-Room-Code') || SHORE;
    const url = new URL(request.url);
    await this.load();

    if (url.pathname === '/create') {
      if (this.s && this.s.open) return new Response('taken', { status: 409 });
      // An unused room closes like an empty one.
      this.s = { ...initialState(code, seedFrom(), this.now()), open: true, cleanupAt: this.now() + CLEANUP_MS };
      await this.ctx.storage.put('state', this.s);
      await this.ctx.storage.setAlarm(this.s.cleanupAt);
      return new Response('ok');
    }
    if (url.pathname === '/metrics') {
      const h = this.metrics.handoffs.slice().sort((a, b) => a - b);
      const q = (f) => (h.length ? +h[Math.min(h.length - 1, Math.floor(f * h.length))].toFixed(2) : null);
      return new Response(JSON.stringify({ handoffs: { count: h.length, p50: q(0.5), p95: q(0.95), max: q(1) }, messages: this.metrics.messages, sockets: this.ctx.getWebSockets().length }));
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const cid = crypto.randomUUID();
    server.serializeAttachment({ pid: null, cid });
    if (!this.s) {
      if (code !== SHORE) {
        server.send(JSON.stringify({ v: 1, type: 'error', code: 'noRoom' }));
        server.close(4004, 'This room has closed');
        return new Response(null, { status: 101, webSocket: client });
      }
      this.s = { ...initialState(SHORE, seedFrom(), this.now()), open: true };
      await this.ctx.storage.put('state', this.s);
    }
    server.send(JSON.stringify({ v: 1, type: 'hello', protocol: PROTOCOL, now: this.now(), code }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    const now = this.now();
    this.metrics.messages++;
    if (typeof raw !== 'string' || raw.length > MAX_RAW) return;
    const att = ws.deserializeAttachment() || {};
    let lim = this.limiters.get(att.cid);
    if (!lim) { lim = makeLimiter(now); this.limiters.set(att.cid, lim); }
    const m = parseClient(raw);
    if (!m) return;
    const verdict = limit(lim, m.type === 'typing' ? 'typing' : 'msg', now);
    if (verdict === 'close') { ws.close(4008, 'Too many messages'); return; }
    if (verdict === 'drop') return;

    if (m.type === 'ping') { ws.send(JSON.stringify({ v: 1, type: 'pong', t: m.t, s: this.now() })); return; }
    await this.load();
    if (!this.s) return;

    if (m.type === 'join') {
      const r = await this.apply({ type: 'join', token: m.token, name: m.name, color: m.color, pid: att.pid || undefined }, ws);
      if (r && r.joined) {
        // Newest connection wins: an older tab with the same player is told why and closed.
        for (const other of this.ctx.getWebSockets()) {
          if (other === ws) continue;
          const oa = other.deserializeAttachment() || {};
          if (oa.pid === r.joined) {
            other.serializeAttachment({ ...oa, pid: null });
            safeSend(other, { v: 1, type: 'error', code: 'otherTab' });
            try { other.close(4001, 'Opened in another tab'); } catch (e) { /* already closed */ }
          }
        }
        ws.serializeAttachment({ ...att, pid: r.joined });
      }
      return;
    }
    if (!att.pid) return;          // everything else needs a seat
    const t0 = performance.now();
    const holderBefore = this.s.game && this.s.game.holderId;
    await this.apply({ ...m, pid: att.pid }, ws);
    if (m.type === 'submit' || m.type === 'confirmSuggestion') {
      const g = this.s && this.s.game;
      if (g && g.holderId && g.holderId !== holderBefore) {
        this.metrics.handoffs.push(performance.now() - t0);
        if (this.metrics.handoffs.length > 500) this.metrics.handoffs.shift();
      }
    }
  }

  async webSocketClose(ws, code, reason) {
    await this.dropSocket(ws);
    try { ws.close(code, reason); } catch (e) { /* already closed */ }
  }
  async webSocketError(ws) { await this.dropSocket(ws); }

  async dropSocket(ws) {
    const att = ws.deserializeAttachment() || {};
    this.limiters.delete(att.cid);
    if (!att.pid) return;
    ws.serializeAttachment({ ...att, pid: null });
    // Another tab may hold the same seat; then the player is still here.
    const still = this.ctx.getWebSockets().some(o => o !== ws && (o.deserializeAttachment() || {}).pid === att.pid);
    if (still) return;
    await this.load();
    if (this.s) await this.apply({ type: 'disconnect', pid: att.pid }, null);
  }

  async alarm() {
    await this.load();
    if (this.s) await this.apply({ type: 'alarm' }, null);
  }

  // Run one event through the engine, save, set the alarm, deliver.
  async apply(ev, ws) {
    const r = reduce(this.s, ev, this.now(), getCatalog());
    const open = this.s.open;
    this.s = r.state;
    if (open) this.s.open = true;
    const purge = r.effects.some(f => f.kind === 'purge');
    if (purge) {
      this.s = null;
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
    } else if (r.persist) {
      await this.ctx.storage.put('state', this.s);
      const cur = await this.ctx.storage.getAlarm();
      if (r.alarm == null) { if (cur != null) await this.ctx.storage.deleteAlarm(); }
      else if (cur !== r.alarm) await this.ctx.storage.setAlarm(r.alarm);
    }
    this.deliver(r.effects, ws);
    return r;
  }

  deliver(effects, self) {
    const sockets = this.ctx.getWebSockets().map(w => ({ w, pid: (w.deserializeAttachment() || {}).pid }));
    for (const f of effects) {
      if (f.kind === 'send') {
        const text = JSON.stringify({ v: 1, ...f.msg });
        if (f.to === 'self') { if (self) safeSend(self, text); continue; }
        for (const { w, pid } of sockets) {
          if (!pid) continue;
          if (f.to !== 'all' && f.to !== pid) continue;
          if (f.except && f.except === pid) continue;
          safeSend(w, text);
        }
      } else if (f.kind === 'close') {
        for (const s of sockets) {
          if (s.pid !== f.to) continue;
          s.w.serializeAttachment({ ...(s.w.deserializeAttachment() || {}), pid: null });
          s.pid = null;
          safeSend(s.w, { v: 1, type: 'error', code: f.reason });
          try { s.w.close(f.code, f.reason); } catch (e) { /* already closed */ }
        }
      }
    }
  }
}

function safeSend(ws, msg) {
  try { ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch (e) { /* socket gone */ }
}
function seedFrom() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
