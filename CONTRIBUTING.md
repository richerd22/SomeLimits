# Contributing

SomeLimits is a single self-contained HTML file on purpose. Contributions keep it that way.

## Ground rules

- **One file, no build step.** The game is `play/index.html`: vanilla JS in a single ES module, Three.js from a CDN. If a change needs a build pipeline, it is probably out of scope.
- **No AI-generated imagery, ever.** Hand-drawn SVG, code-rendered geometry, or clean type only. See the policy in [wiki/admin.md](wiki/admin.md).
- **Banking lives on the point.** Do not regress banking into separate roll-node objects.
- **Defaults stay rideable.** A first build must not be able to stall, confuse, or dead-end because of a design choice.
- **Honest copy, dry voice, hyphens not em dashes** in project copy and docs.
- Keep the core maths section (spline sampling, parallel transport, bank interpolation, physics step) free of DOM and scene side effects where it already is, so it can be tested headlessly.

## Before you send a change

Run the no-dependency editor test with `node tests/editor-runtime-regression.mjs`. When touching ride physics, temporarily install Three.js and run `node tests/physics-regression.mjs` (see `wiki/dev.md`). GitHub Actions runs both on pull requests; they are not a game build step. See `wiki/editor-runtime.md` before changing drag scheduling, geometry ownership or library persistence.


- Serve it locally (`python3 -m http.server 8000`, open `/play/`) and ride every preset start to finish.
- Round-trip: export JSON and re-import, export CSV and re-import, open a share link in a fresh window.
- Check that an old save file still loads - import keeps accepting previous save shapes.
- If behaviour changed, update the wiki in the same change.

## Forks

The code is MIT licensed (see [LICENSE](LICENSE)). If you fork, rename your fork - do not ship a fork as SomeLimits. Keep the north star if you keep anything: place points, drag things, ride it within minutes.
