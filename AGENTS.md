# Repository Guidelines

## Project Structure & Module Organization
This repository is a small browser app built from `index.html` and ES modules under `assets/`. Keep feature logic split by responsibility:

- `assets/main.js`: bootstraps MediaPipe and app startup.
- `assets/functions.js`: camera setup, detection loop, dashboard updates.
- `assets/chart.js`: hourly and minute chart aggregation/rendering.
- `assets/storage.js`: `localStorage` helpers.
- `assets/actions.js`, `assets/sound-names.js`: UI actions and sound metadata.
- `assets/sounds/`: bundled alert audio files.
- `spec/`: Jasmine specs, with config in `spec/support/jasmine.mjs`.

## Build, Test, and Development Commands
- `npm install`: install Vite, Jasmine, and jsdom.
- `npm run dev`: start the local Vite dev server for iterative UI work.
- `npm run build`: create a production bundle in `dist/`.
- `npm run preview`: serve the built app locally for a quick production check.
- `npx jasmine`: run the spec suite. Use this instead of `npm test` until the script is wired up.

## Coding Style & Naming Conventions
Use plain ES modules, semicolons, and 2-space indentation to match the existing codebase. Prefer `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants such as `MIN_ALERT_INTERVAL`, and descriptive file names like `sound-names.js` or `functions.spec.mjs`. Keep DOM ids and storage keys explicit, for example `lastAlertTime` and `alertsCount`.

There is no formatter or linter configured today, so keep changes stylistically consistent with nearby code and avoid unrelated cleanup in functional commits.

## Testing Guidelines
Tests use Jasmine with jsdom for DOM-dependent modules. Place new specs in `spec/` and name them `*.spec.mjs`. Focus coverage on pure logic and state transitions first, then mock browser APIs as needed for camera, audio, and storage behavior.

Before opening a PR, run `npx jasmine` and manually verify the app in `npm run dev`, especially camera permission flow and alert playback.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit style: `feat: ...`, `chore: ...`. Keep that format and scope each commit to one change. PRs should include a short description, test notes, linked issue if applicable, and screenshots or a brief recording for visible UI changes.
