/* Live Coal accessibility pass: keyboard-only play for one player, axe scans
 * of every screen (setup, lobby, game, game over), the aria-live lines, and
 * reduced motion.
 *
 *   node a11y.js [--site URL] [--server URL]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const M = require('../../js/matcher.js');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i === -1 ? d : argv[i + 1]; };
const SITE = String(arg('site', 'http://localhost:8765/')).replace(/\/?$/, '/');
const SERVER = arg('server', null);
const OUT = path.join(__dirname, 'results', 'a11y');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) failures++; };
const url = (code) => SITE + (SERVER ? '?coal=' + encodeURIComponent(SERVER) : '') + '#/coal' + (code ? '/' + code : '');
const st = (p) => p.evaluate(() => { const s = FSHCoal.state(); const g = s.room && s.room.game; return { view: s.view, me: s.me, phase: s.room && s.room.phase, holder: g && g.holderId, stage: g && g.stage, prompt: g && g.prompt && g.prompt.id, said: g ? g.said.map(x => x.answer) : [] }; });
async function until(fn, ms = 20000) { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error('timeout'); await sleep(80); } }

async function axe(page, label) {
  const r = await new AxeBuilder({ page }).include('#coal').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const serious = r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  check(serious.length === 0, 'axe ' + label + ': ' + (serious.length ? serious.map(v => v.id + ' (' + v.nodes.length + ')').join(', ') : 'no serious or critical issues') +
    (r.violations.length - serious.length ? ' · minor: ' + r.violations.filter(v => !serious.includes(v)).map(v => v.id).join(', ') : ''));
  return r;
}

// Keyboard: Tab until the element matching sel has focus, then return.
async function tabTo(page, sel, max = 40) {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate((s) => document.activeElement && document.activeElement.matches(s), sel)) return true;
    await page.keyboard.press('Tab');
  }
  return false;
}

(async () => {
  const bank = await (await fetch(SITE + 'data/prompts.json')).json();
  const browser = await chromium.launch();
  const kb = await browser.newContext({ viewport: { width: 1100, height: 820 }, reducedMotion: 'reduce' });
  const other = await browser.newContext(devices['Pixel 7']);
  const A = await kb.newPage(), B = await other.newPage();

  // --- setup screen, by keyboard
  await A.goto(url());
  await A.waitForSelector('#c-name');
  await axe(A, 'setup');
  check(await A.evaluate(() => document.activeElement.id === 'c-name'), 'name field has focus on arrival');
  await A.keyboard.type('Keys');
  await A.keyboard.press('Tab');                 // into the fish radios
  await A.keyboard.press('ArrowRight');          // pick another fish
  check(await tabTo(A, '#c-setup button[type=submit]'), 'Tab reaches "Sit by the fire"');
  await A.keyboard.press('Enter');
  await A.waitForSelector('#c-lobby-title');
  check(true, 'joined The Shore by keyboard');
  // Create a private room by keyboard.
  check(await tabTo(A, '.coal-more summary'), 'Tab reaches "More"');
  await A.keyboard.press('Enter');
  check(await tabTo(A, '#c-create'), 'Tab reaches "Create a private room"');
  await A.keyboard.press('Enter');
  await A.waitForURL(/#\/coal\/[A-Z]{4}$/);
  const code = /([A-Z]{4})$/.exec(A.url())[1];
  await A.waitForSelector('#c-lobby-title');
  await B.goto(url(code));
  await B.fill('#c-name', 'Tapper');
  await B.click('#c-setup button[type=submit]');
  await until(async () => (await A.$$('.coal-player')).length === 2);
  await axe(A, 'lobby (host)');
  await axe(B, 'lobby (phone)');

  // --- start by keyboard
  check(await tabTo(A, '#c-start'), 'Tab reaches "Light the fire"');
  await A.keyboard.press('Enter');
  await until(async () => (await st(A)).view === 'game');
  const intro = await A.textContent('#c-intro');
  check(/Round 1 · get ready/.test(intro), 'round intro shows "Round 1 · get ready"');
  await until(async () => (await st(A)).stage === 'turn');
  await sleep(300);
  await axe(A, 'game');
  // Live regions announce whose turn it is.
  const s = await st(A);
  const liveText = await A.evaluate(() => document.getElementById('coal-live').textContent + ' | ' + document.getElementById('coal-alert').textContent);
  check(/Your turn|has the coal/.test(liveText), 'aria-live: "' + liveText.trim() + '"');
  // Play one turn each by keyboard / tap, then let A's coal go out.
  const p = bank.prompts.find(x => x.id === s.prompt);
  const c = M.compile(p);
  const fresh = (said) => p.answers.find((a, i) => !said.includes(a.name) && M.evaluate(a.name, c).index === i).name;
  for (let k = 0; k < 2; k++) {
    const now = await st(A);
    const holderPage = now.holder === now.me ? A : B;
    if (holderPage === A) {
      check(await A.evaluate(() => document.activeElement && document.activeElement.id === 'c-answer'), 'your turn: the answer box has focus');
      await A.keyboard.type(fresh(now.said));
      await A.keyboard.press('Enter');
    } else {
      await B.fill('#c-answer', fresh(now.said));
      await B.press('#c-answer', 'Enter');
    }
    await until(async () => (await st(A)).said.length === k + 1);
  }
  check(true, 'two answers passed the coal');
  // Reduced motion: the coal does not flicker, the fire does not pulse.
  const anim = await A.evaluate(() => getComputedStyle(document.querySelector('.coal-light')).animationName);
  check(anim === 'none', 'reduced motion: fire glow animation is ' + anim);
  // Wait for someone's coal to go out; with 2 players that ends the game.
  await until(async () => (await st(A)).view === 'over', 40000);
  await sleep(200);   // live regions are cleared, then filled, so screen readers repeat them
  const alertText = await A.evaluate(() => document.getElementById('coal-alert').textContent);
  check(/wins|No winner|coal went out/.test(alertText), 'aria-live winner: "' + alertText + '"');
  await sleep(400);
  await axe(A, 'game over');
  check(await A.evaluate(() => document.activeElement && document.activeElement.id === 'c-over-title'), 'game over: focus moves to the result');
  await A.screenshot({ path: path.join(OUT, 'over-keyboard.png') });
  await browser.close();
  console.log(failures ? '\n' + failures + ' check(s) failed' : '\nAll accessibility checks passed.');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
