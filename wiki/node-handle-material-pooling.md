# Shared visual materials for 80+ independently editable control points

November 18, 2026. This is a targeted GPU resource-lifecycle and editor input responsiveness optimization for SomeLimits, the single-file NoLimits 1-style coaster builder.

## The performance problem

The 900-sample rail is not the only object rebuilt when a point changes. Every closed coaster creates one **individually raycastable lime control-point sphere per node**, with a white sphere for the selected point. The old code built one shared sphere geometry, but instantiated a **separate `THREE.MeshStandardMaterial` for every node** on every editor preview. On an 80-point coaster:

- 80 nodes × one new material per node = **80 new node material objects per build**.
- 79 of those materials have *exactly the same* lime color/emissive, and only one is different (selected white).
- Pointermove preview coalescing limits redundant builds to once per animation frame, but material/geometry allocation, GPU program bookkeeping, disposal and JS garbage collection still occur on every rebuild.

Materials are not control points. Their identity need not track the point: only each Mesh's position and `userData.nodeIndex` must remain unique for raycasting, drag gesture ownership and Undo/Redo. Sharing immutable appearance materials is safe.

## Fix: separate appearance resources from node identities

A new `buildNodeHandles()` helper is called from **both** `buildTrack()` and `buildLoneStation()`, replacing duplicate handle-render loops:

1. If the plot is empty, return without allocating any geometry or material.
2. Allocate one shared `SphereGeometry(1.05,16,12)` for all visible point handles in the temporary scene group.
3. Lazily construct a white selected material (color `0xffffff`, emissive `0x445500`) and a lime normal material (`0xC6FF00`, emissive `0x222a00`), only when a node actually uses each appearance.
4. Keep **one separate Mesh per node** with exactly the original x/h/z and `nodeIndex`. Every node still gets its original coarse-pointer hit proxy, including camera-distance scaling and independently selectable input ownership.
5. When a point or selection changes, the existing rebuild constructs a fresh owned group with at most two appearance materials, and the old group's unique geometries and materials are disposed through `disposeEditGroup()`.

The existing disposer already collects owned geometry/material resources into JavaScript Sets before disposing them, so a shared material will **not be disposed once per node**. It is released exactly once per old group. Blank drafts allocate no point appearance resources, and single-station drafts use one material—there is no unused/leaked second material.

No global material cache survives across groups. Each group still fully owns and releases its resources: a deliberate choice to preserve simple lifecycle invariants and avoid stale GPU materials during future edits.

## Verification

`tests/node-handle-material-regression.mjs` extracts the actual production helper and disposer from `play/index.html` and evaluates them with pinned Three.js.

It asserts:

- Empty plot: **0** nodes and **0** point materials/geometries.
- One-station draft: **1** node, **1** material and shared geometry as needed, correct point identity.
- 80-node coaster: **80 separate meshes**, **80 unique `nodeIndex` identities**, **80 original touch proxy calls**, exactly **2 material object instances**, exactly **1 sphere geometry**.
- Original selected white and unselected lime color/emissive values, with material equality shared by all 79 inactive points.
- Selection changes from node 0 to node 53: the new selected point is white, old selected point is lime.
- Per-rebuild group ownership: the geometry is disposed **exactly once**, and the selected and normal materials are disposed **exactly once each**, not once for every node. Global shared hit-proxy geometry/material is never disposed by the editor group.

The full GitHub Actions suite also verifies actual Chromium desktop/mobile WebGL, first station, five-point direct node/cap/blue grip gestures, extreme bank-angle picking, 80-node import/edit/Undo/Redo, terrain/BVH equivalence, support clearances, autosave/draft recovery and four fixed-step physics time+top-speed fingerprints.

### Measured allocation change

| Node count | Old node appearance material instances per build | New |
|---|---:|---:|
| 0 | 0 (no node loop) | 0 |
| 1 | 1 | 1 |
| 12 | 12 | **2** |
| 80 | 80 | **2** |
| 120 | 120 | **2** |

On 80 points, the node-handle stage now constructs **97.5% fewer material objects** per rebuild (80 → 2). This is an **object allocation reduction**, not a claim that total frame time is 97.5% faster: most time may still be in spline sampling, rail/support geometry or GPU rasterization.

## Why not instance all the point spheres?

An `InstancedMesh` could reduce draw calls further, but would require careful instance-ID to control-node mapping, selection materials/instance colors and rethinking per-node hit proxy ownership on mobile. That is more implementation complexity and risk than justified by current evidence. Sharing only appearance materials keeps *every original picking interaction identical*, a good fit for the project goal of simple, direct manipulation.

## Future work

- Profile 30/80/120-node scenarios on physical iOS Safari and desktop performance tools, including GPU memory and pointer-to-geometry latency.
- Review shared static rail materials and mutable geometry lifetimes before introducing any global resource pool.
- If draw calls demonstrably dominate in real device profiling, investigate a separate rigorously tested instanced control-point renderer; do **not** assume it is automatically beneficial or safe for picking.
- Preserve point-local banking, unique station semantics, exact distance and physics fingerprints.

Run the source-backed check after installing the test-only pinned Three.js:

```sh
npm install --no-save --no-package-lock three@0.160.0
node tests/node-handle-material-regression.mjs
```

Related: [Terrain BVH performance](terrain-proximity-bvh.md), [Editor resource lifecycle](editor-runtime.md), [Mobile touch halo continuity](mobile-touch-halo-camera.md), [Full browser smoke](browser-smoke.md), [Developer instructions](dev.md).
