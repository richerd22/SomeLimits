# Round 38 — deliberate rail-direction nudges

## Player problem

Tangent lock made a drag follow the rail and the TANGENT switch made that accessible without Shift, but a fine crest or turn adjustment still required a precise pointer gesture. Touch users in particular benefit from a direct, measurable increment.

## Shipped interaction

- The linked paper now exposes **−T** and **+T** beside TANGENT.
- Each control moves the selected node 1 metre backward or forward along the visible, rail-accurate tangent. Shift-click uses 5 metres. Because those labels promise precise increments, these controls deliberately ignore the separate 1m/5m drawing-grid snap preference.
- Every tap is one ordinary Undo entry. The existing Undo/Redo, autosave and cancellation contracts remain authoritative.
- If no selected node has a usable projected tangent, the control changes nothing and explains what is needed.

## Data and physics boundary

The nudge is a direct edit of the selected original node through the same `fromPlane`, preview, rebuild and commit path used by linked dragging. It never creates a tangent object, migrates a point, rewrites a neighbour, changes a bank, stores a setting in a coaster document, or alters the Catmull–Rom rail/physics model. The rail direction comes from Round 37's production-accurate derivative.

## Verification

- `moveAlongTangent()` is pure and regression-tested for projected-axis isolation, quantization and missing-tangent refusal.
- The real desktop Chromium test clicks **+T**, confirms the selected node moves along the same rail tangent, confirms its neighbour is exactly unchanged, and performs exact Undo before the established linked/history journey continues.
- Physics fingerprints, curve preview/refinement, desktop WebGL and simulated mobile Chromium touch coverage remain in the full gate.

## Limits

The controls intentionally move the node, not an invisible handle. They are a precise alternative to dragging, not automatic fairing or smoothing.
