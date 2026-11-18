# Cache true arc parameters for both height guards and bank/lift ownership

November 18, 2026. Performance and exactness decision for the sampled track CORE of the one-file SomeLimits browser coaster builder.

## Why this matters

The coaster spline is sampled at 900 evenly spaced **arc lengths**, not 900 evenly spaced control-point segments. Those two measures differ when the builder makes a long straight followed by tight turns, a vertical loop, stacked crossover or unevenly spaced points.

SomeLimits correctly uses Three.js `curve.getUtoTmapping(i / SAMPLES)` to find which source control-point segment owns each sample. That source segment is used twice when rebuilding a track:

1. The **height guardrail** clamps each sampled height to its owning control segment's end heights, plus the original 1.5m overshoot allowance. This prevents spline spikes.
2. The **bank and lift metadata** determines per-point rolled banking, automatic 8m+ lift chains and the sample's `nodeSeg`.

The two loops previously called `getUtoTmapping()` separately with **identical arguments** at each of 901 positions. Under the hood, Three.js binary-searches its cached arc table for that mapping, so the second pass repeated a lookup whose value could not have changed.

This was true for both completed **closed** coasters and incomplete **open** tracks; the open path uses `N - 1` intervals but the same arc parameter lookup.

## Implementation

Immediately after `getSpacedPoints(SAMPLES)`, both `computeTrack()` and `computeOpenTrack()` allocate a local `Float64Array(SAMPLES + 1)` named `curveT`. **No extra traversal is added:** the existing height-guardrail loop calls the real Three.js mapping method and stores the result at the same time.

```js
const curveT = new Float64Array(SAMPLES + 1);
// Inside the existing height guardrail loop:
const t = curve.getUtoTmapping(i / SAMPLES);
curveT[i] = t;
// Clamp height using t, exactly as before.
// Later, when assigning bank and lift to the source node:
const f = curveT[i] * N; // use N - 1 for an open curve
```

This deliberately avoids a separate precomputation loop: a first implementation already removed redundant mapping calls but had inconclusive timing because of the extra pass. The final version reuses work from the height-guardrail loop. The source-node metadata loop then reads the same exact `curveT[i]` result.

**Nothing else changes:** no sample count, mapping approximation, control-point reordering, interpolation method, roll easing, lift flags, station address, braking, track length, ride speed, physics or generated geometry. The table is a local, temporary 901-double cache (~7.2 KiB) rebuilt with the spline when its control points change. It is never serialized or shared between rides.

The crucial invariant is that banking and lift remain **owned by the actual source point on a distance-spaced curve**. Falling back to `i / SAMPLES * N` would be faster but wrong: lift chains would shift to the wrong segment on uneven coasters.

## Regression: exact output, not just a plausibly rideable track

New `tests/curve-parameter-cache-regression.mjs` reads the actual production CORE and open-track code. It automatically reconstructs the **immediately prior repeated-lookup implementation** from that source, rather than keeping a stale hand-copied duplicate of 900-sample track code.

For Classic, Oval, Wild, Looper, an uneven **80-node** circuit and a 90-node vertical/crossover layout, it runs both **closed and open** track generation through pinned Three.js. It compares every generated sample field to the previous implementation:

- Exact sampled position, tangent and banked up/side frame.
- Exact arc length and total length.
- Identical bank degrees, lift/brake flags and source-node segment index.
- Identical station arc address and powered-flat status where applicable.

The test temporarily wraps the genuine Three.js `Curve.getUtoTmapping` method and requires exactly **901 fewer arc-table lookups per track rebuild** compared with the original double-lookup code, while still using the actual arc-length mapping rather than control-node fractions. It logs 80-point sample-generation timing for diagnosis without treating CI machine timing as a physical-device performance guarantee.

The existing fixed-step reference rides, original 47.5m lift playtest, flat-circuit tires, support collision clearance, terrain BVH exactness, GPU disposal, direct point/height/bank touch gestures and full 80-node Chromium WebGL import/edit/Undo/Redo remain independent CI gates.

## Tradeoffs and limits

- Adds one temporary 901-double typed array per rebuild. This is a small, bounded allocation compared with hundreds of steel meshes and the 900-sample spline itself.
- Reduces only **redundant arc-parameter lookups**, not the initial `getSpacedPoints()` calculation, parallel transport, track mesh generation, collision checks or terrain updates.
- Any measured CPU time improvement is hardware- and layout-dependent. Do not claim that eliminating 901 lookups yields a comparable percentage improvement in total game framerate.
- Physical iOS Safari FPS and input-to-draw latency still need manual profiling at higher node counts.

## Maintainer commands

After installing the pinned, temporary test-only Three.js library:

```sh
npm install --no-save --no-package-lock three@0.160.0
node tests/curve-parameter-cache-regression.mjs
node tests/physics-regression.mjs
node tests/browser-smoke.mjs
```

CI installs dependencies for tests only. The deployed game remains a single HTML file with a browser import-map to pinned Three.js, without a bundler, backend or AI-generated visual assets.

Related: [Core spline, exact source ownership and physics](code.md), [large-coaster terrain index](terrain-proximity-bvh.md), [node material pooling](node-handle-material-pooling.md), [engineering testing](dev.md).
