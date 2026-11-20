import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reduce, initialState, turnMsFor, cleanName, nextAlarm, snapshot,
  GRACE_MS, INTRO_MS, PAUSE_MS, HOST_GRACE_MS, CLEANUP_MS, LOBBY_DROP_MS, SAFETY_MS, MAX_PLAYERS
} from '../../src/engine.js';
import { Room, fixedCatalog, realCatalog, tok, matcher } from './helpers.js';
import { makeCatalog } from '../../src/catalog.js';

function two(opts) {
  const r = new Room(opts);
  r.join('Hannah'); r.join('Eli');
  return r;
}
function four(opts) {
  const r = new Room(opts);
  for (const n of ['Hannah', 'Eli', 'Ruth', 'Boaz']) r.join(n);
  return r;
}

// ------------------------------------------------------------ timer schedule

test('timer schedule: standard 15 s, minus 1.5 s a round, floor 5 s', () => {
  const got = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => turnMsFor('standard', n, 0));
  assert.deepEqual(got, [15000, 13500, 12000, 10500, 9000, 7500, 6000, 5000, 5000]);
});
test('timer presets: relaxed 20/7, fast 10/4', () => {
  assert.equal(turnMsFor('relaxed', 1, 0), 20000);
  assert.equal(turnMsFor('relaxed', 20, 0), 7000);
  assert.equal(turnMsFor('fast', 1, 0), 10000);
  assert.equal(turnMsFor('fast', 20, 0), 4000);
});
test('40-minute safety: the floor drops to 3 s', () => {
  assert.equal(turnMsFor('standard', 30, SAFETY_MS - 1), 5000);
  assert.equal(turnMsFor('standard', 30, SAFETY_MS), 3000);
  assert.equal(turnMsFor('relaxed', 30, SAFETY_MS + 5), 3000);
  assert.equal(turnMsFor('standard', 2, SAFETY_MS), 13500);  // only the floor changes
});
test('40-minute safety applies to the next round of a long game', () => {
  const r = two();
  r.startAndIntro('Hannah');
  // Pretend the game began 40 minutes ago, in round 25.
  r.s = structuredClone(r.s); r.s.game.startedAt -= SAFETY_MS; r.s.game.round = 25;
  // Force a round end by rotation: everyone answers 3 times.
  for (let i = 0; i < 6; i++) r.answer();
  r.wait(PAUSE_MS);
  assert.equal(r.g.round, 26);
  assert.equal(r.g.turnMs, 3000);
});

// ------------------------------------------------------------ joining

test('names: 2-16 chars, trimmed, unique in the room, basic filter', () => {
  assert.equal(cleanName('  Hannah  ').name, 'Hannah');
  assert.equal(cleanName('A').error, 'nameLength');
  assert.equal(cleanName('x'.repeat(17)).error, 'nameLength');
  assert.equal(cleanName('sh1t head').error, 'nameBlocked');
  assert.equal(cleanName('Dick').error, 'nameBlocked');   // a known false positive, accepted for a simple filter
  const r = new Room();
  r.join('Hannah');
  r.join('hannah', 'other');
  assert.equal(r.lastMsg('error').code, 'nameTaken');
  assert.equal(Object.keys(r.s.players).length, 1);
});

test('first person is host; refresh with the same token rejoins the same seat', () => {
  const r = two();
  assert.equal(r.s.hostId, r.pid('Hannah'));
  const id = r.pid('Eli');
  r.as('Eli', { type: 'disconnect' });
  const again = r.join('Eli');
  assert.equal(again.joined, id);
  assert.equal(Object.keys(r.s.players).length, 2);
  assert.equal(r.s.players[id].connected, true);
});

test('room holds at most 16', () => {
  const r = new Room();
  for (let i = 0; i < MAX_PLAYERS; i++) r.join('Player ' + i);
  r.join('Extra');
  assert.equal(r.lastMsg('error').code, 'full');
  assert.equal(Object.keys(r.s.players).length, MAX_PLAYERS);
});

test('snapshot never includes player tokens', () => {
  const r = two();
  const snap = JSON.stringify(snapshot(r.s, r.pid('Eli'), r.t));
  assert.ok(!snap.includes(tok('Eli')));
  for (const m of r.out) assert.ok(!JSON.stringify(m).includes('token-'));
});

// ------------------------------------------------------------ starting

test('start: host only, at least 2 players', () => {
  const r = new Room();
  r.join('Hannah');
  r.as('Hannah', { type: 'start' });
  assert.equal(r.lastMsg('error').code, 'needPlayers');
  r.join('Eli');
  r.as('Eli', { type: 'start' });
  assert.equal(r.lastMsg('error').code, 'notHost');
  assert.equal(r.s.phase, 'lobby');
  r.as('Hannah', { type: 'start' });
  assert.equal(r.s.phase, 'game');
});

test('start shuffles the order, shows a 3 s intro, then the first turn', () => {
  const r = four();
  const t0 = r.t;
  r.as('Hannah', { type: 'start' });
  const rs = r.lastMsg('roundStarted');
  assert.equal(rs.round, 1);
  assert.equal(rs.turnMs, 15000);
  assert.equal(rs.introEnds, t0 + INTRO_MS);
  assert.equal(r.last.alarm, t0 + INTRO_MS);
  assert.equal(r.g.order.length, 4);
  assert.equal(r.g.stage, 'intro');
  r.wait(INTRO_MS);
  const ts = r.lastMsg('turnStarted');
  assert.equal(ts.playerId, r.g.order[0]);
  assert.equal(ts.deadline, t0 + INTRO_MS + 15000);
  assert.equal(r.last.alarm, ts.deadline + GRACE_MS + 1);
});

test('same seed and events give the same game; another seed shuffles differently', () => {
  const orders = new Set();
  for (const seed of [1, 1, 2, 3, 4, 5]) {
    const r = four({ seed });
    r.startAndIntro('Hannah');
    orders.add(r.g.order.map(id => r.nameOf(id)).join() + '|' + r.g.prompt.id);
  }
  const a = four({ seed: 9 }); a.startAndIntro('Hannah');
  const b = four({ seed: 9 }); b.startAndIntro('Hannah');
  assert.deepEqual(a.s, b.s);
  assert.ok(orders.size >= 3);
});

// ------------------------------------------------------------ turns

test('only the coal holder can answer; others are dropped silently', () => {
  const r = four();
  r.startAndIntro('Hannah');
  const holder = r.holderName();
  const other = ['Hannah', 'Eli', 'Ruth', 'Boaz'].find(n => n !== holder);
  const before = r.out.length;
  r.as(other, { type: 'submit', text: r.freshAnswer() });
  assert.equal(r.out.length, before);
  assert.equal(r.holderName(), holder);
});

test('a valid answer passes the coal clockwise with a fresh full timer', () => {
  const r = four();
  r.startAndIntro('Hannah');
  const order = r.g.order;
  r.wait(4000);
  r.answer();
  assert.equal(r.lastMsg('answerAccepted').playerId, order[0]);
  assert.equal(r.g.holderId, order[1]);
  assert.equal(r.g.deadline, r.t + 15000);
  r.answer();
  assert.equal(r.g.holderId, order[2]);
});

test('wrong answers: not in the net, near miss, did-you-mean confirm; none is penalized', () => {
  const r = two({ catalog: fixedCatalog(['apostles']) });
  r.join('Ruth'); r.join('Boaz');    // 4 players: apostles (16) needs 22 for 4... fixed catalog ignores the size rule
  r.startAndIntro('Hannah');
  const h = r.holderName();
  r.as(h, { type: 'submit', text: 'Goliath the giant' });
  assert.equal(r.lastMsg('answerRejected').reason, 'miss');
  r.as(h, { type: 'submit', text: 'Petr' });
  const sug = r.lastMsg('answerRejected');
  assert.equal(sug.reason, 'suggest');
  assert.equal(sug.answer, 'Peter');
  assert.equal(r.holderName(), h);
  r.as(h, { type: 'confirmSuggestion' });
  const acc = r.lastMsg('answerAccepted');
  assert.equal(acc.answer, 'Peter');
  assert.notEqual(r.holderName(), h);
  // Rejections go only to the submitter.
  assert.ok(r.out.filter(f => f.msg.type === 'answerRejected').every(f => f.to === 'self'));
});

test('near miss returns its teaching message', () => {
  const r = two({ catalog: fixedCatalog(['books']) });
  r.startAndIntro('Hannah');
  r.as(r.holderName(), { type: 'submit', text: 'Tobit' });
  const m = r.lastMsg('answerRejected');
  assert.equal(m.reason, 'near');
  assert.match(m.message, /66-book canon/);
});

test('no repeats: an alias of a used answer is a duplicate, with who said it', () => {
  const r = four({ catalog: fixedCatalog(['apostles']) });
  r.startAndIntro('Hannah');
  const first = r.holderName();
  r.as(first, { type: 'submit', text: 'Simon Peter' });
  const second = r.holderName();
  for (const t of ['Peter', 'Cephas', 'simon peter']) {
    r.as(second, { type: 'submit', text: t });
    const m = r.lastMsg('answerRejected');
    assert.equal(m.reason, 'duplicate');
    assert.equal(m.byName, first);
    assert.equal(m.answer, 'Peter');
  }
  // A typo of a used answer is also "already said", not "did you mean".
  r.as(second, { type: 'submit', text: 'Petr' });
  assert.equal(r.lastMsg('answerRejected').reason, 'duplicate');
  assert.equal(r.holderName(), second);   // keeps trying
});

test('two people with the same name count as one answer', () => {
  // Build a tiny bank with two Johns.
  const bank = { prompts: [{ id: 'johns', prompt: 'Name a John.', category: 'People', answers: [
    { name: 'John', aliases: ['John the Baptist'], tier: 1 },
    { name: 'John (apostle)', aliases: ['John son of Zebedee'], tier: 2 },
    ...Array.from({ length: 30 }, (_, i) => ({ name: 'Filler' + String.fromCharCode(97 + i % 26) + 'x' + i, aliases: [], tier: 3 }))
  ] }] };
  const c = makeCatalog(bank, matcher);
  assert.equal(c.get('johns').groups, 31);
  const r = two({ catalog: c });
  r.startAndIntro('Hannah');
  const a = r.holderName();
  r.as(a, { type: 'submit', text: 'John the Baptist' });
  const b = r.holderName();
  r.as(b, { type: 'submit', text: 'John son of Zebedee' });
  assert.equal(r.lastMsg('answerRejected').reason, 'duplicate');
});

// ------------------------------------------------------------ time, grace and alarms

test('timeout eliminates: "their coal went out", round ends, pause, then a new shorter round', () => {
  const r = four();
  r.startAndIntro('Hannah');
  const holder = r.g.holderId, next = r.g.order[1], p1 = r.g.prompt.id;
  r.t = r.g.deadline + GRACE_MS + 1;
  r.ev({ type: 'alarm' });
  const el = r.lastMsg('eliminated');
  assert.equal(el.playerId, holder);
  assert.equal(el.why, 'timeout');
  assert.equal(r.s.players[holder].out, true);
  assert.equal(r.g.stage, 'pause');
  assert.equal(r.last.alarm, r.t + PAUSE_MS);
  r.wait(PAUSE_MS);
  const rs = r.lastMsg('roundStarted');
  assert.equal(rs.round, 2);
  assert.equal(rs.turnMs, 13500);
  assert.notEqual(rs.prompt.id, p1);
  assert.equal(rs.firstHolder, next);
  r.wait(INTRO_MS);
  assert.equal(r.g.holderId, next);
});

test('grace: an answer at deadline + 250 ms counts; at + 251 ms the coal is out', () => {
  const a = two(); a.startAndIntro('Hannah');
  const h = a.holderName();
  a.t = a.g.deadline + GRACE_MS;
  a.as(h, { type: 'submit', text: a.freshAnswer() });
  assert.equal(a.msgs('answerAccepted').length, 1);
  assert.equal(a.msgs('eliminated').length, 0);

  const b = two(); b.startAndIntro('Hannah');
  const h2 = b.holderName();
  b.t = b.g.deadline + GRACE_MS + 1;
  b.as(h2, { type: 'submit', text: b.freshAnswer() });   // no alarm has run yet
  assert.equal(b.msgs('answerAccepted').length, 0);
  assert.equal(b.msgs('eliminated').length, 1);
});

test('answer and alarm at the same moment: both processing orders agree', () => {
  for (const offset of [GRACE_MS, GRACE_MS + 1]) {
    const results = [];
    for (const order of ['answerFirst', 'alarmFirst']) {
      const r = two({ seed: 3 }); r.startAndIntro('Hannah');
      const h = r.holderName(), text = r.freshAnswer();
      r.t = r.g.deadline + offset;
      const steps = [() => r.as(h, { type: 'submit', text }), () => r.ev({ type: 'alarm' })];
      if (order === 'alarmFirst') steps.reverse();
      steps.forEach(f => f());
      results.push({ accepted: r.msgs('answerAccepted').length, out: r.msgs('eliminated').length });
    }
    assert.deepEqual(results[0], results[1], 'offset ' + offset);
    assert.deepEqual(results[0], offset <= GRACE_MS ? { accepted: 1, out: 0 } : { accepted: 0, out: 1 });
  }
});

test('an early alarm does nothing and the next alarm is still set', () => {
  const r = two(); r.startAndIntro('Hannah');
  const dl = r.g.deadline;
  r.t = dl - 100;
  const res = r.ev({ type: 'alarm' });
  assert.equal(r.msgs('eliminated').length, 0);
  assert.equal(res.alarm, dl + GRACE_MS + 1);
});

// ------------------------------------------------------------ round ends

test('round ends when every player still in has answered 3 times (no elimination)', () => {
  const r = two({ catalog: fixedCatalog(['books', 'creatures']) });
  r.startAndIntro('Hannah');
  for (let i = 0; i < 5; i++) { r.answer(); assert.equal(r.g.stage, 'turn'); }
  r.answer();
  const end = r.lastMsg('roundEnded');
  assert.equal(end.reason, 'rotation');
  assert.equal(r.msgs('eliminated').length, 0);
  r.wait(PAUSE_MS);
  assert.equal(r.g.round, 2);
  assert.equal(r.g.prompt.id, 'creatures');
  assert.equal(r.g.turnMs, 13500);
});

test('the net is empty: round ends with no elimination when no answers remain', () => {
  const r = two({ catalog: fixedCatalog(['armor-of-god', 'books']) });  // 6 answers, 2 players
  r.startAndIntro('Hannah');
  assert.equal(r.g.remaining, 6);
  for (let i = 0; i < 5; i++) r.answer();
  assert.equal(r.g.stage, 'turn');
  r.answer();
  assert.equal(r.lastMsg('roundEnded').reason, 'empty');   // 3 each and empty together: "the net is empty" wins
});

test('the net is empty before the rotation ends', () => {
  const r = four({ catalog: fixedCatalog(['armor-of-god', 'books']) });   // 6 answers, 4 players need 12
  r.startAndIntro('Hannah');
  for (let i = 0; i < 6; i++) r.answer();
  const end = r.lastMsg('roundEnded');
  assert.equal(end.reason, 'empty');
  assert.equal(r.msgs('eliminated').length, 0);
  r.wait(PAUSE_MS);
  assert.equal(r.g.prompt.id, 'books');
});

test('categories are never repeated within a game', () => {
  const r = two();
  r.startAndIntro('Hannah');
  const seen = [r.g.prompt.id];
  for (let round = 0; round < 20; round++) {
    for (let i = 0; i < 6; i++) r.answer();
    r.wait(PAUSE_MS); r.wait(INTRO_MS);
    seen.push(r.g.prompt.id);
  }
  assert.equal(new Set(seen).size, seen.length);
});

// ------------------------------------------------------------ winner and recap

test('last one by the fire wins; recap has order, answers, rarest, round lasted to', () => {
  const r = four({ seed: 11 });
  r.startAndIntro('Hannah');
  r.answer();                          // order[0] answers
  for (let k = 0; k < 3; k++) {        // three timeouts
    r.t = r.g.deadline + GRACE_MS + 1;
    r.ev({ type: 'alarm' });
    if (r.s.phase !== 'game') break;
    r.wait(PAUSE_MS); r.wait(INTRO_MS);
  }
  const over = r.lastMsg('gameOver');
  assert.ok(over.recap.winnerId);
  assert.equal(r.s.phase, 'lobby');
  const rec = over.recap;
  assert.equal(rec.players.length, 4);
  const places = rec.players.map(p => p.place).sort();
  assert.deepEqual(places, [1, 2, 3, 4]);
  const winner = rec.players.find(p => p.place === 1);
  assert.equal(winner.id, rec.winnerId);
  assert.equal(winner.outRound, null);
  const scorer = rec.players.find(p => p.answers.length);
  assert.ok(scorer.rarest && scorer.rarest.answer);
  for (const p of rec.players) assert.ok(p.lastedTo >= 1);
});

test('rematch starts a new game with everyone connected, including late joiners', () => {
  const r = two();
  r.startAndIntro('Hannah');
  r.join('Late');
  assert.equal(r.s.players[r.pid('Late')].inGame, false);           // spectates
  assert.ok(!r.g.order.includes(r.pid('Late')));
  r.t = r.g.deadline + GRACE_MS + 1; r.ev({ type: 'alarm' });          // 2 players: game over
  assert.equal(r.s.phase, 'lobby');
  r.as('Hannah', { type: 'rematch' });
  assert.equal(r.s.phase, 'game');
  assert.ok(r.g.order.includes(r.pid('Late')));
  assert.equal(r.g.order.length, 3);
});

// ------------------------------------------------------------ disconnects

test('disconnected while waiting: seat stays, timer runs, out if not back in time', () => {
  const r = four({ seed: 5 });
  r.startAndIntro('Hannah');
  const second = r.nameOf(r.g.order[1]);
  r.as(second, { type: 'disconnect' });
  assert.ok(r.g.order.includes(r.pid(second)));
  r.answer();
  assert.equal(r.holderName(), second);
  r.t = r.g.deadline + GRACE_MS + 1; r.ev({ type: 'alarm' });
  assert.equal(r.lastMsg('eliminated').playerId, r.pid(second));
});

test('reconnect mid-turn: full snapshot with the same seat and the real deadline', () => {
  const r = four();
  r.startAndIntro('Hannah');
  const h = r.holderName(), dl = r.g.deadline;
  r.as(h, { type: 'disconnect' });
  r.wait(4000);
  const res = r.join(h);
  const snap = res.effects.find(f => f.msg.type === 'snapshot').msg;
  assert.equal(snap.you, r.pid(h));
  assert.equal(snap.game.holderId, r.pid(h));
  assert.equal(snap.game.deadline, dl);              // not reset by the reconnect
  assert.equal(snap.now, r.t);
  assert.equal(snap.game.deadline - snap.now, 15000 - 4000);
  r.as(h, { type: 'submit', text: r.freshAnswer() });
  assert.equal(r.lastMsg('answerAccepted').playerId, r.pid(h));
});

test('host disconnect: host passes to the longest-connected player after 15 s', () => {
  const r = new Room();
  r.join('Hannah'); r.wait(10); r.join('Eli'); r.wait(10); r.join('Ruth');
  r.as('Hannah', { type: 'disconnect' });
  r.wait(HOST_GRACE_MS - 1);
  assert.equal(r.s.hostId, r.pid('Hannah'));
  r.wait(1);
  assert.equal(r.s.hostId, r.pid('Eli'));
  assert.equal(r.lastMsg('host').hostId, r.pid('Eli'));
});

test('host who comes back within 15 s stays host', () => {
  const r = two();
  r.as('Hannah', { type: 'disconnect' });
  r.wait(5000);
  r.join('Hannah');
  r.wait(20000);
  assert.equal(r.s.hostId, r.pid('Hannah'));
});

test('host who leaves passes the role at once', () => {
  const r = four();
  r.as('Hannah', { type: 'leave' });
  assert.equal(r.s.hostId, r.pid('Eli'));
  assert.equal(r.out.find(f => f.kind === 'close').reason, 'left');
});

test('everyone leaves mid-game: the game ends with no winner and the room resets', () => {
  const r = four();
  r.startAndIntro('Hannah');
  for (const n of ['Hannah', 'Eli', 'Ruth', 'Boaz']) r.as(n, { type: 'disconnect' });
  assert.equal(r.s.phase, 'lobby');
  assert.equal(r.s.game, null);
  assert.equal(r.lastMsg('gameOver').reason, 'abandoned');
  assert.equal(r.s.cleanupAt, r.t + CLEANUP_MS);
  r.wait(LOBBY_DROP_MS);
  assert.equal(Object.keys(r.s.players).length, 0);
  r.t = r.s.cleanupAt;
  const res = r.ev({ type: 'alarm' });
  assert.ok(res.effects.some(f => f.kind === 'purge'));
  assert.equal(res.alarm, null);
});

test('lobby: a disconnected player is dropped after 60 s; a refresh before that keeps the seat', () => {
  const r = two();
  r.as('Eli', { type: 'disconnect' });
  r.wait(LOBBY_DROP_MS - 1);
  assert.ok(r.s.players[r.pid('Eli')]);
  r.wait(1);
  assert.equal(r.s.players[r.pid('Eli')], undefined);
});

test('removed by the host while holding the coal: the coal passes at once', () => {
  const r = four({ seed: 2 });
  r.startAndIntro('Hannah');
  if (r.holderName() === 'Hannah') r.answer();   // make sure the holder is not the host
  const h = r.holderName(), next = r.g.order[(r.g.order.indexOf(r.g.holderId) + 1) % 4];
  r.wait(5000);
  r.as('Hannah', { type: 'kick', target: r.pid(h) });
  assert.equal(r.s.players[r.pid(h)], undefined);
  assert.equal(r.g.holderId, next);
  assert.equal(r.g.deadline, r.t + r.g.turnMs);
  assert.ok(r.out.some(f => f.kind === 'close' && f.reason === 'removed'));
  // They cannot come back with the same token.
  r.join(h);
  assert.equal(r.lastMsg('error').code, 'removed');
});

test('kick: host only, never the host', () => {
  const r = four();
  r.as('Eli', { type: 'kick', target: r.pid('Ruth') });
  assert.ok(r.s.players[r.pid('Ruth')]);
  r.as('Hannah', { type: 'kick', target: r.pid('Hannah') });
  assert.ok(r.s.players[r.pid('Hannah')]);
});

test('removing a player down to one ends the game with a winner', () => {
  const r = two();
  r.startAndIntro('Hannah');
  r.as('Hannah', { type: 'kick', target: r.pid('Eli') });
  assert.equal(r.lastMsg('gameOver').recap.winnerId, r.pid('Hannah'));
});

// ------------------------------------------------------------ typing

test('live typing: only the holder, forwarded to everyone else, capped length, not persisted', () => {
  const r = four();
  r.startAndIntro('Hannah');
  const h = r.holderName(), other = ['Hannah', 'Eli', 'Ruth', 'Boaz'].find(n => n !== h);
  const res = r.as(h, { type: 'typing', text: 'Moses'.padEnd(100, 's') });
  assert.equal(res.persist, false);
  const m = res.effects[0];
  assert.equal(m.except, r.pid(h));
  assert.equal(m.msg.text.length, 60);
  const res2 = r.as(other, { type: 'typing', text: 'nope' });
  assert.equal(res2.effects.length, 0);
});

// ------------------------------------------------------------ persistence

test('state survives a JSON round trip (hibernation) mid-turn', () => {
  const r = four();
  r.startAndIntro('Hannah');
  r.answer();
  const copy = JSON.parse(JSON.stringify(r.s));
  assert.deepEqual(copy, r.s);
  const a = reduce(r.s, { type: 'alarm' }, r.g.deadline + GRACE_MS + 1, realCatalog);
  const b = reduce(copy, { type: 'alarm' }, r.g.deadline + GRACE_MS + 1, realCatalog);
  assert.deepEqual(a.state, b.state);
  assert.deepEqual(a.effects, b.effects);
});

test('the alarm is always the earliest pending timer', () => {
  const r = two();
  assert.equal(nextAlarm(r.s), null);
  r.as('Eli', { type: 'disconnect' });
  assert.equal(r.last.alarm, r.t + LOBBY_DROP_MS);
  r.as('Hannah', { type: 'disconnect' });
  assert.equal(r.last.alarm, r.t - 0 + HOST_GRACE_MS);
});

test('initial state is plain JSON', () => {
  const s = initialState('SHORE', 1, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});
