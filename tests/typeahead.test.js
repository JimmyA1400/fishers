'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const TA = require('../js/typeahead.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'prompts.json'), 'utf8'));
const ta = TA.create(data.lexicon);

test('completes a name from its first letters', () => {
  assert.equal(ta.complete('Melchiz'), 'Melchizedek');
  assert.equal(ta.complete('nebu'), 'Nebuchadnezzar');
  assert.equal(ta.complete('zacc'), 'Zacchaeus');
});

test('waits for three letters', () => {
  assert.equal(ta.complete('ne'), null);
  assert.equal(ta.complete(''), null);
});

test('ignores case, accents and apostrophes', () => {
  assert.equal(ta.complete('MELCHIZ'), 'Melchizedek');
  assert.equal(ta.complete('Élij'), ta.complete('elij'));
});

test('completes phrases and book numbers', () => {
  assert.equal(ta.complete('lamb of'), 'Lamb of God');
  assert.equal(ta.complete('1 cor'), '1 Corinthians');
});

test('offers nothing for text no Bible word starts with', () => {
  assert.equal(ta.complete('pizz'), null);
});

test('the shown remainder keeps what was typed', () => {
  assert.equal(TA.remainder('melch', 'Melchizedek'), 'izedek');
  assert.equal(TA.remainder('xyz', 'Melchizedek'), '');
});

test('the word list is the whole Bible, not one prompt', () => {
  // a creature, a place and a person all complete, whatever the prompt
  assert.ok(ta.complete('leviat'));
  assert.ok(ta.complete('capern'));
  assert.ok(data.lexicon.length > 4000);
});
