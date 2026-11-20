/* Test helpers: a room driven by fake time, over the real prompt bank. */
import { createRequire } from 'node:module';
import { reduce, initialState } from '../../src/engine.js';
import { makeCatalog } from '../../src/catalog.js';

const require = createRequire(import.meta.url);
export const bank = require('../../../data/prompts.json');
export const matcher = require('../../../js/matcher.js');
export const realCatalog = makeCatalog(bank, matcher);

export function tok(n) { return ('token-' + n + '-xxxxxxxxxxxxxxxx').slice(0, 24); }

export class Room {
  constructor({ seed = 7, catalog = realCatalog, code = 'TEST' } = {}) {
    this.t = 1_000_000;
    this.catalog = catalog;
    this.s = initialState(code, seed, this.t);
    this.out = [];       // every effect, with the time it was produced
    this.ids = {};       // player name -> id
  }
  at(t) { this.t = t; return this; }
  wait(ms) { this.t += ms; return this.ev({ type: 'alarm' }); }
  ev(e, t) {
    if (t != null) this.t = t;
    const r = reduce(this.s, e, this.t, this.catalog);
    this.s = r.state;
    this.last = r;
    for (const f of r.effects) this.out.push({ t: this.t, ...f });
    return r;
  }
  join(name, n = name, extra = {}) {
    const r = this.ev({ type: 'join', token: tok(n), name, color: 'gold', ...extra });
    if (r.joined) this.ids[name] = r.joined;
    return r;
  }
  pid(name) { return this.ids[name]; }
  as(name, e) { return this.ev({ ...e, pid: this.ids[name] }); }
  get g() { return this.s.game; }
  holderName() { return this.nameOf(this.g && this.g.holderId); }
  nameOf(id) { return Object.keys(this.ids).find(k => this.ids[k] === id); }
  msgs(type) { return this.out.filter(f => f.msg && f.msg.type === type).map(f => f.msg); }
  lastMsg(type) { const m = this.msgs(type); return m[m.length - 1]; }
  // Start a game and run the round intro, so someone holds the coal.
  startAndIntro(host) {
    this.as(host, { type: 'start' });
    this.wait(3000);
    return this;
  }
  // An answer to the current prompt that nobody has said yet.
  freshAnswer(skip = 0) {
    const e = this.catalog.get(this.g.prompt.id);
    let n = 0;
    for (let i = 0; i < e.prompt.answers.length; i++) {
      if (this.g.used[e.groupOf[i]]) continue;
      // Only answers whose own name lands on themselves.
      const r = this.catalog.evaluate(e.id, e.prompt.answers[i].name);
      if (r.type !== 'accept' || e.groupOf[r.index] !== e.groupOf[i]) continue;
      if (n++ < skip) continue;
      return e.prompt.answers[i].name;
    }
    return null;
  }
  answer() { return this.as(this.holderName(), { type: 'submit', text: this.freshAnswer() }); }
}

// A catalog whose prompts are chosen by the test.
export function fixedCatalog(ids) {
  const c = makeCatalog(bank, matcher);
  let i = 0;
  const base = c.pick;
  c.pick = (o) => {
    while (i < ids.length) {
      const id = ids[i++];
      if (!o.used.includes(id)) { const e = c.get(id); return { id, text: e.text, category: e.category, closed: e.closed, groups: e.groups }; }
    }
    return base(o);
  };
  return c;
}
