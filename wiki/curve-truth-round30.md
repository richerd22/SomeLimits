# Round 30 — curve-truth preview and on-rail refinement

## Why this round exists

The builder now has proper TOP/SIDE/FRONT 2D drawing, exact heights and optional snapping, but the lime "next segment" ghost in Round 29 was a *straight chord*. The real coaster uses **centripetal Catmull–Rom** curves. At a lift crest, a sharp turn or a banking transition, a straight line can misrepresent where the rail will actually bend.

Another quiet UX defect: `+ node` on an interior segment inserted the numeric midpoint of its endpoints, **not the point on the visible rail**. On curves and loops, adding a node for finer shaping could immediately move the track.

## Shipped drawing behavior

- **Lime chord**: the existing straight segment remains as an alignment/distance guide.
- **Cyan rail preview**: a second, clearly distinguished line shows the same *last* centripetal Catmull–Rom segment that the open-track generator would produce after adding the ghost point. The user can see how the track turns over a crest before committing.
- The preview's readout now shows approximate **curved arc distance** (24 subdivisions) and exact change in endpoint elevation. It no longer claims the straight-line distance is the actual track length.
- This costs one persistent Three.js line and **one reused 25-point Float32Array geometry**. On hover, the code reuses a three-point spline and scratch vector; it only overwrites the buffer attribute. No new rail/tie/support meshes, terrain geometry, source node writes or autosave changes.
- With a lone existing station, the ghost uses the **actual two-point** Catmull–Rom parameterization (which Three.js eases rather than drawing linearly). With two or more existing points, the local control triple `[previous, end, candidate]` reproduces the full *final span*: open Catmull–Rom's endpoint-tangent rule is local. The physical track's existing ±1.5m spline-height guard is applied to the ghost too.
- Preview always hides on pointer/camera cancellation, view switch, invalid point, closed circuit and ride mode, preserving the existing mobile gestures.

## Safer refinement

- `+ node` at the **end** of an open coaster still extends forward at current height, unchanged.
- For an **interior open or closed** segment, `+ node` now inserts a control point **at the actual Catmull–Rom source-parameter midpoint** between the selected point and the next, rather than the straight-line midpoint. The selected index becomes the new point and the whole change remains one undoable edit.
- Inserted banking follows the *existing* `bankAt` / `bankAtOpen` cosine-eased shortest-angle blend, so a 170° to −170° transition does not jump to 0° at the inserted node.
- Splitting a chain lift must not strand the second half. If the original segment had a forced lift flag **or an automatic ≥8m climb**, the operation sets both the original upstream point and new point's `lift=true` so both new halves retain a chain. This is a deliberate source-document change inside the one Undo transaction; Undo restores the previous auto-lift flags exactly.
- Station ownership and every unselected source control coordinate remain unchanged. The method only runs on an explicit user's `+ node` action, not when a coaster loads or plays. Saved preset physics fingerprints remain exactly as they were.

## Regression evidence

- `tests/curve-preview-refinement-regression.mjs` imports pinned `three@0.160.0` and extracts the **actual production functions**. It compares 25 cyan preview points against the full open Catmull–Rom spline for 1, 2, 3, 7, and 80 existing source points and checks the integrated length, unchanged input and segment-height guard. It also checks open/closed segment refinement including the seam, automatic-lift continuity, and that inserted coordinates lie on the actual source spline.
- `tests/browser-smoke.mjs` now checks the curved ghost readout during hovering, then uses the real mobile editor to select an open lift segment, press `+ node`, verify the new node lands on the source Catmull–Rom curve (not a chord midpoint), preserve both lift sections and station, and Undo/Redo the exact original and refined node lists. All prior bank-grip, 2D drafting, 80-node editor and exact preset physics suites remain CI gates.

## Architecture and limitations

The source remains one `play/index.html`, with a single ordered node document, no build step and no new game runtime dependency. This round changes **only the edit preview and the explicitly requested insertion result**; it does not change the engine's spline algorithm, sample spacing, ride integrator, support collision, height guard, presets or file formats.

This is *not* a new editable Bezier tangent mode, nor a NoLimits 2 file editor. The ghost is an approximation of the sampled curve segment, not a guarantee that every rail mesh/ride physical outcome remains smooth: ride testing still matters. Physical iOS Safari acceptance and simultaneous linked editor panes remain open.

## References

- [PR #31 — Round 30](https://github.com/richerd22/SomeLimits/pull/31)
- [Production editor](https://github.com/richerd22/SomeLimits/blob/main/play/index.html)
- [Curve preview/refine regression](https://github.com/richerd22/SomeLimits/blob/main/tests/curve-preview-refinement-regression.mjs)
- [Mobile WebGL acceptance](https://github.com/richerd22/SomeLimits/blob/main/tests/browser-smoke.mjs)
