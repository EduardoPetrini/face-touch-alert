// Bundle entry for the offline edition. Pages opened from file:// cannot load
// <script type="module">, so this is built into one classic script (app.js).
//
// Order is load-bearing and mirrors the module <script> tags in index.html:
// these modules do work at import time (see CLAUDE.md). Keep the two in sync.
import '../assets/storage.js';
import '../assets/ui.js';
import '../assets/actions.js';
import '../assets/functions.js';
import './offline-main.js';
import '../assets/chart.js';
