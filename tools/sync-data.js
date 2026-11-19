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
// The schedule rides along so file:// play gets the same dailies.
const schedFile = path.join(dir, 'schedule.json');
if (fs.existsSync(schedFile)) data.schedule = JSON.parse(fs.readFileSync(schedFile, 'utf8'));
fs.writeFileSync(
  path.join(dir, 'prompts.js'),
  '/* GENERATED from prompts.json and schedule.json by tools/sync-data.js. Edit the JSON, not this file. */\n' +
  'window.FSH_DATA = ' + JSON.stringify(data) + ';\n'
);
console.log('Wrote data/prompts.js (' + data.prompts.length + ' prompts)');
