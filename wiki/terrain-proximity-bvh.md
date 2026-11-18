# Fast exact terrain distance for large coasters

November 18, 2026 — large-coaster performance audit. Scope: one-file SomeLimits editor in `play/index.html`, with no new modes, dependencies, textures, generated imagery, rendering shortcuts or ride-physics changes.

## User-visible problem: 80 control points should not make the editor crawl

SomeLimits constantly renders a terrain apron flattened under the track. The exact height of any ground point depends on its nearest X/Z distance to the **control-point polyline**, not to the sampled 3D spline. The same distance also darkens the ground beside the coaster into worn dirt.

Before this round, `updateTerrain()` visited a **109 × 109 = 11,881 vertex terrain grid**. Each vertex called `terrainHeightAt(x,z)`, which computed `plotDist(x,z)`; then `updateTerrain()` computed `plotDist(x,z)` **again** for the worn-ground tint. Both distances scanned every node-to-node segment, testing the exact projected point-to-segment distance. For 80 nodes, that means 11,881 × 80 × 2 = **1,900,960 point-to-segment calculations** per settled terrain update, before considering rendering, tree reseating, supports and tracks.

Small coasters were fine because they only had a handful of control points. High-node-count builds amplified this O(N × terrain vertices) CPU path even though large portions of the terrain were far from every track segment. The track editor already coalesces pointermove previews per animation frame and skips terrain updates during active drags; this pass targets the large **post-release** cost, not the gesture coalescing policy.

## Fix: exact nearest segment, fewer candidates, one distance per terrain vertex

**First**: each `updateTerrain()` vertex computes its original `plotDist(x,z)` just once and passes it into the optional third `terrainHeightAt(x,z,d)` parameter. The same value is then used for the dirt tint. All other callers still use `terrainHeightAt(x,z)` as before, so the external contract remains intact. The smoothstep apron threshold (26–58m), dirt tint threshold (14m), noise, color blending, building-plot plateau and vegetation reseating equations are unchanged.

**Second**: when a coaster has **more than 16 control points**, `rebuildPlotDistanceIndex()` creates a small two-dimensional bounding-volume hierarchy (BVH) from the exact control-point segments. Segment rectangles include their endpoints. The recursive tree partitions by the larger spatial extent and stores up to six segments per leaf. During a ground-distance query:

1. Compute a **conservative squared X/Z distance** from the query point to each node's bounding rectangle.
2. Visit the nearer child first so a tight best-known distance is found early.
3. Skip branches whose rectangle lower bound exceeds the known minimum, with a small **1e-9** numerical guard against floating-point boundary differences.
4. Only for remaining candidates, run the **original exact point-to-segment projection arithmetic**, including its zero-length-segment fallback. Return the same nearest distance.

For 0–16 nodes, `plotDist()` still uses a simple linear scan, avoiding BVH build overhead on ordinary first coasters. The index is recreated before each committed or preview `buildTrack()` operation, and also for blank/one-point `buildLoneStation()` cases, so edits and Undo/Redo cannot leave stale segment coordinates. The same logic applies in closed and open states, including the old ground apron policy of using the closing segment even during an incomplete draft.

The bounding-volume index is a **distance acceleration structure**, not a track sampler or spatial approximation. It changes which candidate projections are considered but not which sample is physically closest. It never moves the track, node, rail, station, support or terrain vertex.

## Verified source-backed equivalence and work reduction

`tests/terrain-distance-regression.mjs` extracts the actual game `plotDist()`, BVH builder and `terrainHeightAt()`, using the pinned Three.js runtime. It compares them against the original brute-force implementation for:

- Empty, one-point and short 4- and 16-point layouts.
- A 17-point boundary layout that first enables the index.
- Large 80-, 90- and 120-node paths, including irregular side-to-side layouts.
- Identical X/Z points at different heights (vertical loop projection), duplicate/zero-length segments and closed-seam geometry.
- Both open and closed builder states.
- Deterministic terrain samples spanning ±300m, including the track apron, dirt tint and distant hills.
- A mutated node coordinate followed by index rebuild and exact restoration on Undo.
- Identical terrain height with either the default two-argument call or the already-computed third distance argument.

The complete first CI run recorded **7,938 exact distance + terrain height probes** passing. On an 80-point circuit and the actual 11,881-position terrain grid:

| Query work | Original single scan | New indexed single scan |
|---|---:|---:|
| Exact point-to-segment projections | 950,480 | **55,700** |
| Fraction of original projections | 100% | **5.9%** |
| Wall-clock sample in CI | 11.3 ms | **4.5 ms** |

The old terrain settle made *two* full scans, or approximately **1.90 million** projections for that 80-node case. The new settle makes one indexed scan, or approximately **55,700**, about **97.1% fewer exact segment projections** during that part of the terrain pass. The timing result is **diagnostic CI data**, not a universal FPS multiplier: the total editor rebuild still includes spline sampling, many rail/tie/support meshes, GPU work and tree/terrain updates, and CI hardware differs from a real phone.

The existing full smoke suite also passed actual Chromium desktop/mobile WebGL, first-station and five-node touch editing, exact Undo/Redo, collision/support clearance, autosave/draft, and all four locked physics time/speed fingerprints. A further real-browser 80-node import/edit/Undo/Redo test was added to catch runtime integration and saved-node corruption that headless numerical equivalence alone cannot detect.

## Run the tests

Install **test-only** pinned Three.js and Playwright as needed; these are not part of the game runtime:

```sh
npm install --no-save --no-package-lock three@0.160.0 playwright@1.56.1
node tests/terrain-distance-regression.mjs
node tests/browser-smoke.mjs
node tests/physics-regression.mjs
```

GitHub Actions runs the tests automatically on PRs and after merge to `main`. No production build step or extra network request was added.

## What remains

- Actual iOS Safari GPU/CPU/FPS measurements at 5/15/30/80/120 nodes and during drag/release. **Headless Chromium is not physical Safari evidence**.
- Profiling the 900-point spline generation, tie/beam geometry construction and support-clearance frame candidates on 80+ node layouts. Those may become the next bottleneck after terrain distance is cheap.
- Possible reuse of static material/geometry resources across repeated preview rebuilds if WebGL allocations dominate. Any optimization must preserve correct material disposal and scene-owned resource lifetimes.
- Browser frame-pacing quality on high-refresh and low-power devices. No benchmark in this record establishes exact iPhone framerate.

## Why this fits the product

The goal is the relaxed immediacy of NoLimits 1, not a parameter-heavy NoLimits 2 workflow. A builder can add complexity without waiting longer for the ground to settle. These improvements are invisible; the creator still places points, drags up/down for hills, banks locally and rides.

Related: [Editor lifecycle](editor-runtime.md), [Support broadphase and exact clearance](support-clearance.md), [Physics baseline and branch audit](branch-hygiene-physics-audit.md), [Browser acceptance](browser-smoke.md), [Player guide](player-guide.md).
