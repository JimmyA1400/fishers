// Plays one Practice Waters round of each prompt listed, through the UI:
// a typo (expect a suggestion), a near miss (expect its message), a key-word
// alias on phrase prompts, then the Lost Sheep typed in odd case (expect it to
// land as The Lost Sheep). Other prompts that come up are answered quickly.
//
//   node practice-new.js id1,id2,...   (default: the batch-2 prompts)
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');

const URL = 'http://localhost:8765/';
const data = JSON.parse(fs.readFileSync(path.join(H.REPO, 'data', 'prompts.json'), 'utf8'));
const BATCH2 = ['raised-from-dead', 'new-names', 'i-am-sayings', 'cross-sayings', 'giants', 'plagues', 'fruit-of-the-spirit', 'armor-of-god',
  'seven-churches', 'cities-of-refuge', 'psalm-writers', 'eden', 'from-heaven', 'kingdom-is-like', 'revelation', 'prisoners', 'who-wept', 'who-ran',
  'who-fasted', 'shepherds', 'blindness', 'names-of-god', 'holy-spirit-names', 'spiritual-gifts', 'solomons-temple', 'dreams-visions',
  'angel-encounters', 'colors', 'body-parts', 'diseases', 'measures-money'];
const targets = new Set((process.argv[2] || BATCH2.join(',')).split(','));
const byText = new Map(data.prompts.map((p) => [p.prompt, p]));

function typoOf(p) {
  const names = new Set(p.answers.flatMap((a) => [a.name].concat(a.aliases || [], a.forms || [])).map((s) => s.toLowerCase()));
  for (const a of p.answers.filter((x) => /^[A-Za-z]{6,}$/.test(x.name) && x.tier >= 3)) {
    const t = a.name.slice(0, 3) + a.name.slice(4);
    if (!names.has(t.toLowerCase())) return { typed: t, of: a.name };
  }
  return null;
}
function oddCase(s) { return '  ' + s.split('').map((c, i) => (i % 2 ? c.toLowerCase() : c.toUpperCase())).join('') + ' '; }

(async () => {
  const server = await H.ensureServer(URL);
  const run = await H.startRun('fishers', 'practice-new-prompts', { viewport: 'desktop', reducedMotion: 'reduce' });
  const { page } = run;
  // Practice leaves out today's daily prompts; --days-ahead N moves the date.
  const ahead = Number((process.argv.find((a) => a.startsWith('--days-ahead=')) || '').split('=')[1] || 0);
  if (ahead) await page.clock.setFixedTime(new Date(Date.now() + ahead * 86400000));
  const results = [];
  const cats = [...new Set(data.prompts.filter((p) => targets.has(p.id)).map((p) => p.category))];
  try {
    await page.goto(URL);
    await page.waitForFunction(() => document.getElementById('go') && !document.getElementById('go').hasAttribute('aria-busy'), null, { timeout: 20000 });
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    for (const cat of cats) {
      const want = data.prompts.filter((p) => p.category === cat && targets.has(p.id)).map((p) => p.id);
      const done = new Set();
      await page.goto(URL);
      await page.waitForSelector('#practice');
      await page.waitForFunction(() => !document.getElementById('go').hasAttribute('aria-busy'), null, { timeout: 20000 });
      await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
      await page.click('#practice');
      await page.waitForSelector('#pr-cat');
      await page.selectOption('#pr-cat', { label: cat });
      await page.uncheck('#pr-timer');
      await page.click('#pr-go');
      const total = data.prompts.filter((p) => p.category === cat).length;
      for (let round = 0; round < total + 2 && done.size < want.length; round++) {
        await page.waitForFunction(() => { const i = document.getElementById('answer'); return i && !i.disabled; }, null, { timeout: 20000 });
        const text = await page.textContent('#prompt-text');
        const p = byText.get(text);
        const cast = async (s) => {
          await page.fill('#answer', s);
          await page.press('#answer', 'Enter');
          await H.sleep(150);
          return page.evaluate(() => ({
            fb: (document.getElementById('feedback') || {}).textContent || '',
            cls: (document.getElementById('feedback') || {}).className || '',
            value: (document.getElementById('answer') || {}).value || '',
            landed: !!document.getElementById('net-tag') || !document.getElementById('answer') || document.getElementById('answer').disabled
          }));
        };
        if (p && targets.has(p.id) && !done.has(p.id)) {
          const r = { id: p.id, prompt: p.prompt, checks: [], problems: [] };
          const t = typoOf(p);
          if (t) {
            const s = await cast(t.typed);
            const ok = /suggest/.test(s.cls) && s.value === t.of && !s.landed;
            r.checks.push({ case: 'typo', typed: t.typed, expect: t.of, got: s.fb, ok });
            if (!ok) r.problems.push('typo "' + t.typed + '" gave: ' + (s.fb || '(landed)'));
          }
          for (const n of (p.nearMisses || []).slice(0, 1)) {
            const s = await cast(n.name);
            const ok = /near/.test(s.cls) && !s.landed;
            r.checks.push({ case: 'near miss', typed: n.name, got: s.fb, ok });
            if (!ok) r.problems.push('near miss "' + n.name + '" gave: ' + (s.fb || '(landed)'));
          }
          if (p.match === 'phrase') {
            const a = p.answers.find((x) => (x.aliases || []).some((al) => /^[a-z]+$/i.test(al) && al.length > 3));
            if (a) {
              const al = a.aliases.find((x) => /^[a-z]+$/i.test(x) && x.length > 3);
              r.checks.push({ case: 'phrase key word', typed: al, expect: a.name });
            }
          }
          const sheep = p.answers.find((a) => a.tier === 6);
          const s = await cast(oddCase(sheep.name));
          await page.waitForSelector('#rv-title', { timeout: 15000 }).catch(() => {});
          const title = await page.textContent('#rv-title').catch(() => '');
          const ok = /lost sheep/i.test(title);
          r.checks.push({ case: 'Lost Sheep in odd case', typed: oddCase(sheep.name), got: title, ok });
          if (!ok) r.problems.push('Lost Sheep "' + sheep.name + '" gave: ' + (title || s.fb));
          await run.shot(p.id);
          results.push(r);
          done.add(p.id);
          console.log((r.problems.length ? 'PROBLEM ' : 'ok      ') + p.id + (r.problems.length ? ': ' + r.problems.join(' | ') : ''));
        } else if (p) {
          await cast(p.answers[0].name);
          await page.waitForSelector('#rv-title', { timeout: 15000 }).catch(() => {});
        } else {
          results.push({ id: '?', prompt: text, problems: ['prompt text not found in data'] });
          break;
        }
        await page.waitForSelector('#next');
        await page.focus('#next');
        await page.keyboard.press('Enter');
      }
      for (const id of want) if (!done.has(id)) { results.push({ id, problems: ['never came up in Practice for ' + cat] }); console.log('MISSING ' + id); }
    }
  } catch (e) {
    results.push({ id: 'error', problems: [String(e).slice(0, 300)] });
    console.log('ERROR', String(e).slice(0, 300));
  }
  const fin = await run.finish();
  const file = H.writeResult('practice-new', { date: H.stamp(), results, log: fin.log, video: fin.video });
  console.log('Wrote', path.relative(H.REPO, file), '·', results.filter((r) => r.problems && r.problems.length).length, 'with problems');
  if (server) server.kill();
})();
