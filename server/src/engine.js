/* Live Coal: the game rules, as a pure state machine.
 *
 *   reduce(state, event, now, catalog) -> { state, effects, persist, alarm }
 *
 * - `state` is plain JSON (it is saved to Durable Object storage as is). The
 *   input state is never mutated; a copy is returned.
 * - `now` is the server clock in ms, injected so tests can use fake time.
 * - Randomness comes from a seeded generator kept in `state.rng`, so the same
 *   events at the same times always give the same game.
 * - `catalog` (see catalog.js) knows the prompt banks and runs the shared
 *   answer matcher.
 * - `effects` are messages for the Durable Object to deliver:
 *     { kind: 'send', to: 'all' | playerId | 'self', msg, except? }
 *     { kind: 'close', to: playerId, code, reason }
 *     { kind: 'purge' }   the room is empty and expired: delete its storage
 * - `alarm` is the one time (ms) the Durable Object should wake up next, or
 *   null. Every timer in the game (turn deadline, round intro, pause after an
 *   elimination, host hand-over, lobby clean-up, room close) is resolved by
 *   `advance`, which runs first on every event, so a late alarm and an early
 *   message always agree on what happened.
 */

export const PROTOCOL = 1;
export const GRACE_MS = 250;            // an answer counts up to the deadline plus this
export const INTRO_MS = 3000;           // "Round 2 · get ready"
export const PAUSE_MS = 1500;           // after an elimination or round end
export const HOST_GRACE_MS = 15000;     // a disconnected host keeps the role this long
export const LOBBY_DROP_MS = 60000;     // a disconnected player leaves the lobby after this
export const CLEANUP_MS = 10 * 60000;   // an empty room is deleted after this
export const SAFETY_MS = 40 * 60000;    // after this the floor drops, to force an ending
export const SAFETY_FLOOR_MS = 3000;
export const STEP_MS = 1500;            // each round is this much shorter
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 16;
export const ANSWERS_PER_ROUND = 3;     // round ends once every player still in has answered this many times
export const BANK_FACTOR = 3;           // a category needs 3 x players still in ...
export const BANK_BUFFER = 10;          // ... plus 10 answers
export const PRESETS = {
  relaxed: { startMs: 20000, floorMs: 7000, label: 'Relaxed' },
  standard: { startMs: 15000, floorMs: 5000, label: 'Standard' },
  fast: { startMs: 10000, floorMs: 4000, label: 'Fast' }
};
export const COLORS = ['ember', 'gold', 'sea', 'reed', 'dawn', 'olive', 'plum', 'sand'];
export const TYPING_MAX = 60;

// ---------------------------------------------------------------- helpers

function rand(s) {                       // mulberry32 on s.rng
  s.rng = (s.rng + 0x6D2B79F5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(s, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function randomId(s, len) {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += abc[Math.floor(rand(s) * abc.length)];
  return out;
}

export function turnMsFor(preset, round, elapsedMs) {
  const p = PRESETS[preset] || PRESETS.standard;
  let floor = p.floorMs;
  if (elapsedMs >= SAFETY_MS) floor = Math.min(floor, SAFETY_FLOOR_MS);
  return Math.max(floor, p.startMs - STEP_MS * (round - 1));
}

// A very small list: it catches the obvious, not the clever.
const BLOCKED = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fag', 'whore', 'slut', 'dick', 'cock', 'pussy', 'penis', 'vagina', 'porn', 'rape', 'nazi', 'hitler', 'retard', 'bastard', 'asshole', 'twat', 'wank', 'kkk'];
export function cleanName(raw) {
  const name = String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 16) return { error: 'nameLength' };
  const flat = name.toLowerCase().replace(/[^a-z]/g, '').replace(/0/g, 'o');
  const leet = name.toLowerCase().replace(/[0]/g, 'o').replace(/[1!|]/g, 'i').replace(/[3]/g, 'e').replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/[^a-z]/g, '');
  if (BLOCKED.some(w => flat.includes(w) || leet.includes(w))) return { error: 'nameBlocked' };
  return { name };
}

// ---------------------------------------------------------------- state

export function initialState(code, seed, now) {
  return {
    v: 1,
    code,
    rng: seed >>> 0,
    created: now,
    phase: 'lobby',          // 'lobby' | 'game'  (a finished game goes back to the lobby with `last` set)
    hostId: null,
    hostAwayAt: null,        // the host's socket closed at this time
    preset: 'standard',
    players: {},             // id -> player
    kicked: [],              // tokens removed by the host
    game: null,
    last: null,              // the last game's recap
    cleanupAt: null,
    gameNo: 0
  };
}

function connectedIds(s) { return Object.keys(s.players).filter(id => s.players[id].connected); }
function alive(s) {
  if (!s.game) return [];
  return s.game.order.filter(id => s.players[id] && s.players[id].inGame && !s.players[id].out);
}
function nextAlive(s, fromId) {
  const order = s.game.order, n = order.length;
  const i = order.indexOf(fromId);
  for (let k = 1; k <= n; k++) {
    const id = order[(i + k + n) % n];
    const p = s.players[id];
    if (p && p.inGame && !p.out) return id;
  }
  return null;
}

export function publicPlayer(p) {
  return {
    id: p.id, name: p.name, color: p.color, connected: p.connected,
    inGame: !!p.inGame, out: !!p.out, outRound: p.outRound || null, joinedAt: p.joinedAt
  };
}
function roster(s) { return Object.values(s.players).sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1)).map(publicPlayer); }
function rosterMsg(s) { return { type: 'players', players: roster(s), hostId: s.hostId, preset: s.preset }; }

function publicGame(g) {
  if (!g) return null;
  return {
    no: g.no, startedAt: g.startedAt, round: g.round, prompt: g.prompt, turnMs: g.turnMs,
    stage: g.stage, stageEnds: g.stageEnds, holderId: g.holderId, turnStart: g.turnStart,
    deadline: g.deadline, order: g.order, said: g.said, counts: g.counts, remaining: g.remaining,
    lastEnd: g.lastEnd
  };
}

export function snapshot(s, you, now) {
  return {
    type: 'snapshot', protocol: PROTOCOL, now, code: s.code, you,
    phase: s.phase, hostId: s.hostId, preset: s.preset, presets: PRESETS,
    players: roster(s), game: publicGame(s.game), last: s.last
  };
}

// ---------------------------------------------------------------- timers

export function nextAlarm(s) {
  const t = [];
  const g = s.game;
  if (g) {
    if (g.stage === 'turn') t.push(g.deadline + GRACE_MS + 1);
    else if (g.stageEnds != null) t.push(g.stageEnds);
  }
  if (s.hostAwayAt != null) t.push(s.hostAwayAt + HOST_GRACE_MS);
  if (s.phase === 'lobby') {
    for (const p of Object.values(s.players)) if (!p.connected && p.discAt != null) t.push(p.discAt + LOBBY_DROP_MS);
  }
  if (s.cleanupAt != null) t.push(s.cleanupAt);
  return t.length ? Math.min(...t) : null;
}

// Resolve every timer that is due at `now`, earliest first.
function advance(s, now, fx, catalog) {
  for (let guard = 0; guard < 200; guard++) {
    const g = s.game;
    const due = [];
    if (g && g.stage === 'turn' && now > g.deadline + GRACE_MS) due.push([g.deadline + GRACE_MS, 'timeout']);
    if (g && g.stage !== 'turn' && g.stageEnds != null && now >= g.stageEnds) due.push([g.stageEnds, 'stage']);
    if (s.hostAwayAt != null && now >= s.hostAwayAt + HOST_GRACE_MS) due.push([s.hostAwayAt + HOST_GRACE_MS, 'host']);
    if (s.phase === 'lobby') {
      for (const p of Object.values(s.players)) {
        if (!p.connected && p.discAt != null && now >= p.discAt + LOBBY_DROP_MS) due.push([p.discAt + LOBBY_DROP_MS, 'drop', p.id]);
      }
    }
    if (s.cleanupAt != null && now >= s.cleanupAt) due.push([s.cleanupAt, 'cleanup']);
    if (!due.length) return;
    due.sort((a, b) => a[0] - b[0]);
    const [, kind, arg] = due[0];
    if (kind === 'timeout') eliminate(s, g.holderId, now, fx, catalog, 'timeout');
    else if (kind === 'stage') endStage(s, now, fx, catalog);
    else if (kind === 'host') { s.hostAwayAt = null; passHost(s, fx); }
    else if (kind === 'drop') { removePlayer(s, arg, now, fx, catalog, 'left'); }
    else if (kind === 'cleanup') {
      const keepCode = s.code, seed = s.rng;
      Object.assign(s, initialState(keepCode, seed, now));
      s.purged = true;
      fx.push({ kind: 'purge' });
      return;
    }
  }
}

function passHost(s, fx) {
  const cands = connectedIds(s).filter(id => id !== s.hostId)
    .sort((a, b) => s.players[a].since - s.players[b].since || s.players[a].joinedAt - s.players[b].joinedAt);
  const cur = s.players[s.hostId];
  if (cur && cur.connected) return;          // came back in time
  if (!cands.length) return;                 // nobody to pass to; keep it until someone joins
  s.hostId = cands[0];
  fx.push({ kind: 'send', to: 'all', msg: { type: 'host', hostId: s.hostId } });
}

// ---------------------------------------------------------------- game flow

function startGame(s, now, fx, catalog) {
  const ids = connectedIds(s);
  s.gameNo += 1;
  for (const p of Object.values(s.players)) { p.inGame = false; p.out = false; p.outRound = null; }
  for (const id of ids) s.players[id].inGame = true;
  const order = shuffle(s, ids.slice().sort());
  s.phase = 'game';
  s.last = null;
  s.game = {
    no: s.gameNo, startedAt: now, round: 0, order, prompt: null, turnMs: 0,
    stage: 'intro', stageEnds: null, holderId: null, turnStart: null, deadline: null,
    nextHolder: order[0], used: {}, said: [], counts: {}, remaining: 0, suggestion: null,
    promptsUsed: [], elim: [], stats: {}, lastEnd: null
  };
  for (const id of order) s.game.stats[id] = { answers: [], tries: 0 };
  fx.push({ kind: 'send', to: 'all', msg: { type: 'gameStarted', order, startedAt: now, preset: s.preset } });
  startRound(s, now, fx, catalog);
}

function startRound(s, now, fx, catalog) {
  const g = s.game;
  g.round += 1;
  g.turnMs = turnMsFor(s.preset, g.round, now - g.startedAt);
  const n = alive(s).length;
  const pick = catalog.pick({ players: n, round: g.round, used: g.promptsUsed, rand: () => rand(s) });
  if (!pick) { gameOver(s, now, fx, 'noPrompts'); return; }
  g.promptsUsed.push(pick.id);
  g.prompt = { id: pick.id, text: pick.text, category: pick.category, closed: !!pick.closed, total: pick.groups };
  g.used = {};
  g.said = [];
  g.counts = {};
  g.remaining = pick.groups;
  g.stage = 'intro';
  g.stageEnds = now + INTRO_MS;
  g.holderId = null; g.deadline = null; g.turnStart = null; g.suggestion = null;
  if (!g.nextHolder || !alive(s).includes(g.nextHolder)) g.nextHolder = alive(s)[0];
  fx.push({ kind: 'send', to: 'all', msg: { type: 'roundStarted', round: g.round, prompt: g.prompt, turnMs: g.turnMs, introEnds: g.stageEnds, firstHolder: g.nextHolder } });
}

function startTurn(s, holderId, now, fx) {
  const g = s.game;
  g.stage = 'turn';
  g.stageEnds = null;
  g.holderId = holderId;
  g.turnStart = now;
  g.deadline = now + g.turnMs;
  g.suggestion = null;
  fx.push({ kind: 'send', to: 'all', msg: { type: 'turnStarted', playerId: holderId, deadline: g.deadline, turnMs: g.turnMs, round: g.round } });
}

function endStage(s, now, fx, catalog) {
  const g = s.game;
  if (g.stage === 'intro') startTurn(s, g.nextHolder, now, fx);
  else if (g.stage === 'pause') startRound(s, now, fx, catalog);
}

function endRound(s, reason, now, fx, nextHolder) {
  const g = s.game;
  g.stage = 'pause';
  g.stageEnds = now + PAUSE_MS;
  g.holderId = null; g.deadline = null; g.suggestion = null;
  g.nextHolder = nextHolder;
  g.lastEnd = { round: g.round, reason };
  fx.push({ kind: 'send', to: 'all', msg: { type: 'roundEnded', round: g.round, reason, nextAt: g.stageEnds } });
}

function eliminate(s, pid, now, fx, catalog, why) {
  const g = s.game, p = s.players[pid];
  const next = nextAlive(s, pid);
  if (p) { p.out = true; p.outRound = g.round; }
  g.elim.push({ id: pid, round: g.round, why });
  fx.push({ kind: 'send', to: 'all', msg: { type: 'eliminated', playerId: pid, round: g.round, why } });
  const left = alive(s);
  if (left.length <= 1) { gameOver(s, now, fx, left.length ? 'winner' : 'none'); return; }
  g.lastEnd = { round: g.round, reason: 'eliminated', playerId: pid };
  g.stage = 'pause';
  g.stageEnds = now + PAUSE_MS;
  g.holderId = null; g.deadline = null; g.suggestion = null;
  g.nextHolder = next;
}

function tierRank(t) { return t || 0; }

function gameOver(s, now, fx, reason) {
  const g = s.game;
  const left = alive(s);
  const winnerId = reason === 'winner' && left.length === 1 ? left[0] : null;
  const outOrder = g.elim.map(e => e.id);
  const players = g.order.map(id => {
    const st = g.stats[id] || { answers: [] };
    const p = s.players[id];
    const rarest = st.answers.reduce((best, a) => (!best || tierRank(a.tier) > tierRank(best.tier) ? a : best), null);
    const outIdx = outOrder.indexOf(id);
    return {
      id, name: p ? p.name : (st.name || '?'), color: p ? p.color : (st.color || 'ember'),
      place: id === winnerId ? 1 : (outIdx === -1 ? null : g.order.length - outIdx),
      outRound: outIdx === -1 ? null : g.elim[outIdx].round,
      lastedTo: outIdx === -1 ? g.round : g.elim[outIdx].round,
      answers: st.answers, rarest
    };
  });
  s.last = { no: g.no, winnerId, reason, rounds: g.round, endedAt: now, startedAt: g.startedAt, players, outOrder };
  s.phase = 'lobby';
  s.game = null;
  for (const p of Object.values(s.players)) {
    p.inGame = false; p.out = false; p.outRound = null;
    if (!p.connected) p.discAt = now;      // they now have the lobby's grace to come back
  }
  fx.push({ kind: 'send', to: 'all', msg: { type: 'gameOver', recap: s.last } });
  fx.push({ kind: 'send', to: 'all', msg: rosterMsg(s) });
}

function removePlayer(s, pid, now, fx, catalog, why) {
  const p = s.players[pid];
  if (!p) return;
  const g = s.game;
  let holderNext = null;
  const wasHolder = g && g.stage === 'turn' && g.holderId === pid;
  if (g && g.stats[pid]) { g.stats[pid].name = p.name; g.stats[pid].color = p.color; }
  if (g && p.inGame && !p.out) {
    holderNext = nextAlive(s, pid);
    g.elim.push({ id: pid, round: g.round, why: why || 'left' });
    fx.push({ kind: 'send', to: 'all', msg: { type: 'eliminated', playerId: pid, round: g.round, why: why || 'left' } });
  }
  delete s.players[pid];
  if (s.hostId === pid) { s.hostId = null; s.hostAwayAt = null; passHost(s, fx); if (!s.hostId) { const c = Object.keys(s.players)[0]; if (c) s.hostId = c; } }
  fx.push({ kind: 'send', to: 'all', msg: rosterMsg(s) });
  if (g && holderNext !== null) {
    const left = alive(s);
    if (left.length <= 1) { gameOver(s, now, fx, left.length ? 'winner' : 'none'); return; }
    if (wasHolder) {
      if (roundDoneByRotation(s)) endRound(s, 'rotation', now, fx, holderNext);
      else startTurn(s, holderNext, now, fx);
    } else if (g.nextHolder === pid) {
      g.nextHolder = holderNext;
    }
  }
  if (!Object.keys(s.players).length) s.cleanupAt = now + CLEANUP_MS;
}

function roundDoneByRotation(s) {
  const g = s.game;
  return alive(s).every(id => (g.counts[id] || 0) >= ANSWERS_PER_ROUND);
}

// Everyone left mid-game: end it with no winner and reset the room.
function checkAbandoned(s, now, fx) {
  if (s.phase === 'game' && connectedIds(s).length === 0) {
    s.game = null; s.phase = 'lobby'; s.last = null;
    for (const p of Object.values(s.players)) { p.inGame = false; p.out = false; p.outRound = null; p.discAt = now; }
    fx.push({ kind: 'send', to: 'all', msg: { type: 'gameOver', recap: null, reason: 'abandoned' } });
  }
}

function accept(s, pid, idx, input, now, fx, catalog) {
  const g = s.game;
  const info = catalog.answer(g.prompt.id, idx);
  const key = info.group;
  if (g.used[key]) {
    const by = g.used[key].by;
    fx.push({ kind: 'send', to: 'self', msg: { type: 'answerRejected', reason: 'duplicate', answer: g.used[key].answer, by, byName: (s.players[by] && s.players[by].name) || g.used[key].byName, input } });
    return;
  }
  const byName = s.players[pid].name;
  g.used[key] = { by: pid, byName, answer: info.name, tier: info.tier };
  g.said.push({ by: pid, answer: info.name, tier: info.tier });
  g.counts[pid] = (g.counts[pid] || 0) + 1;
  g.remaining = Math.max(0, g.remaining - 1);
  if (g.stats[pid]) g.stats[pid].answers.push({ answer: info.name, tier: info.tier, round: g.round, prompt: g.prompt.text });
  fx.push({ kind: 'send', to: 'all', msg: { type: 'answerAccepted', playerId: pid, answer: info.name, tier: info.tier, input, remaining: g.remaining, count: g.counts[pid] } });
  const next = nextAlive(s, pid);
  if (g.remaining <= 0) endRound(s, 'empty', now, fx, next);
  else if (roundDoneByRotation(s)) endRound(s, 'rotation', now, fx, next);
  else startTurn(s, next, now, fx);
}

// ---------------------------------------------------------------- events

function hostOnly(s, ev) { return ev.pid && ev.pid === s.hostId; }

export function reduce(prev, ev, now, catalog) {
  const s = structuredClone(prev);
  delete s.purged;
  const fx = [];
  advance(s, now, fx, catalog);
  const me = ev.pid ? s.players[ev.pid] : null;

  switch (ev.type) {
    case 'alarm':
      break;

    case 'join': {
      // ev: { token, name, color }
      if (s.kicked.includes(ev.token)) { fx.push({ kind: 'send', to: 'self', msg: { type: 'error', code: 'removed' } }); break; }
      const existing = Object.values(s.players).find(p => p.token === ev.token);
      const c = cleanName(ev.name);
      const color = COLORS.includes(ev.color) ? ev.color : null;
      if (existing) {
        if (!c.error && !taken(s, c.name, existing.id)) existing.name = c.name;
        if (color) existing.color = color;
        if (!existing.connected) existing.since = now;
        existing.connected = true;
        existing.discAt = null;
        if (s.hostId === existing.id) s.hostAwayAt = null;
        s.cleanupAt = null;
        fx.push({ kind: 'send', to: 'self', msg: snapshot(s, existing.id, now) });
        fx.push({ kind: 'send', to: 'all', msg: rosterMsg(s) });
        fx.joined = existing.id;
        break;
      }
      if (c.error) { fx.push({ kind: 'send', to: 'self', msg: { type: 'error', code: c.error } }); break; }
      if (taken(s, c.name)) { fx.push({ kind: 'send', to: 'self', msg: { type: 'error', code: 'nameTaken' } }); break; }
      if (Object.keys(s.players).length >= MAX_PLAYERS) { fx.push({ kind: 'send', to: 'self', msg: { type: 'error', code: 'full' } }); break; }
      let id;
      do { id = randomId(s, 8); } while (s.players[id]);
      s.players[id] = {
        id, token: ev.token, name: c.name, color: color || COLORS[Object.keys(s.players).length % COLORS.length],
        joinedAt: now, since: now, connected: true, discAt: null, inGame: false, out: false, outRound: null
      };
      if (!s.hostId) s.hostId = id;
      s.cleanupAt = null;
      fx.push({ kind: 'send', to: 'self', msg: snapshot(s, id, now) });
      fx.push({ kind: 'send', to: 'all', msg: rosterMsg(s) });
      fx.joined = id;
      break;
    }

    case 'setName': {
      if (!me) { break; }
      const c = cleanName(ev.name);
      if (c.error) { fx.push({ kind: 'send', to: 'self', msg: { type: 'error', code: c.error } }); break; }
      if (taken(s, c.name, me.id)) { fx.push({ kind: 'send', to: 'self', msg: { type: 'error', code: 'nameTaken' } }); break; }
      me.name = c.name;
      if (COLORS.includes(ev.color)) me.color = ev.color;
      fx.push({ kind: 'send', to: 'all', msg: rosterMsg(s) });
      break;
    }

    case 'disconnect': {
      if (!me) { break; }
      me.connected = false;
      me.discAt = now;
      if (s.hostId === me.id) s.hostAwayAt = now;
      checkAbandoned(s, now, fx);
      if (connectedIds(s).length === 0) s.cleanupAt = now + CLEANUP_MS;
      fx.push({ kind: 'send', to: 'all', msg: rosterMsg(s) });
      break;
    }

    case 'leave': {
      if (!me) break;
      removePlayer(s, me.id, now, fx, catalog, 'left');
      fx.push({ kind: 'close', to: ev.pid, code: 4000, reason: 'left' });
      break;
    }

    case 'settings': {
      if (!hostOnly(s, ev) || s.phase !== 'lobby' || !PRESETS[ev.preset]) { break; }
      s.preset = ev.preset;
      fx.push({ kind: 'send', to: 'all', msg: rosterMsg(s) });
      break;
    }

    case 'start':
    case 'rematch': {
      if (!hostOnly(s, ev)) { fx.push({ kind: 'send', to: 'self', msg: { type: 'error', code: 'notHost' } }); break; }
      if (s.phase !== 'lobby') { break; }
      if (connectedIds(s).length < MIN_PLAYERS) { fx.push({ kind: 'send', to: 'self', msg: { type: 'error', code: 'needPlayers' } }); break; }
      startGame(s, now, fx, catalog);
      break;
    }

    case 'kick': {
      if (!hostOnly(s, ev) || ev.target === s.hostId || !s.players[ev.target]) { break; }
      const target = s.players[ev.target];
      s.kicked.push(target.token);
      if (s.kicked.length > 64) s.kicked.shift();
      removePlayer(s, target.id, now, fx, catalog, 'removed');
      fx.push({ kind: 'close', to: ev.target, code: 4003, reason: 'removed' });
      break;
    }

    case 'typing': {
      const g = s.game;
      if (!g || g.stage !== 'turn' || g.holderId !== ev.pid) break;
      fx.push({ kind: 'send', to: 'all', except: ev.pid, msg: { type: 'typing', playerId: ev.pid, text: String(ev.text || '').slice(0, TYPING_MAX) } });
      break;
    }

    case 'submit':
    case 'confirmSuggestion': {
      const g = s.game;
      // Only the coal holder's answers count; anyone else's are dropped silently.
      if (!g || g.stage !== 'turn' || g.holderId !== ev.pid) { break; }
      if (g.stats[ev.pid]) g.stats[ev.pid].tries += 1;
      if (ev.type === 'confirmSuggestion') {
        if (!g.suggestion || g.suggestion.pid !== ev.pid) { break; }
        accept(s, ev.pid, g.suggestion.idx, g.suggestion.answer, now, fx, catalog);
        break;
      }
      const text = String(ev.text || '').slice(0, 200);
      const r = catalog.evaluate(g.prompt.id, text);
      if (r.type === 'empty') { break; }
      if (r.type === 'accept') { accept(s, ev.pid, r.index, text, now, fx, catalog); break; }
      if (r.type === 'suggest') {
        const info = catalog.answer(g.prompt.id, r.index);
        if (g.used[info.group]) {
          const u = g.used[info.group];
          fx.push({ kind: 'send', to: 'self', msg: { type: 'answerRejected', reason: 'duplicate', answer: u.answer, by: u.by, byName: u.byName, input: text } });
          break;
        }
        g.suggestion = { pid: ev.pid, idx: r.index, answer: info.name };
        fx.push({ kind: 'send', to: 'self', msg: { type: 'answerRejected', reason: 'suggest', answer: info.name, why: r.reason, input: text } });
        break;
      }
      if (r.type === 'near') {
        fx.push({ kind: 'send', to: 'self', msg: { type: 'answerRejected', reason: 'near', name: r.nearMiss.name, message: r.nearMiss.message, input: text } });
        break;
      }
      fx.push({ kind: 'send', to: 'self', msg: { type: 'answerRejected', reason: 'miss', input: text } });
      break;
    }

    default:
  }

  return { state: s, effects: fx, persist: s.purged === true || JSON.stringify(s) !== JSON.stringify(prev), alarm: nextAlarm(s), joined: fx.joined || null };
}

function taken(s, name, exceptId) {
  const k = name.toLowerCase();
  return Object.values(s.players).some(p => p.id !== exceptId && p.name.toLowerCase() === k);
}
