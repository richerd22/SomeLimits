# Round 31 — optional custom segment dimensions without losing one-tap editing

## Player problem

The new TOP/SIDE/FRONT blueprint and the LEVEL/LEFT/RIGHT/DROP controls made basic coaster construction much easier. But the original quick actions hardcoded 14m straight/turn, 45° turn, and 20m forward + 20m down for drops. A user wanting a tighter bend or shallow crest had to create a default point and drag it manually. This defeated the one-tap promise.

## Design choice

**The obvious action stays one-tap.** On an open track, the dock still presents four large LEVEL / LEFT / RIGHT / DROP buttons. The original defaults are mathematically unchanged. A power user can expand **"next section dimensions (advanced)"** inside the existing collapsible inspector, where four input numbers control only **future** sections:

| Input | Default | Range | Effect |
| --- | ---: | ---: | --- |
| Level / turn run | 14m | 4–45m | Forward horizontal distance for LEVEL, LEFT, RIGHT and open-end +node |
| Turn angle | 45° | 5–135° | Signed left/right heading change after previous section |
| Drop forward run | 20m | 5–60m | Horizontal advance for DROP only |
| Drop height | 20m | 1–70m | Vertical descent for DROP only, with existing 3m floor |

Only the current endpoint gets a newly appended node. Existing track nodes are never retroactively modified, and banking is inherited from the endpoint. TOP and SIDE/FRONT drawing through direct taps still works independently of these quick-button defaults.

### Why advanced settings live in the inspector

Earlier mobile browser tests revealed a taller floating dock could cover the banking grip. We are **not** making that mistake again: these fields live behind an expandable section in the mobile-foldable main inspector. The actual floating dock is unchanged in size, and its thumb-sized construction buttons remain visible even when the inspector is folded.

## Runtime boundaries and persistence

- `openExtension(a,b,kind)` keeps exactly the original signature and accepts an **optional fourth configuration argument**. Without it, 14m / 45° / 20m defaults are exactly unchanged, including in existing extracted production math tests.
- User-controlled settings are clamped to positive ranges and rounded to whole metres/degrees on each change. Invalid or empty entries restore the last valid setting.
- Editor preferences are stored separately in `localStorage` under `somelimits-section-dimensions-v1`. Storage failures do not block building. Preferences do **not** enter coasters, Undo/Redo snapshots, JSON/CSV, imported documents, URL shares, libraries, spline or physics.
- Dock button tooltips update immediately to reflect the exact configured direction, run and drop.
- Closed circuits and ride mode hide the advanced section options entirely. Switching back to an open editor restores the saved preference; the saved *track* remains independent.

## Regression and evidence

- `tests/section-dimensions-regression.mjs` extracts the real `openExtension` function from `play/index.html`, checks existing bit-for-bit 14m/45°/20m default geometry, and verifies configurable 30m level, 30° turns, 35m forward/12m down drop, clamp behavior for invalid/excessive inputs, preservation of bank/height where appropriate and unchanged upstream nodes.
- Real Chromium mobile WebGL acceptance sets the advanced inputs, then taps the actual floating LEVEL, LEFT and DROP buttons, verifies the requested plan distances and exact 42.5m → 30.5m drop, checks the settings do not enter autosaved coaster data and exercises Undo/Redo.
- All prior physical ride fingerprints, exact curves, rail refinement, input cancellation, extreme-angle grip selectability, mobile canvas access, 80-node performance and terrain/support tests remain CI gates.

## Still open

Not a native Bezier tangent handle system, multi-pane linked NL2 editor, editable switch track or physics rework. Physical iOS Safari hardware acceptance remains open.

## Sources

- [Round 31 PR #32](https://github.com/richerd22/SomeLimits/pull/32)
- [Production editor](https://github.com/richerd22/SomeLimits/blob/main/play/index.html)
- [Dimensions source regression](https://github.com/richerd22/SomeLimits/blob/main/tests/section-dimensions-regression.mjs)
- [Real mobile WebGL test](https://github.com/richerd22/SomeLimits/blob/main/tests/browser-smoke.mjs)
