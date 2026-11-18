#!/usr/bin/env node
/* Fishers: prints the WEB and KJV text of references, for checking content.
 *
 *     node tools/show-verses.js "Lev 11:13-19" "Job 29:6"
 *     node tools/show-verses.js --find "sea gull"     (verses containing a phrase)
 */
'use strict';
const B = require('./lib/bible.js');
const args = process.argv.slice(2);
if (args[0] === '--find') {
  const phrase = args.slice(1).join(' ');
  const T = B.texts();
  let n = 0;
  for (const tr of ['WEB', 'KJV']) {
    for (const [k, t] of T[tr]) {
      if (B.phraseIn(phrase, t)) { if (n++ < 12) console.log(tr + ' ' + k + '  ' + t.slice(0, 160)); }
    }
  }
  console.log(n + ' verse(s)');
} else {
  for (const ref of args) {
    for (const k of B.verseKeys(ref)) {
      console.log(k + '\n  WEB ' + B.verseText(k, 'WEB') + '\n  KJV ' + B.verseText(k, 'KJV'));
    }
  }
}
