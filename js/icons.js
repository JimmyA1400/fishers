/* Fishers: the six tier icons, drawn as simple line art in currentColor.
 * 1 a mustard sprout, 2 a chair, 3 a basket of loaves, 4 a coin,
 * 5 a treasure chest, 6 a lamb. 0 (nothing landed) is an empty ring. */
(function () {
  'use strict';
  var PATHS = {
    0: '<circle cx="24" cy="24" r="13" stroke-dasharray="3 4"/>',
    1: '<path d="M24 42V23"/><path d="M24 26C22 18 15 14 8 15c0 8 7 12 16 11z"/><path d="M24 22c1-8 8-13 16-12 0 8-7 13-16 12z"/><path d="M15 42h18"/>',
    2: '<path d="M14 6v36M27 6v20M14 11h13M14 17h13M14 26h20v16M14 33h20"/>',
    3: '<path d="M7 26h34l-4 15H11z"/><path d="M13 31h22M15 36h18"/><path d="M11 26c0-6 4-10 9-10s9 4 9 10"/><path d="M23 26c0-5 4-9 9-9s8 4 8 9"/><path d="M15 21l3 2M33 21l-2 2"/>',
    4: '<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="11" opacity=".55"/><path d="M19 21h10M19 27h10"/>',
    5: '<path d="M7 22h34v19H7z"/><path d="M7 22c0-8 7-13 17-13s17 5 17 13"/><path d="M7 29h34"/><rect x="21" y="26" width="6" height="7" rx="1"/><path d="M15 9.8V22M33 9.8V22" opacity=".6"/>',
    6: '<path d="M13 32c-4 0-6-3-5-6s4-4 6-3c1-3 4-5 7-4 2-2 6-2 8 0 3-1 6 1 6 4 3 1 4 4 2 7-1 1-2 2-4 2z"/><path d="M34 21c2-3 7-3 9 0s0 7-3 7l-4-1"/><path d="M40 21l1-3"/><path d="M16 32v8M21 32v8M28 32v8M33 32v8"/>'
  };
  window.FSHIcons = {
    tier: function (t, cls, attrs) {
      return '<svg class="ic' + (cls ? ' ' + cls : '') + '"' + (attrs ? ' ' + attrs : '') + ' viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (PATHS[t] || PATHS[0]) + '</svg>';
    }
  };
})();
