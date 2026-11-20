/* Live Coal: the prompt banks, seen through the solo game's matcher.
 *
 *   const catalog = makeCatalog(bank, matcher)
 *   catalog.pick({ players, round, used, rand })   -> prompt summary or null
 *   catalog.evaluate(promptId, text)               -> matcher result
 *   catalog.answer(promptId, index)                -> { name, tier, group }
 *
 * `bank` is data/prompts.json (the same file the site serves) and `matcher`
 * is js/matcher.js, so the server accepts exactly what the solo game accepts.
 *
 * Duplicates: answers are grouped by their canonical name, so aliases
 * ("Simon Peter", "Cephas") are one answer, and two people who share a name
 * count once.
 */

// A category needs at least BANK_FACTOR x players still in, plus BANK_BUFFER.
import { BANK_FACTOR, BANK_BUFFER } from './engine.js';

export function makeCatalog(bank, matcher) {
  const byId = new Map();
  const compiled = new Map();
  const list = [];

  for (const p of bank.prompts) {
    const groupOf = [];
    const groups = new Map();
    p.answers.forEach((a, i) => {
      const key = matcher.keyOf(String(a.name).replace(/\s*\(.*?\)\s*/g, ' '), p.ignoreWords || []) || ('#' + i);
      if (!groups.has(key)) groups.set(key, { tier: a.tier });
      else groups.get(key).tier = Math.min(groups.get(key).tier, a.tier);
      groupOf[i] = key;
    });
    // "Ease": how many answers are common (tiers 1-3). Big, friendly
    // categories come first in a game; narrow ones later.
    let ease = 0;
    for (const g of groups.values()) if (g.tier <= 3) ease++;
    const entry = {
      id: p.id, text: p.prompt, category: p.category, closed: !!p.closed,
      groups: groups.size, ease, groupOf, prompt: p
    };
    byId.set(p.id, entry);
    list.push(entry);
  }

  function compiledFor(id) {
    let c = compiled.get(id);
    if (!c) { c = matcher.compile(byId.get(id).prompt); compiled.set(id, c); }
    return c;
  }

  function eligible(players, used) {
    const need = BANK_FACTOR * players + BANK_BUFFER;
    return list.filter(e => {
      if (used.includes(e.id)) return false;
      if (e.groups < need) return false;
      // A closed set (the Twelve, the books, the plagues, the seven churches)
      // only while it cannot run out in the first rotation, with room to spare.
      if (e.closed && e.groups - players < BANK_BUFFER) return false;
      return true;
    });
  }

  function pick({ players, round, used, rand }) {
    let pool = eligible(players, used || []);
    if (!pool.length) {
      // Nothing is big enough (a very long game): take the biggest unused.
      pool = list.filter(e => !(used || []).includes(e.id) && e.groups > players)
        .sort((a, b) => b.groups - a.groups).slice(0, 5);
      if (!pool.length) return null;
    }
    pool = pool.slice().sort((a, b) => b.ease - a.ease || (a.id < b.id ? -1 : 1));
    // Round 1 draws from the friendliest third; each round slides the window
    // a little towards the narrower categories.
    const size = Math.max(3, Math.ceil(pool.length / 3));
    const maxStart = Math.max(0, pool.length - size);
    const start = Math.min(maxStart, Math.floor(pool.length * Math.min(0.6, (round - 1) * 0.1)));
    const window = pool.slice(start, start + size);
    const e = window[Math.floor(rand() * window.length)];
    return { id: e.id, text: e.text, category: e.category, closed: e.closed, groups: e.groups, ease: e.ease };
  }

  function evaluate(id, text) { return matcher.evaluate(text, compiledFor(id)); }

  function answer(id, index) {
    const e = byId.get(id);
    const a = e.prompt.answers[index];
    return { name: a.name, tier: a.tier, group: e.groupOf[index] };
  }

  return { pick, evaluate, answer, eligible, list, get: id => byId.get(id) };
}
