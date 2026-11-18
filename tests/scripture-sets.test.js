// Matching for the batch-2 Scripture sets, read straight from content/ so the
// tests don't depend on a build. Run with: node --test tests/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const M = require('../js/matcher.js');
const { parse } = require('../tools/build-prompts.js');

const file = path.join(__dirname, '..', 'content', 'scripture-sets.txt');
const prompts = Object.fromEntries(parse(fs.readFileSync(file, 'utf8'), 'scripture-sets.txt').map((p) => {
  p.answers.forEach((a) => { a.tier = a.special || a.tierOverride || 5; });
  return [p.id, M.compile(p)];
}));
const ev = (id, s) => M.evaluate(s, prompts[id]);
function lands(id, typed, name) {
  const r = ev(id, typed);
  assert.equal(r.type, 'accept', id + ': "' + typed + '" should land, got ' + r.type);
  assert.equal(r.answer.name, name, id + ': "' + typed + '"');
}
function nearMiss(id, typed) {
  assert.equal(ev(id, typed).type, 'near', id + ': "' + typed + '" should be a near miss');
}
function misses(id, typed) {
  assert.notEqual(ev(id, typed).type, 'accept', id + ': "' + typed + '" should not land');
}

test('I am sayings: key words and full sayings both land', () => {
  lands('i-am-sayings', 'light', 'Light of the world');
  lands('i-am-sayings', 'I am the light of the world', 'Light of the world');
  lands('i-am-sayings', 'bread', 'Bread of life');
  lands('i-am-sayings', 'the bread of life', 'Bread of life');
  lands('i-am-sayings', 'I am the good shepherd', 'Good shepherd');
  lands('i-am-sayings', 'the way the truth and the life', 'Way, the truth, and the life');
  lands('i-am-sayings', 'truth', 'Way, the truth, and the life');
  lands('i-am-sayings', 'resurrection and the life', 'Resurrection and the life');
  lands('i-am-sayings', 'the true vine', 'True vine');
  lands('i-am-sayings', 'gate', 'Door');
  lands('i-am-sayings', 'before Abraham was I am', 'Before Abraham was, I am');
});

test('I am sayings: "life" alone is ambiguous, and Revelation is not John', () => {
  nearMiss('i-am-sayings', 'life');
  nearMiss('i-am-sayings', 'I am the Alpha and the Omega');
  nearMiss('i-am-sayings', 'Lamb of God');
  misses('i-am-sayings', 'I am');
});

test('Sayings from the cross: key words land', () => {
  lands('cross-sayings', 'It is finished', 'It is finished');
  lands('cross-sayings', 'finished', 'It is finished');
  lands('cross-sayings', 'father forgive them', 'Father, forgive them');
  lands('cross-sayings', 'Eli Eli lama sabachthani', 'My God, my God, why have you forsaken me');
  lands('cross-sayings', 'why have you forsaken me', 'My God, my God, why have you forsaken me');
  lands('cross-sayings', 'today you will be with me in paradise', 'Today you will be with me in Paradise');
  lands('cross-sayings', 'I thirst', 'I thirst');
  lands('cross-sayings', "I'm thirsty", 'I thirst');
  lands('cross-sayings', 'into your hands I commit my spirit', 'Father, into your hands I commit my spirit');
  lands('cross-sayings', 'into thy hands', 'Father, into your hands I commit my spirit');
  lands('cross-sayings', 'woman behold your son', 'Woman, behold your son');
  lands('cross-sayings', 'behold your mother', 'Woman, behold your son');
});

test('Sayings from the cross: other people\'s words are near misses', () => {
  nearMiss('cross-sayings', 'remember me');
  nearMiss('cross-sayings', 'not my will');
  nearMiss('cross-sayings', 'truly this was the son of god');
  misses('cross-sayings', 'my god');
});

test('Raised from the dead: descriptions land on the right person', () => {
  lands('raised-from-dead', 'Lazarus', 'Lazarus');
  lands('raised-from-dead', "Jairus's daughter", "Jairus' daughter");
  lands('raised-from-dead', 'the daughter of Jairus', "Jairus' daughter");
  lands('raised-from-dead', 'the widow of Nain\'s son', "Widow of Nain's son");
  lands('raised-from-dead', 'Nain', "Widow of Nain's son");
  lands('raised-from-dead', 'the man thrown into Elisha\'s grave', "Man thrown into Elisha's grave");
  lands('raised-from-dead', 'Dorcas', 'Tabitha');
  lands('raised-from-dead', 'the Shunammite\'s son', "Shunammite woman's son");
  lands('raised-from-dead', 'Zarephath', "Widow of Zarephath's son");
});

test('Raised from the dead: Elijah, Enoch and Samuel are near misses; "widow\'s son" asks for the town', () => {
  nearMiss('raised-from-dead', 'Elijah');
  nearMiss('raised-from-dead', 'Enoch');
  nearMiss('raised-from-dead', 'Samuel');
  nearMiss('raised-from-dead', "the widow's son");
});

test('New names: either name lands on the same person', () => {
  lands('new-names', 'Abram', 'Abraham');
  lands('new-names', 'Israel', 'Jacob');
  lands('new-names', 'Cephas', 'Peter');
  lands('new-names', 'Saul', 'Paul');
  lands('new-names', 'Hadassah', 'Esther');
  lands('new-names', 'Belteshazzar', 'Daniel');
  lands('new-names', 'Zaphnath-paaneah', 'Joseph');
  lands('new-names', 'Magor-missabib', 'Pashhur');
  lands('new-names', 'Boanerges', 'James and John');
  nearMiss('new-names', 'Levi');
});

test('Giants: KJV plurals land; "giant" alone asks for a name', () => {
  lands('giants', 'Anakims', 'Anakim');
  lands('giants', 'Ishbibenob', 'Ishbi-benob');
  lands('giants', 'Sippai', 'Saph');
  nearMiss('giants', 'giant');
  nearMiss('giants', 'giants');
  nearMiss('giants', 'Samson');
});
