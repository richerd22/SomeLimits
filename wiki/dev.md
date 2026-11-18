# Dev

Working on SomeLimits itself.

## Repo layout

```
index.html     site root - sends visitors to the game (for static hosting)
play/          the shipped app - play/index.html is the whole game
prototype/     the v0 prototype the shipped app grew from - reference, not the product
wiki/          these docs
research/      NL1 vs NL2 research notes - see research/SUMMARY.md first
logo/          the hand-drawn SVG logo (and exports of it)
README.md      what the project is, and how to play
LICENSE        MIT
```

The root `README.md` is the front door - what SomeLimits is, the design rules, and the no-AI-imagery rule. Read it before arguing with the design rules below. They are deliberate.

## Running locally

No build step, so running it is serving one file.

Option 1, any static file server, from the repo root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/play/
```

Option 2, just open `play/index.html` as a file in a modern browser.

Either way you need internet once, for the Three.js CDN (`three@0.160.0` via unpkg, wired up through an importmap). Offline after the CDN is cached is the browser's business, not a feature we promise.

## No build step, and why

- One file is the deployment unit, the debugging unit, and the thing a fork gets. No transpiler, no bundler, no node_modules.
- The audience includes people who will view source to learn how it works. A single readable file serves them; a build pipeline does not.
- If a change needs a build step, that change is probably out of scope for this project.

## Conventions

- Vanilla JS in a single ES module. No framework.
- Functions over classes. State lives in plain objects and arrays - see [Code](code.md) for the node model.
- The core maths - spline sampling, parallel transport, bank interpolation, the physics step, G computation - lives in a clearly marked CORE section in the comments. Keep it free of DOM and Three.js scene side effects where the shipped code already is, so it can be lifted out and tested headlessly.
- Rebuild derived data from nodes; never hand-edit samples. Samples are a cache.
- Numbers mean metres, seconds, degrees where the code says degrees, km/h only at the HUD.
- Style: dry comments, short functions, no hype in strings. UI copy follows the same voice as these docs.
- Never use an em dash in project copy or docs. Hyphen only.
- No AI-generated imagery, ever, in any file you add. Hand-drawn SVG, code-rendered geometry, or clean type. See [Admin](admin.md).

## Testing

Use the zero-dependency editor regression first. It tests the actual game's transient resource lifecycle, preview scheduling and library persistence helpers:

```sh
node tests/editor-runtime-regression.mjs
```

Then run the standalone physics regression in `tests/physics-regression.mjs`. Install the pinned Three.js version temporarily and run it with Node (no game build step and no tracked dependencies):

```sh
npm install --no-save --no-package-lock three@0.160.0
node tests/physics-regression.mjs
node tests/support-clearance-regression.mjs
```

The support clearance regression checks all 900+ spline samples against the full-scan reference on every preset, the playtest coaster, a crossing and a flat track. See [Support clearance](support-clearance.md).

It checks all presets, the November 2026 shared 47.5m climb, a completely flat circuit, correct auto-chain ownership, the share round-trip, and the deliberate classic baseline of **27.5s / 88 km/h**. See [the playtest report](../playtest-2026-11-18.md) for before/after timing.

GitHub Actions now runs both regressions on PRs and `main` pushes in `.github/workflows/regression.yml` - tests are maintainer-side only, not part of the visitor's single-file app. The exact editor disposal, pointer coalescing, terrain-settle and legacy-thumbnail migration decisions are documented in [Editor runtime](editor-runtime.md).

The original harness approach still applies:

- **Node harness for the core maths.** The new regression extracts the CORE section automatically; extend it to assert on other pure parts:
  - bank interpolation takes the shortest path and wraps past 180 correctly
  - a flat, unbanked loop holds about 1 G at rest speed
  - parallel transport around a closed loop returns close to its starting frame
  - a lift-flagged climb holds chain speed, an 8 m-plus climb is auto-lift
  - an energy run with no drag loses no height it did not spend
- **By hand, in the browser.** No automated browser WebGL or iOS Safari interaction test is claimed. Load each preset, ride each one start to finish, check the lap summary appears, save and reload from the library, round-trip JSON out and back in, round-trip CSV out and back in, and open a share link in a private window.
- **Round-trip rule.** Any change to the save format, CSV layout, or share encoding is not done until export, import in a fresh page, and ride all still work on an old file.

If you add a harness, keep it in a scratch or tools folder, dependency-free, and say how to run it at the top of the file.

## Planned

Marked planned here so nobody documents or promises them as shipped:

- Refinements to straight-section handling.
- Anything listed under out-of-scope in the research summary: parks, terrain editing, multiple coasters, scripting, binary NoLimits formats.

## Versioning

- The current shipped app lives in `play/`.
- `prototype/` is v0 and stays frozen as the reference it grew from.
- Save format has its own version field (`version: 1` in the object). Bump it if the node schema changes, and keep import accepting the older shapes - import already accepts the v0 raw array, and that courtesy extends forward.

## Contributing and forking

See [../CONTRIBUTING.md](../CONTRIBUTING.md) for the ground rules.

- Forking: the code is MIT licensed. If you fork, rename your fork. Do not ship a fork as SomeLimits.
- Keep the north star in the fork if you keep anything: place points, drag things, ride it within minutes.

## License

- The code is MIT licensed - see [../LICENSE](../LICENSE).
- The SomeLimits name and the hand-drawn logo are project marks of the project.
- SomeLimits is not affiliated with NoLimits or Gravimetric. No NoLimits assets, code, or formats are used, beyond the documented CSV spline bridge (position plus up vectors) described in [Code](code.md).
