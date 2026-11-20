import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realCatalog as c } from './helpers.js';
import { parseClient, makeLimiter, limit } from '../../src/protocol.js';

test('every category in a game has at least 3 x players + 10 answers', () => {
  for (let n = 2; n <= 16; n++) {
    for (const e of c.eligible(n, [])) assert.ok(e.groups >= 3 * n + 10, e.id + ' for ' + n);
  }
});

test('closed sets only while they cannot run out in the first rotation', () => {
  const ids = (n) => c.eligible(n, []).map(e => e.id);
  assert.ok(ids(2).includes('apostles'));            // 16 answers, 2 players
  assert.ok(!ids(3).includes('apostles'));
  assert.ok(ids(8).includes('books'));               // 66 answers
  assert.ok(!ids(2).includes('seven-churches'));     // 7 answers: never
  assert.ok(!ids(2).includes('plagues'));
  for (const e of c.eligible(16, [])) if (e.closed) assert.ok(e.groups - 16 >= 10);
});

test('there are enough categories for a long game at every table size', () => {
  for (let n = 2; n <= 16; n++) assert.ok(c.eligible(n, []).length >= 30, n + ' players: ' + c.eligible(n, []).length);
});

test('early rounds draw friendlier (broader) categories than late rounds', () => {
  let s = 1;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const avg = (round) => {
    let t = 0;
    for (let i = 0; i < 300; i++) t += c.pick({ players: 6, round, used: [], rand }).ease;
    return t / 300;
  };
  assert.ok(avg(1) > avg(8) * 1.3, avg(1) + ' vs ' + avg(8));
});

test('pick never returns a used prompt', () => {
  const used = c.eligible(4, []).slice(0, 20).map(e => e.id);
  for (let i = 0; i < 50; i++) assert.ok(!used.includes(c.pick({ players: 4, round: 1, used, rand: Math.random }).id));
});

test('aliases share a group: Simon Peter, Peter and Cephas are one answer', () => {
  const g = (t) => { const r = c.evaluate('apostles', t); return c.answer('apostles', r.index).group; };
  assert.equal(g('Simon Peter'), g('Peter'));
  assert.equal(g('Cephas'), g('Peter'));
  assert.notEqual(g('Andrew'), g('Peter'));
});

// ------------------------------------------------------------ protocol

const msg = (o) => JSON.stringify({ v: 1, ...o });
test('protocol: known intents with the right fields pass', () => {
  assert.deepEqual(parseClient(msg({ type: 'submit', text: 'Moses' })), { type: 'submit', text: 'Moses' });
  assert.deepEqual(parseClient(msg({ type: 'join', token: 'a'.repeat(20), name: 'Hi' })), { type: 'join', token: 'a'.repeat(20), name: 'Hi' });
  assert.deepEqual(parseClient(msg({ type: 'start' })), { type: 'start' });
  assert.deepEqual(parseClient(msg({ type: 'ping', t: 5 })), { type: 'ping', t: 5 });
});
test('protocol: everything else is dropped', () => {
  for (const bad of [
    'not json', '[]', 'null', JSON.stringify({ type: 'start' }),            // no version
    JSON.stringify({ v: 2, type: 'start' }),
    msg({ type: 'eliminate' }), msg({ type: '__proto__' }), msg({ type: 'constructor' }),
    msg({ type: 'submit' }), msg({ type: 'submit', text: 5 }),
    msg({ type: 'submit', text: 'x'.repeat(201) }),
    msg({ type: 'submit', text: 'x', extra: 1 }),
    msg({ type: 'join', token: 'short', name: 'Hi' }),
    msg({ type: 'join', token: 'a'.repeat(20) + '!', name: 'Hi' }),
    msg({ type: 'ping', t: 'now' }),
    'x'.repeat(600)
  ]) assert.equal(parseClient(bad), null, bad.slice(0, 60));
});

test('rate limit: 20 intents a second; typing capped on its own; persistent flooding closes', () => {
  const l = makeLimiter(0);
  let ok = 0;
  for (let i = 0; i < 40; i++) if (limit(l, 'submit', 0) === 'ok') ok++;
  assert.equal(ok, 20);
  // Typing has its own bucket, so it still flows.
  assert.equal(limit(l, 'typing', 0), 'ok');
  // One second later, 20 more.
  ok = 0;
  for (let i = 0; i < 40; i++) if (limit(l, 'submit', 1000) === 'ok') ok++;
  assert.equal(ok, 20);
  let res;
  for (let i = 0; i < 100; i++) res = limit(l, 'submit', 1000);
  assert.equal(res, 'close');
  // Typing over 8 a second (after a small burst) is dropped.
  const t = makeLimiter(0);
  let sent = 0;
  for (let ms = 0; ms < 5000; ms += 20) if (limit(t, 'typing', ms) === 'ok') sent++;
  assert.ok(sent <= 8 * 5 + 10, 'typing ' + sent);
});
