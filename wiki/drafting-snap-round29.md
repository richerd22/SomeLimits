# Round 29 — optional 1m/5m grid snap and live TOP drawing preview

## User problem and decision
We now have real orthographic TOP, SIDE, FRONT drafting and direct elevation placement. However new control points still landed at arbitrary 0.1m offsets even while drawing on a 5m grid, and the live ghost segment existed only in SIDE/FRONT. A first-timer could not see the next TOP segment before committing, or accurately plot a symmetrical 5m-wide turn without typing coordinates. **Grid snapping must be optional, not a silent geometry change.**

## Shipped player behavior

- New **SNAP** button outside the collapsible inspector cycles **OFF → 1 m → 5 m → OFF**. OFF is the default; the choice persists under a separate localStorage preference key (`somelimits-drawing-snap`), not in coaster files.
- On new point placement in TOP, SIDE, and FRONT, only the **visible axes** snap; the invisible axis always inherits the endpoint verbatim. A 0.1m default placement is preserved when OFF.
- A node dragged in orthographic views follows the 1m or 5m grid while snapping is enabled. With OFF, original smooth continuous plan dragging remains; heights retain their historical 0.1m resolution. Perspective 3D editing and controls are *never* snapped.
- Snapping clamps after rounding within existing [−150m,+150m] plan bounds and [1m,80m] height, preserving the previous bank and all neighbors. Near-duplicate checks use the final *snapped* placement, so two different clicks that quantize to the same node cannot add duplicate geometry.
- TOP now shares the same persistent ghost point/line as SIDE/FRONT. As the cursor moves, it previews the next control point **at the actual current endpoint height**. An adjacent readout shows next-segment spatial distance and height change, without changing rails/supports or autosave. The existing station close-loop ring remains available.
- A pan gesture hides the ghost. Selection, cancellation, view changes, completion and ride mode clean it up. The underlying preview still reuses one sphere and one dynamic six-float line buffer, with no new track samples or GPU object allocations per pointer move.

## Technical rationale
Pure `draftCoordinate(value,step,min,max)` quantizes only user-requested positions. The production `openElevationPoint` accepts an optional snap step with a zero default, so original code paths and earlier regression behavior remain identical. View-specific input code opts into snapping; there is no new source node property, no alternative spline, no physics integration branch, and no file schema migration.

## Test and acceptance
- `tests/drafting-snap-regression.mjs` extracts the real `openElevationPoint` and `draftCoordinate` implementation, covering OFF/1m/5m values, bounds, hidden X/Z axes, banking inheritance, immutable input, and source-level ghost/drag hook wiring.
- Existing `tests/elevation-draw-regression.mjs` continues to assert the original default geometry with the now-optional fourth parameter.
- `tests/browser-smoke.mjs` checks actual mobile Chromium WebGL: cycle snap to 5m, place a grid-aligned station in TOP, tap SIDE to build a 5m-aligned X/height climb, return to TOP, mouse-hover for ghost readout without autosave, tap to draw a snapped turn while preserving crest height, then switch SNAP off without modifying geometry. The existing three rounds' browser and physics gates remain unchanged.

## Preserved invariants
One play/index.html source file, pinned Three.js CDN, no image/texture generation, no build step, same ordered nodes {x,z,h,bank,station,lift}, same exact preset fingerprints, rail/support collision and physics, same mobile 3D cap and bank grips, and existing Undo/Redo.

## Remaining work
Real physical iOS Safari acceptance; linked simultaneous multi-view editor; optional typed control-point tangent handles and more fine-grained curve shaping. None of those are claimed implemented here.

## Links
- [PR #29](https://github.com/richerd22/SomeLimits/pull/29)
- [Source module](https://github.com/richerd22/SomeLimits/blob/main/play/index.html)
- [Snap regression](https://github.com/richerd22/SomeLimits/blob/main/tests/drafting-snap-regression.mjs)
- [WebGL browser acceptance](https://github.com/richerd22/SomeLimits/blob/main/tests/browser-smoke.mjs)
