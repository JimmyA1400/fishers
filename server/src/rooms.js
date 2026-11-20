/* Live Coal: room codes and allowed origins. (The Worker's main module may
 * only export handlers, so these live here.) */
export const SHORE = 'SHORE';
export const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // no I or O (and no digits, so no 0 or 1)
const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;

export function validCode(code) { return code === SHORE || CODE_RE.test(code); }

export function originAllowed(origin, allowed) {
  if (!origin) return false;
  let u;
  try { u = new URL(origin); } catch (e) { return false; }
  return String(allowed || '').split(',').map(s => s.trim()).filter(Boolean).some(a => {
    // "http://localhost" allows any port on localhost.
    try {
      const w = new URL(a);
      if (w.protocol !== u.protocol || w.hostname !== u.hostname) return false;
      return w.port ? w.port === u.port : (a.endsWith(':*') || !/:\d+$/.test(a));
    } catch (e) { return false; }
  });
}

