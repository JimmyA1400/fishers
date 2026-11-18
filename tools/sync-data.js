#!/usr/bin/env node
/* Copies data/prompts.json into data/prompts.js so the game also works when
 * index.html is opened straight from disk. Run after every edit to the JSON:
 *
 *     node tools/sync-data.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');
const data = JSON.parse(fs.readFileSync(path.join(dir, 'prompts.json'), 'utf8'));
fs.writeFileSync(
  path.join(dir, 'prompts.js'),
  '/* GENERATED from prompts.json by tools/sync-data.js. Edit the JSON, not this file. */\n' +
  'window.FSH_DATA = ' + JSON.stringify(data) + ';\n'
);
console.log('Wrote data/prompts.js (' + data.prompts.length + ' prompts)');
