# Editor runtime, memory and save lifecycle

Updated 2026-11-18. Scope: [SomeLimits](../README.md), one HTML game file (`play/index.html`). The fixes are intentionally invisible: no new editing modes, tools, or imagery.

## Problem discovered in source

Every pointermove that changed a node or bank called `buildTrack()` immediately. That function regenerates 900-sample spline geometry, rails, hundreds of ties/supports, collision-safe support frames and editable handles. Touch and trackpad devices can emit multiple pointermove events before the next display frame. Rebuilding each event causes avoidable event-loop latency and can make dragging feel stuck even on capable phones.

The old rebuild detached the previous `trackGroup` and disposed its mesh geometries, but did **not** dispose its materials. The previous `handleGroup` was only removed from the scene, with neither geometry nor material disposal. Repeated edits therefore accumulated GPU resource allocations until reload.

The release path for ordinary lime-node drags called `buildTrack()` **before** setting `dragging = -1`. But the terrain update inside `buildTrack()` was conditional on no active drag. The claim that terrain settled at release was false: the release rebuild skipped it.

Finally, library saves stored `thumb: blueprint(nodes)`, a base64 PNG data URI, alongside each editable node array. These thumbnails are derived output, not data, and add significant localStorage overhead as the collection grows. A quota error was caught and toasted, but the save handler still announced success.

## Changes and reasoning

1. A `queueTrackPreview()` helper coalesces pointer/slider updates into at most **one track rebuild per animation frame**. Node values update immediately, and explicit committed operations call `buildTrack()` synchronously, cancelling any pending preview. This avoids lagging final state, lost pointer-up moves and duplicate builds.
2. `disposeEditGroup()` detaches a temporary group, collects unique geometries and materials, and disposes each exactly once. Excludes the intentionally reusable touch-picking halo geometry/material, which survive until page unload. Persistent scene objects (terrain, trees, train, grid, sky) are not touched.
3. Node release now clears gesture state **before** rebuilding, so the terrain and trees settle on the final plan position. A later usability round removed the old post-release smoothing entirely: all nodes now stay exactly where the builder places them. See [Exact point drags](direct-point-drag.md).
4. Cap, blue bank grip, sideways bank drag and slider releases force a final synchronous rebuild before history/autosave commit. There is no rAF timing hole between the last pointer event and persisted state.
5. `storeLib()` removes legacy thumbnail fields **when next writing the library** and returns a boolean. New saves persist only nodes, metadata and stats. `libraryBlueprint()` draws a thumbnail only for display and caches by entry ID + node signature within the page session. Old saved layouts remain readable and can be opened/duplicated; no migration deletes coaster data. Library save success is shown only if storage succeeded.

## Verification

- JavaScript game module syntax parsed after modifications.
- `tests/editor-runtime-regression.mjs` isolates the actual helpers from the game to verify: unique resource disposal, persistence of shared proxy geometry/material, 100 pointermove calls -> one scheduled preview, cancellation, PNG stripping without data loss, cache invalidation, and quota warnings.
- CI `.github/workflows/regression.yml` runs editor lifecycle tests plus the prior exact-Three.js physics regression on pull requests and pushes to `main`. **CI dependency installation is only for tests, not the player/game.**
- Same track math and ride integrator: **the reference 27.5s / 88 km/h classic fingerprint is expected to stay unchanged**. No chain, gravity, lift detection, node bank fields, import schema or ride logic was altered in this round.

## Manual acceptance checklist (browser hardware required)

- [ ] Mouse: wiggle a node repeatedly; preview follows smoothly, final release commits once; undo returns to pre-drag layout.
- [ ] Touch: drag one point vertically, sideways and via orange cap; use two fingers during a drag and confirm node rolls back instead of sticking.
- [ ] Bank grip: rotate point, release, change view, save/reload; bank remains attached to that point.
- [ ] Drag an outer point far enough to change the terrain apron; after release, the dirt and nearby trees update, rather than staying in the old location.
- [ ] Build 20+ saved coasters, close/reopen library repeatedly: thumbnails render, names and layouts survive reload, and localStorage contains no new `data:image/png` strings.
- [ ] Simulate localStorage quota/blocked writes: the UI must **not** claim the coaster was saved.
- [ ] Run classic, oval, wild, looper and user 47.5m layout; lap logic should be unchanged.

## Follow-up: indexed post checks

The next performance pass added `supportSpatialIndex()` for centre-post clearance and replaced per-candidate crossbeam square roots with one final square root. Collision decisions and min-beam diagnostics remain exact. The equivalence test checks all presets and crossover cases against the original brute-force approach. Details: [Support clearance](support-clearance.md).

A library-cache follow-up evicts a deleted coaster's derived blueprint immediately after a successful library write, instead of retaining it until refresh. The existing editor regression tests enforce this.

## Interruption recovery and actual browser drag tests

A follow-up added explicit `lostpointercapture`, window `blur` and page-hidden cancellation. These events can occur without the ordinary pointerup/pointercancel pair, and otherwise leave a stale pointer owner, disabled camera and an uncommitted point in limbo. The same existing `cancelGesture()` restores the grabbed snapshot; normal release remains authoritative and immune to its subsequent implicit lostpointercapture. The integration test now drives the actual mobile Chromium pointer lifecycle on the one-point station: touch-raise, unchanged plan/bank, undo/redo, then a half-drag interrupted by blur. See [Touch interruptions](interruptions-and-touch-regression.md) for rationale, exact checks, remaining physical iOS tests and rollback semantics.

## Follow-up: reuse exact arc-address lookups in sampled track builds

A later [arc-parameter caching round](arc-parameter-cache.md) stops repeating the same Three.js `getUtoTmapping(i/SAMPLES)` binary searches in both height guardrails and point-local lift/bank metadata on open and closed 900-sample coasters. The first guardrail pass stores exact values in a tiny Float64Array, then the bank/lift pass reuses them. Production-source equivalence tests compare **every sampled field** against the immediately previous implementation and count 901 fewer arc-address lookups. It does not alter any generated geometry or ride physics.

## Follow-up: point appearance material reuse on large coasters

A later [node-handle material pooling pass](node-handle-material-pooling.md) replaced the duplicated full-track/first-station control sphere loops with `buildNodeHandles()`. Each control point still has a unique picking Mesh and touch halo, but all unselected lime points in a temporary group now share a single material instead of making one new identical MeshStandardMaterial per point. On 80 nodes this reduces node appearance material allocations from 80 to **2** per preview/committed rebuild, while the existing `disposeEditGroup()` releases group-owned shared resources exactly once. The production helper is tested with pinned Three.js in `tests/node-handle-material-regression.mjs`.

## Follow-up: exact terrain proximity acceleration for many control points

A later [terrain BVH performance round](terrain-proximity-bvh.md) removes the duplicate per-vertex nearest-segment distance call from `updateTerrain()` and uses an exact 2D segment bounding tree for layouts with over 16 nodes. On an 80-node circuit, the original 11,881-vertex grid required about **1.90 million** segment projections per settled terrain update; the optimized scan requires **55,700**. Brute-force exact height/distance tests and a real 80-node WebGL import/edit/undo check pass. This affects only terrain CPU cost, not the 900-point track sample or the ride physics.

## Known limits / next work

This round does not replace the GPU benchmark with measured FPS on real iOS Safari. Coalescing prevents redundant work within a frame, but individual rebuilds remain heavy (support clearances and terrain projection still cost CPU). Real-device profiling is the next step, and further optimization must preserve the support keep-out checks, especially vertical loops and crossovers.

User-visible instruction remains: place points, drag up/down for height or sideways for position, ride. No mode taxonomy. No AI-generated imagery.
