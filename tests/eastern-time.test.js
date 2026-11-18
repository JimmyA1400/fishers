// The Daily Cast follows the date in New York for everyone, whatever the
// device's time zone. Each case runs in a child process with TZ set, the way
// a phone in another zone would see it.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

const DAILY = path.join(__dirname, '..', 'js', 'daily.js');

function inZone(tz, code) {
  const out = execFileSync(process.execPath, ['-e',
    'const D = require(' + JSON.stringify(DAILY) + '); const r = (' + code + '); process.stdout.write(JSON.stringify(r));'],
    { env: Object.assign({}, process.env, { TZ: tz }) });
  return JSON.parse(out.toString());
}

const ZONES = ['America/New_York', 'America/Los_Angeles', 'UTC', 'Asia/Tokyo'];

for (const tz of ZONES) {
  test('date key is the Eastern date on a device set to ' + tz, () => {
    const r = inZone(tz, `[
      D.dateKey(new Date('2026-11-18T04:59:59Z')),
      D.dateKey(new Date('2026-11-18T05:00:00Z')),
      D.dateKey(new Date('2026-11-19T00:30:00Z')),
      D.dateKey(new Date('2026-07-04T03:59:59Z')),
      D.dateKey(new Date('2026-07-04T04:00:00Z'))
    ]`);
    // 23:59:59 EST, then midnight EST; 19:30 EST on the 18th (already the
    // 19th in UTC); and the same edge in summer (EDT, UTC-4).
    assert.deepEqual(r, ['2026-11-17', '2026-11-18', '2026-11-18', '2026-07-03', '2026-07-04']);
  });

  test('next cast counts down to midnight Eastern on a device set to ' + tz, () => {
    const r = inZone(tz, `[
      D.msToNextCast(new Date('2026-11-18T04:59:59Z')),
      D.msToNextCast(new Date('2026-11-18T05:00:00Z')),
      D.msToNextCast(new Date('2026-11-19T00:30:00Z')),
      D.msToNextCast(new Date('2026-11-01T04:00:00Z')),
      D.msToNextCast(new Date('2027-03-14T05:00:00Z'))
    ]`);
    const H = 3600000;
    assert.deepEqual(r, [
      1000,        // one second to midnight
      24 * H,      // a fresh day
      4.5 * H,     // 19:30 Eastern
      25 * H,      // clocks fall back on 2026-11-01: a 25-hour day
      23 * H       // clocks spring forward on 2027-03-14: a 23-hour day
    ]);
  });
}

test('a device in Pacific and one in UTC get the same cast near midnight', () => {
  const data = path.join(__dirname, '..', 'data', 'prompts.json');
  const code = `(function () {
    const bank = JSON.parse(require('fs').readFileSync(${JSON.stringify(data)}, 'utf8'));
    const at = new Date('2026-11-19T04:30:00Z');   // 23:30 Eastern on the 18th; 20:30 Pacific; 04:30 UTC on the 19th
    const key = D.dateKey(at);
    return { key, ids: D.pickDaily(bank, key, { epoch: '2026-11-17' }).map(p => p.id), n: D.dayNumber(key, '2026-11-17') + 1 };
  })()`;
  const pac = inZone('America/Los_Angeles', code);
  const utc = inZone('UTC', code);
  assert.equal(pac.key, '2026-11-18');
  assert.deepEqual(pac, utc);
  assert.equal(pac.n, 2, 'Fishers #N counts from the launch date');
});

test('streaks use the Eastern date', () => {
  // The day after an Eastern date is computed on the calendar, not the clock.
  const D = require(DAILY);
  assert.equal(D.addDays('2026-11-17', 1), '2026-11-18');
  assert.equal(D.addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(D.addDays('2026-11-01', -1), '2026-10-31');
});
