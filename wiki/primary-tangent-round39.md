# Round 39 — tangent shaping on the primary drawing paper

## Player problem

The linked drawing pane had a deliberate rail-tangent constraint, but the original full-size TOP, SIDE and FRONT papers did not. Builders switching views could make the same careful curve adjustment only in the smaller auxiliary pane.

## Shipped interaction

- The primary editor dock now has a **tangent: off/on** button in TOP, SIDE and FRONT. It is unavailable in 3D, where the constraint would not have an honest two-dimensional meaning.
- With tangent on, a direct lime-node drag is projected onto the selected node's visible rail tangent. TOP shapes plan turns; SIDE shapes X/height; FRONT shapes Z/height.
- Press **T** while the primary 2D editor is active to toggle the same control. The button works for touch and mouse without requiring a modifier key.
- The tangent is captured when the drag begins, so the guide does not change direction under the pointer during the gesture. Normal Undo/Redo treats a completed drag as one ordinary node edit.

## Data and physics boundary

This is an editor preference stored separately in browser workspace storage. It is not inserted into node data, autosaves, imports/exports, share links, presets or the physics core. A constrained drag still changes only the explicitly grabbed original control node; hidden axes, bank and neighbouring nodes remain untouched. It does not add curve handles, fair geometry automatically, or change the centripetal Catmull–Rom spline used by the ride.

## Verification

- The blueprint source regression requires the visible control, persistent preference, genuine rail-tangent projection and the 3D safety boundary; it also rejects any appearance of the preference in the ride core.
- The linked-drafter regression checks the shared constraint imports still match the production interface.
- A real mobile Chromium WebGL test adds one explicit adjacent node, taps the primary TOP tangent button and performs a diagonal touch drag. The result remains on the real plan-rail direction, preserves height/bank/neighbours, and supports exact Undo.
- The full gate retains desktop Chromium WebGL, the established mobile Chromium coverage, curve-preview/refinement tests and all preset physics fingerprints.

## Limits

Tangent lock is an intentional editing aid, not automatic smoothing. Turn it off for freehand movement; use the linked paper's rail guide and **−T / +T** controls when a visible guide or fixed one-metre adjustment is more useful.
