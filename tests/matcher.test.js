// Run with: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/matcher.js');
const Round = require('../js/round.js');

const TIERS = [
  { id: 1, points: 10 }, { id: 2, points: 15 }, { id: 3, points: 30 },
  { id: 4, points: 60 }, { id: 5, points: 85 }, { id: 6, points: 100 }
];

const people = {
  id: 'fixture-people',
  answers: [
    { name: 'Mary', aliases: [], tier: 1 },
    { name: 'Elijah', aliases: ['Elias'], tier: 1 },
    { name: 'Moses', aliases: [], tier: 1 },
    { name: 'Mark', aliases: [], tier: 3 },
    { name: 'Nebuchadnezzar', aliases: ['Nebuchadrezzar'], tier: 4 },
    { name: 'Melchizedek', aliases: ['Melchisedec'], tier: 5 },
    { name: 'Prodigal Son', aliases: [], forms: ['the prodigal'], tier: 1 },
    { name: "Solomon's Porch", aliases: [], tier: 5 },
    { name: 'Hagar', aliases: ['Agar'], tier: 3 },
    { name: 'Dorcas', aliases: ['Tabitha'], tier: 6 }
  ],
  nearMisses: [
    { name: 'Balthazar', aliases: ['Balthasar', 'Caspar', 'Melchior'], message: 'Matthew never names the wise men (Matthew 2:1).' }
  ]
};
const books = {
  id: 'fixture-books',
  ignoreWords: ['book'],
  answers: [
    { name: '1 Kings', aliases: [], short: ['1 Kgs', '1 Ki'], tier: 3 },
    { name: '2 Kings', aliases: [], short: ['2 Kgs'], tier: 4 },
    { name: '1 Corinthians', aliases: [], short: ['1 Cor'], tier: 1 },
    { name: 'Genesis', aliases: [], tier: 1 }
  ],
  nearMisses: [{ name: 'Revelation', aliases: ['Revelations'], message: 'Revelation is usually classed as prophecy (Revelation 1:3).' }]
};
const P = M.compile(people);
const B = M.compile(books);
const ev = (s, c = P) => M.evaluate(s, c);

test('exact match is accepted', () => {
  const r = ev('Moses');
  assert.equal(r.type, 'accept');
  assert.equal(r.answer.name, 'Moses');
});

test('case, spacing and accents do not matter', () => {
  assert.equal(ev('  mOSES ').type, 'accept');
  assert.equal(ev('Élijah').answer.name, 'Elijah');
});

test('an alias is accepted as its answer', () => {
  const r = ev('Tabitha');
  assert.equal(r.type, 'accept');
  assert.equal(r.answer.name, 'Dorcas');
});

test('KJV spellings are accepted', () => {
  assert.equal(ev('Elias').answer.name, 'Elijah');
  assert.equal(ev('Agar').answer.name, 'Hagar');
  assert.equal(ev('Melchisedec').answer.name, 'Melchizedek');
});

test('a typo is suggested, never accepted', () => {
  const r = ev('prodigle son');
  assert.equal(r.type, 'suggest');
  assert.equal(r.reason, 'typo');
  assert.equal(r.answer.name, 'Prodigal Son');
  // one typo allowed at 4-6 letters, two at 7+, none under 4
  assert.equal(ev('Mosez').type, 'suggest');
  assert.equal(ev('Mosezz').type, 'miss');
  assert.equal(ev('Nebuchadnezar').type, 'suggest');
  assert.equal(ev('Mry').type, 'miss');
});

test('confirming a suggestion: casting the suggested name is accepted', () => {
  const s = ev('Melchizedeck');
  assert.equal(s.type, 'suggest');
  const r = ev(s.answer.name);
  assert.equal(r.type, 'accept');
  assert.equal(r.answer.name, 'Melchizedek');
});

test('editing after a suggestion is evaluated afresh', () => {
  const s = ev('Mosez');
  assert.equal(s.answer.name, 'Moses');
  assert.equal(ev('Mark').answer.name, 'Mark');       // edited to something else
  assert.equal(ev('pizza').type, 'miss');            // or to nonsense
});

test('a prefix is suggested', () => {
  const a = ev('Melchiz');
  assert.equal(a.type, 'suggest');
  assert.equal(a.reason, 'prefix');
  assert.equal(a.answer.name, 'Melchizedek');
  assert.equal(ev('Nebuchad').answer.name, 'Nebuchadnezzar');
  assert.equal(ev('Mel').type, 'miss');               // too short to guess from
});

test('a short form is suggested', () => {
  const r = ev('1 Cor', B);
  assert.equal(r.type, 'suggest');
  assert.equal(r.reason, 'short');
  assert.equal(r.answer.name, '1 Corinthians');
  assert.equal(ev('1 Kgs', B).answer.name, '1 Kings');
});

test('a tie between equally close answers suggests the more common one', () => {
  const r = ev('Marx');                               // one edit from Mary and from Mark
  assert.equal(r.type, 'suggest');
  assert.equal(r.answer.name, 'Mary');
});

test('a near miss returns its message and the round continues', () => {
  const r = ev('Caspar');
  assert.equal(r.type, 'near');
  assert.match(r.nearMiss.message, /never names/);
  const round = Round.create({ compiled: P, tiers: TIERS, limitMs: 25000, startedAt: 0 });
  const g = round.cast('Caspar', 1000);
  assert.equal(g.type, 'near');
  assert.equal(g.done, false);
  assert.equal(round.state.done, false);
  assert.equal(round.cast('Mary', 2000).done, true);
});

test('a non-answer misses and the player can cast again', () => {
  const round = Round.create({ compiled: P, tiers: TIERS, limitMs: 25000, startedAt: 0 });
  const a = round.cast('pizza', 500);
  assert.equal(a.type, 'miss');
  assert.equal(a.done, false);
  const b = round.cast('Dorcas', 900);
  assert.equal(b.type, 'accept');
  assert.equal(b.points, 100);
  assert.deepEqual(round.state.guesses.map(g => g.type), ['miss', 'accept']);
});

test('a suggestion does not end the round; casting it does', () => {
  const round = Round.create({ compiled: P, tiers: TIERS, limitMs: 25000, startedAt: 0 });
  const s = round.cast('prodigle son', 100);
  assert.equal(s.type, 'suggest');
  assert.equal(round.state.done, false);
  const r = round.cast(s.answer.name, 200);
  assert.equal(r.type, 'accept');
  assert.equal(r.points, 10);
});

test('timeout scores +0', () => {
  const round = Round.create({ compiled: P, tiers: TIERS, limitMs: 25000, startedAt: 0 });
  assert.equal(round.tick(24999), null);
  round.cast('pizza', 3000);
  const t = round.tick(25000);
  assert.equal(t.type, 'timeout');
  assert.equal(t.points, 0);
  assert.equal(round.cast('Mary', 25001).type, 'timeout');   // too late
});

test('a typo never matches a near miss', () => {
  assert.equal(ev('Balthazar').type, 'near');
  assert.notEqual(ev('Balthazzar').type, 'near');
  assert.notEqual(ev('Caspr').type, 'near');
  assert.notEqual(ev('Revelatoin', B).type, 'near');
});

test('possessives are ignored', () => {
  assert.equal(ev("Solomon's Porch").type, 'accept');
  assert.equal(ev('Solomons porch').type, 'accept');
  assert.equal(ev('solomon’s porch').type, 'accept');
});

test('book numbers: 1st, First and I all mean 1', () => {
  for (const s of ['1 Kings', '1st Kings', 'First Kings', 'I Kings', '1Kings', 'the first book of Kings']) {
    const r = ev(s, B);
    assert.equal(r.type, 'accept', s);
    assert.equal(r.answer.name, '1 Kings', s);
  }
  assert.equal(ev('II Kings', B).answer.name, '2 Kings');
  assert.equal(ev('Second Kings', B).answer.name, '2 Kings');
  assert.notEqual(ev('3 Kings', B).type, 'accept');        // digits never fuzzed across
});

test('a word in the middle of a name is not read as a numeral', () => {
  const c = M.compile({ answers: [{ name: 'I AM', aliases: [], tier: 5 }, { name: 'Ruth', aliases: [], tier: 1 }], nearMisses: [] });
  assert.equal(M.evaluate('I am', c).type, 'accept');
  assert.equal(M.tokens('Ruth I').join(' '), 'ruth i');
});

test('a missing letter is still only a suggestion', () => {
  assert.equal(ev('Mose').type, 'suggest');
  assert.equal(ev('Revelations', B).type, 'near');
});

test('a singular lands on a plural answer, and a plural on a singular one', () => {
  const c = M.compile({ nouns: true, answers: [{ name: 'Cucumbers', aliases: [], tier: 6 }, { name: 'Fig', aliases: [], tier: 1 }, { name: 'Lilies', aliases: [], tier: 5 }], nearMisses: [] });
  assert.equal(M.evaluate('cucumber', c).type, 'accept');
  assert.equal(M.evaluate('figs', c).type, 'accept');
  assert.equal(M.evaluate('lily', c).type, 'accept');
});

test('a long fragment prefers the answer it starts over a typo of a shorter one', () => {
  const c = M.compile({ answers: [{ name: 'Melchi', aliases: [], tier: 5 }, { name: 'Melchizedek', aliases: [], tier: 4 }], nearMisses: [] });
  const r = M.evaluate('Melchiz', c);
  assert.equal(r.type, 'suggest');
  assert.equal(r.answer.name, 'Melchizedek');
  assert.equal(M.evaluate('Melchy', c).answer.name, 'Melchi');   // still a typo of Melchi
});
