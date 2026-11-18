/* Fishers: OPTIONAL answer-count collector, as a Cloudflare Worker.
 *
 * The game does not need this. It exists so that, once people are playing,
 * the estimated rarity tiers can be replaced with real answer frequencies.
 * See "Collecting real rarity data" in README.md for setup.
 *
 * It stores one number per (prompt, answer): how many times it was given,
 * and one per (daily cast, 5-point score band), for the percentile line.
 * It stores no IP addresses, no user ids, no timestamps, and sets no cookies.
 *
 * Bindings (set in the Cloudflare dashboard or wrangler.toml):
 *   COUNTS       a KV namespace
 *   EXPORT_KEY   a secret string that protects the /export endpoint
 *   ALLOW_ORIGIN the site allowed to post, e.g. "https://yourname.github.io"
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (request.method === 'POST' && url.pathname === '/log') {
      let body;
      try { body = JSON.parse(await request.text()); } catch (e) { return new Response('bad json', { status: 400, headers: cors }); }
      const promptId = String(body.promptId || '').slice(0, 40);
      const answer = String(body.answer || '').slice(0, 40);
      if (!/^[a-z0-9-]+$/.test(promptId) || !answer) return new Response('bad request', { status: 400, headers: cors });
      const key = (body.matched ? 'm' : 'u') + '|' + promptId + '|' + answer;
      // KV has no atomic increment, so a few counts can be lost under heavy
      // traffic. That is fine for estimating frequencies.
      const n = parseInt(await env.COUNTS.get(key), 10) || 0;
      await env.COUNTS.put(key, String(n + 1));
      return new Response('ok', { headers: cors });
    }

    if (request.method === 'POST' && url.pathname === '/score') {
      let body;
      try { body = JSON.parse(await request.text()); } catch (e) { return new Response('bad json', { status: 400, headers: cors }); }
      const cast = parseInt(body.cast, 10), score = parseInt(body.score, 10);
      if (!(cast > 0) || !(score >= 0 && score <= 700)) return new Response('bad request', { status: 400, headers: cors });
      const key = 's|' + cast + '|' + Math.floor(score / 5) * 5;     // 5-point bands
      const n = parseInt(await env.COUNTS.get(key), 10) || 0;
      await env.COUNTS.put(key, String(n + 1));
      return new Response('ok', { headers: cors });
    }

    if (request.method === 'GET' && url.pathname === '/percentile') {
      const cast = parseInt(url.searchParams.get('cast'), 10), score = parseInt(url.searchParams.get('score'), 10);
      if (!(cast > 0) || !(score >= 0)) return new Response('bad request', { status: 400, headers: cors });
      let below = 0, players = 0, cursor;
      do {
        const page = await env.COUNTS.list({ prefix: 's|' + cast + '|', cursor });
        for (const k of page.keys) {
          const bucket = parseInt(k.name.split('|')[2], 10);
          const n = parseInt(await env.COUNTS.get(k.name), 10) || 0;
          players += n;
          if (bucket + 5 <= score) below += n;
        }
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      const better = players ? (100 * below / players) : 0;
      return new Response(JSON.stringify({ players, better }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'GET' && url.pathname === '/export') {
      if (!env.EXPORT_KEY || url.searchParams.get('key') !== env.EXPORT_KEY) {
        return new Response('forbidden', { status: 403 });
      }
      const out = { matched: {}, unmatched: {} };
      let cursor;
      do {
        const page = await env.COUNTS.list({ cursor });
        for (const k of page.keys) {
          const [kind, promptId, answer] = k.name.split('|');
          const bucket = kind === 'm' ? out.matched : out.unmatched;
          (bucket[promptId] = bucket[promptId] || {})[answer] = parseInt(await env.COUNTS.get(k.name), 10) || 0;
        }
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      return new Response(JSON.stringify(out, null, 1), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Fishers answer counter', { headers: cors });
  }
};
