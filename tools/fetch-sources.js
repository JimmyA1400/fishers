#!/usr/bin/env node
/* Fishers: downloads the public-domain source texts into tools/.cache/.
 *
 *     node tools/fetch-sources.js
 *
 * Sources and licences:
 *   World English Bible (WEB), ebible.org ............ public domain
 *   King James Version (KJV), ebible.org ............. public domain
 *   OpenBible.info Bible Geocoding Data .............. CC BY 4.0 (credited in README and the game footer)
 *   Easton's Bible Dictionary (1897), via CCEL ........ public domain
 *
 * The .cache folder is a build input only; nothing in it is served to players.
 * Unzipping uses the system "tar" (built into Windows 10+ and macOS) or "unzip".
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CACHE = path.join(__dirname, '.cache');
const SOURCES = [
  { dir: 'web', url: 'https://ebible.org/Scriptures/eng-web_vpl.zip', file: 'eng-web_vpl.zip' },
  { dir: 'kjv', url: 'https://ebible.org/Scriptures/eng-kjv_vpl.zip', file: 'eng-kjv_vpl.zip' },
  { dir: 'openbible', url: 'https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/ancient.jsonl', file: 'ancient.jsonl' },
  { dir: 'easton', url: 'https://ccel.org/ccel/easton/ebd2.xml', file: 'ebd2.xml' }
];

async function main() {
  for (const s of SOURCES) {
    const dir = path.join(CACHE, s.dir);
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, s.file);
    if (!fs.existsSync(out)) {
      process.stdout.write('Downloading ' + s.url + ' ... ');
      const r = await fetch(s.url);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + s.url);
      fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
      console.log('done');
    }
    if (s.file.endsWith('.zip')) {
      try { execFileSync('tar', ['-xf', s.file], { cwd: dir, stdio: 'ignore' }); }
      catch (e) { execFileSync('unzip', ['-o', '-q', s.file], { cwd: dir, stdio: 'ignore' }); }
    }
  }
  console.log('Sources ready in ' + CACHE);
}
main().catch(e => { console.error(e.message); process.exit(1); });
