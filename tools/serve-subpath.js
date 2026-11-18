/* Fishers: serves _site/ under /fishers/, the way GitHub Pages serves a
 * project site, so sub-path problems show up before deploying.
 *
 *   node tools/build-site.js && node tools/serve-subpath.js [port]
 *   → http://localhost:8790/fishers/
 *
 * Anything outside /fishers/ gets the site's 404.html with a 404 status,
 * as Pages does. Responses are gzipped when the browser accepts it.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..', '_site');
const BASE = '/fishers/';
const PORT = Number(process.argv[2]) || 8790;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

function send(req, res, file, status) {
  const ext = path.extname(file).toLowerCase();
  let body = fs.readFileSync(file);
  const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'max-age=600' };
  if (/gzip/.test(req.headers['accept-encoding'] || '') && /text|json|svg|manifest/.test(headers['Content-Type'])) {
    body = zlib.gzipSync(body); headers['Content-Encoding'] = 'gzip';
  }
  res.writeHead(status, headers);
  res.end(body);
}

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/fishers') { res.writeHead(301, { Location: BASE }); return res.end(); }
  if (url.startsWith(BASE)) {
    let rel = url.slice(BASE.length) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) return send(req, res, file, 200);
  }
  send(req, res, path.join(ROOT, '404.html'), 404);
}).listen(PORT, () => console.log('Serving _site at http://localhost:' + PORT + BASE));
