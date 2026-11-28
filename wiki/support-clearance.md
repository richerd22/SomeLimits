# Support clearance: a safe broad phase

Updated November 18, 2026. This is a maintainer-facing performance note; no new builder controls or imagery.

## Why another optimization

Each editor geometry rebuild recreates track rails, 300 ties, lifts, post supports and collision-safe side frames. The centre post placement loop originally scanned all **901** sampled track positions at every potential support location. A far-off section must not be allowed to pierce the structure, but blindly testing every position is unnecessary when the query radius is only **sqrt(2.9) = 1.70 metres** in the X/Z plane.

Beam clearance had a separate, repeated cost: each of nine points on every candidate crossbeam called `Math.hypot()` against every non-adjacent sample. That calculated a costly square root inside the innermost loop even though only the final smallest distance is needed.

## What changed

`supportSpatialIndex(samples, 8)` builds a two-dimensional grid of samples based on their x/z coordinates, handling negative positions with `Math.floor()`. It is rebuilt every time the track geometry is rebuilt, so it cannot contain stale positions.

`near(x,z,r)` returns **all** samples stored in grid cells intersecting the query's x/z bounding square. It intentionally does not approximate distance, height or arc position. After the spatial query, the existing `spearsTrack()` logic still rejects any sample within 8 m along the track and tests the exact inequality:

```js
dx * dx + dz * dz < 2.9 && other.pos.y < post.pos.y - 1.2
```

For any sample satisfying the horizontal condition, its x and z are both inside the r-bounded square for r = sqrt(2.9); therefore its cell is necessarily included. The broad phase cannot exclude an actual collision. Negative coordinates, the closed-loop seam, inversions and track crossovers still use the same detailed check.

For crossbeam `beamClear()`, the nine sample points and far-arc exclusion are unchanged. We compare squared three-dimensional distances in the inner loop and take `Math.sqrt(minD2)` only once when the complete minimum has been found. Because square root is monotonic for nonnegative numbers, this preserves the exact collision threshold (1.15 m) and the reported minimum clearance, modulo floating point rounding.

The game exposes `window.__slSupports.centreProbes`, `centreCandidatesTested` and `centreBruteUpperBound` for inspection in DevTools, alongside existing support counts and clearance reports.

## Guardrails

- Post/beam supports are **still withheld** where collision clearance fails. No support geometry, dimensions, beam sampling count, near-arc exclusion, bank orientation or track physics were changed.
- The spatial hash indexes only transient computed samples. It does not add fields to the saved coaster or move banking off its nodes.
- A candidate's inclusion in an indexed cell is **not** treated as a collision by itself.
- No AI-generated imagery, new UI modes, build step or new game dependency.

## Reproducible equivalence test

```sh
npm install --no-save --no-package-lock three@0.160.0
node tests/support-clearance-regression.mjs
```

This test extracts `supportSpatialIndex` and `beamClear` directly from `play/index.html`, uses the actual v0.160.0 Three.js spline implementation and checks every sampled centre-post probe against the original full-scan expression. It includes all four presets, the user's 47.5 m climb, a synthetic elevated crossover and a flat loop. It asserts that every horizontally colliding sample appears in the indexed query, plus exactly equivalent beam minimum distances and pass/fail results. It prints the counted reduction in candidate tests instead of inventing an FPS number.

**Observed GitHub Actions result (PR #3, run 44249750792):** 6,307 support probes over seven layouts checked **5,682,607** brute-force samples versus **259,735** indexed samples, a **95.4% reduction in candidate checks**. All indexed post decisions matched brute force. All 280 beam minimum-distance and accept/reject comparisons matched. The existing editor lifecycle and physics suites also passed. These numbers are CPU work counts, not measured browser frame times.

The existing physics tests still gate the current provisional **44.4s / 86 km/h** classic fingerprint. See [editor runtime](editor-runtime.md) for memory cleanup and animation-frame preview coalescing. These are independent optimizations.

## Remaining work

The overall editor is not guaranteed 60 FPS on older phones. Side-frame distance checks still scan many far samples; terrain rebuilding still re-evaluates proximity to node segments. Any further spatial pruning must establish no missed collisions and keep exact clearance diagnostics, not silently change safety decisions. Profile real iOS Safari and desktop browser sessions before making FPS claims.
