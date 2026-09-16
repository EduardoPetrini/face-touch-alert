# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `AGENTS.md` for coding style, naming, and commit/PR conventions. This file covers commands and architecture.

## Commands

```bash
npm install          # install Vite, Jasmine, jsdom
npm run dev          # Vite dev server (use this for camera work — getUserMedia needs a real origin)
npm run build        # production bundle into dist/ (gitignored)
npm run preview      # serve the built bundle
npm test             # run all Jasmine specs
npx jasmine spec/sound-names.spec.mjs   # run a single spec file
npx jasmine --filter="Chart Data"       # run specs matching a describe/it name
```

There is no linter, formatter, or type checker configured.

## Architecture

A no-framework browser app. `index.html` is the single entry point: it inlines all CSS, declares every DOM id the modules reach for, and loads the ES modules in a **load-bearing order** (`storage` → `ui` → `actions` → `functions` → `main` → `chart`).

**Modules do work at import time.** They are not a set of exported functions waiting to be called — importing `actions.js` calls `initializeState()`, importing `functions.js` reads localStorage and starts a 60s dashboard interval, importing `ui.js` registers a state subscriber. `ui.js` must load before `actions.js` so the subscriber exists when the first state change is emitted. Reordering the script tags in `index.html`, or adding a top-level side effect, can silently break startup.

### Layers

| File | Role |
|---|---|
| `assets/state.js` | Pub/sub store — single source of truth for `status` (loading/active/paused/error) and `isPaused`. Mirrors `isPaused` to localStorage. |
| `assets/analytics.js` | **Pure** time-bucketing logic: pruning, hourly/minute counts, labels, today's stats. No DOM, no globals. Every function takes an injectable `now`. |
| `assets/chart.js` | Chart.js rendering on top of `analytics.js`; re-exports its label helpers. Lazily creates both charts. |
| `assets/functions.js` | Camera setup, detection loop, `onResults` alert pipeline, dashboard DOM writes. |
| `assets/actions.js` | Control-button wiring (mute, pause, volume, sound cycling) and status text. |
| `assets/ui.js` | Renders app state onto the loader, video container, and the `aria-live` region. |
| `assets/storage.js` | Typed localStorage getters/setters that swallow errors and return a zero value. |

### Third-party globals come from CDN script tags, not npm

`Chart` and `feather` are window globals loaded in `index.html`. `window.Holistic` is fetched at runtime by `main.js`, which injects the MediaPipe Holistic script (pinned to `0.5.1675471629`), configures it, wires `onResults`, then calls `setupCamera`. Nothing in `package.json` provides these — tests must stub them.

### Detection loop

`startDetectionLoop` is a self-rescheduling `setTimeout` chain (`DETECTION_INTERVAL_MS = 600`), not a `setInterval`. It deliberately skips a frame — without inferring — when the tab is hidden, detection is paused, the video has no current frame, or a previous inference is still in flight (`isInferenceInFlight`). Preserve that guard: overlapping `holistic.send()` calls stall the pipeline. The loop is torn down on `visibilitychange`, on pause, and on `beforeunload` (which also stops the camera tracks).

### Alert pipeline

`onResults` compares every hand landmark against every face landmark (~468 × 21) and fires on 2D Euclidean distance `< 0.03`, throttled by `MIN_ALERT_INTERVAL` (10s). A single alert then: plays the sound, pulses `.stat-card.main-stat`, appends a timestamp, prunes to the 7-day retention window (`ALERT_HISTORY_RETENTION_MS`), persists, and redraws both charts.

Alert history is mutated in place via `splice` so the module-level `alertsList` reference stays valid for the charts and dashboard — deliberate, despite the immutability preference elsewhere.

### localStorage keys

`lastAlertTime`, `alertsCount`, `currentDuration`, `lastDuration`, `alertsList` (JSON array of epoch ms), `isPaused`, `alertSoundIndex`, `alertVolume` (0-100 integer percentage).

Note `isPaused` has two readers: `state.js` owns it, but `actions.js` also reads it directly via `getInt`. `initializeState()` force-resets it to `0` on every page load — the app always starts active.

## Testing

Jasmine + jsdom, specs in `spec/*.spec.mjs`. Because modules touch the DOM at import time, each spec must **build the jsdom environment and assign `global.window` / `global.document` / `global.Chart` before `await import(...)`** of the module under test — see `spec/functions.spec.mjs` for the pattern, including its hand-rolled `Chart` stub.

Prefer testing `analytics.js` directly: it is pure and takes an injectable `now`, so it needs no DOM and no fake timers. Specs run in random order (`spec/support/jasmine.mjs`), so leave no shared state behind.

## Known documentation drift

`README.md` predates the current code. It claims no build step is needed, a 300ms `setInterval`, and a `functions.js` layout that has since been split into `state`/`analytics`/`actions`/`ui`. `AGENTS.md` says to use `npx jasmine` "until the script is wired up" — `npm test` works. Trust the source over both, and prefer updating them when you touch these areas.
