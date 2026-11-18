'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const D = require('../js/daily.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'prompts.json'), 'utf8'));
const CFG = { epoch: '2026-11-17', promptsPerDay: 7 };

test('weeks start on Monday', () => {
  assert.equal(D.weekStart('2026-11-16'), '2026-11-16');   // Monday
  assert.equal(D.weekStart('2026-11-22'), '2026-11-16');   // Sunday
  assert.equal(D.weekStart('2026-11-23'), '2026-11-23');
  assert.equal(D.weekStart('2027-01-01'), '2026-12-28');   // across the year
});

test('every day of a week gets the same theme cast', () => {
  const ids = (k) => D.pickThemeWeek(data, k, CFG).prompts.map((p) => p.id).join();
  const mon = ids('2026-11-23');
  for (let i = 1; i < 7; i++) assert.equal(ids(D.addDays('2026-11-23', i)), mon);
  assert.notEqual(ids('2026-11-30'), mon);
});

test('a theme cast is seven distinct prompts from that theme', () => {
  for (let w = 0; w < 20; w++) {
    const t = D.pickThemeWeek(data, D.addDays('2026-11-16', 7 * w), CFG);
    assert.equal(t.number, w + 1);
    assert.equal(t.prompts.length, 7);
    assert.equal(new Set(t.prompts.map((p) => p.id)).size, 7);
    t.prompts.forEach((p) => assert.equal(p.theme, t.theme));
    assert.ok(data.themes[t.theme] && data.themes[t.theme].length, 'theme has a reading');
  }
});

test('all eligible themes take a turn before one repeats', () => {
  const rot = D.themeRotation(data);
  const seen = [];
  for (let w = 0; w < rot.length; w++) seen.push(D.pickThemeWeek(data, D.addDays('2026-11-16', 7 * w), CFG).theme);
  assert.deepEqual([...seen].sort(), [...rot].sort());
});
