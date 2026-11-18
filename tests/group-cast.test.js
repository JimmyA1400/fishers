'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const D = require('../js/daily.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'prompts.json'), 'utf8'));
const CFG = { epoch: '2026-11-17', promptsPerDay: 7 };

test('group codes are normalized and length-checked', () => {
  assert.equal(D.groupCode(' grace-church '), 'GRACECHURCH');
  assert.equal(D.groupCode('ab'), '');
  assert.equal(D.groupCode('x'.repeat(13)), '');
  assert.match(D.newGroupCode(), /^[A-HJKMNP-Z2-9]{6}$/);
});

test('the same code gives the same cast; spelling variants agree', () => {
  const ids = (c) => D.pickGroup(data, c, CFG).map((p) => p.id).join();
  assert.equal(ids('Grace Church'), ids('GRACECHURCH'));
  assert.notEqual(ids('GRACE'), ids('HOPE'));
});

test('a group cast is seven distinct prompts, one closed set, varied categories', () => {
  for (const code of ['GRACE', 'HOPE', 'ABC234', 'FIRSTBAPTIST', 'K9K9K9']) {
    const ps = D.pickGroup(data, code, CFG);
    assert.equal(ps.length, 7);
    assert.equal(new Set(ps.map((p) => p.id)).size, 7);
    assert.equal(ps.filter((p) => p.closed).length >= 1, true);
    assert.equal(new Set(ps.map((p) => p.category)).size, 7);
  }
});
