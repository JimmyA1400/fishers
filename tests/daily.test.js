'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const D = require('../js/daily.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'prompts.json'), 'utf8'));
const CFG = { epoch: '2026-11-17', promptsPerDay: 7 };

test('a daily cast is the same every time for the same date', () => {
  const a = D.pickDaily(data, '2026-12-25', CFG).map(p => p.id);
  const b = D.pickDaily(data, '2026-12-25', CFG).map(p => p.id);
  assert.deepEqual(a, b);
});

test('every daily for two years: 7 prompts, 7 categories, exactly one closed set', () => {
  let key = '2026-11-17';
  for (let i = 0; i < 730; i++) {
    const cast = D.pickDaily(data, key, CFG);
    assert.equal(cast.length, 7, key);
    assert.equal(new Set(cast.map(p => p.category)).size, 7, key + ' repeats a category');
    assert.equal(cast.filter(p => p.closed).length, 1, key + ' should have exactly one closed set');
    key = D.addDays(key, 1);
  }
});

test('endless casts follow the same rules and are numbered deterministically', () => {
  for (let n = 1; n <= 200; n++) {
    const cast = D.pickEndless(data, n, CFG);
    assert.equal(cast.length, 7);
    assert.equal(new Set(cast.map(p => p.category)).size, 7);
    assert.equal(cast.filter(p => p.closed).length, 1);
  }
  assert.deepEqual(D.pickEndless(data, 3, CFG).map(p => p.id), D.pickEndless(data, 3, CFG).map(p => p.id));
});

test('every prompt gets used across a year of dailies', () => {
  const seen = new Set();
  let key = '2026-11-17';
  for (let i = 0; i < 365; i++) { D.pickDaily(data, key, CFG).forEach(p => seen.add(p.id)); key = D.addDays(key, 1); }
  const missing = data.prompts.filter(p => !seen.has(p.id)).map(p => p.id);
  assert.deepEqual(missing, []);
});

test('every closed set comes round within a cycle of dailies', () => {
  const closed = data.prompts.filter(p => p.closed).map(p => p.id);
  const seen = new Set();
  let key = '2026-11-17';
  for (let i = 0; i < closed.length; i++) { D.pickDaily(data, key, CFG).forEach(p => { if (p.closed) seen.add(p.id); }); key = D.addDays(key, 1); }
  assert.deepEqual(closed.filter(id => !seen.has(id)), []);
});
