/* Live Coal: checks every message a client sends. Anything that is not a
 * known intent with the right fields is dropped (returns null).
 *
 * Client -> server, JSON, always with v: 1:
 *   { type: 'join', token, name, color }
 *   { type: 'setName', name, color }
 *   { type: 'settings', preset }
 *   { type: 'start' } | { type: 'rematch' } | { type: 'leave' }
 *   { type: 'kick', target }
 *   { type: 'typing', text }
 *   { type: 'submit', text }
 *   { type: 'confirmSuggestion' }
 *   { type: 'ping', t }               time sync; answered with { type: 'pong', t, s }
 */
export const MAX_RAW = 512;        // bytes in one frame
export const MAX_TEXT = 200;       // characters in any string field

const str = (max) => (v) => typeof v === 'string' && v.length <= max;
const SPEC = {
  join: { token: (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(v), name: str(40), color: str(16) },
  setName: { name: str(40), color: str(16) },
  settings: { preset: str(16) },
  start: {}, rematch: {}, leave: {}, confirmSuggestion: {},
  kick: { target: str(32) },
  typing: { text: str(MAX_TEXT) },
  submit: { text: str(MAX_TEXT) },
  ping: { t: (v) => typeof v === 'number' && Number.isFinite(v) }
};
const OPTIONAL = { join: ['color'], setName: ['color'] };

export function parseClient(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_RAW) return null;
  let m;
  try { m = JSON.parse(raw); } catch (e) { return null; }
  if (!m || typeof m !== 'object' || Array.isArray(m) || m.v !== 1) return null;
  const spec = Object.prototype.hasOwnProperty.call(SPEC, m.type) ? SPEC[m.type] : null;
  if (!spec) return null;
  const out = { type: m.type };
  for (const k of Object.keys(spec)) {
    if (m[k] === undefined && (OPTIONAL[m.type] || []).includes(k)) continue;
    if (!spec[k](m[k])) return null;
    out[k] = m[k];
  }
  for (const k of Object.keys(m)) if (k !== 'v' && k !== 'type' && !(k in spec)) return null;
  return out;
}

/* Per-connection rate limits: a token bucket for intents (20/s) and a
 * separate one for typing (at most 8/s are forwarded; the rest are dropped).
 * Returns 'ok', 'drop' or 'close'. */
export function makeLimiter(now) {
  return { t: now, msg: 20, typ: 10, strikes: 0 };
}
export function limit(l, kind, now) {
  const dt = Math.max(0, now - l.t) / 1000;
  l.t = now;
  l.msg = Math.min(20, l.msg + dt * 20);
  l.typ = Math.min(10, l.typ + dt * 8);
  if (kind === 'typing') {
    if (l.typ < 1) { l.strikes += 0.25; return l.strikes > 40 ? 'close' : 'drop'; }
    l.typ -= 1;
    return 'ok';
  }
  if (l.msg < 1) { l.strikes += 1; return l.strikes > 40 ? 'close' : 'drop'; }
  l.msg -= 1;
  l.strikes = Math.max(0, l.strikes - 0.05);
  return 'ok';
}
