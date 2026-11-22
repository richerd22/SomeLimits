# Round 34 — explicit tangent-constrained curve shaping

## Player problem

Dragging a control node freely is powerful, but it is easy to spoil the intended direction of a crest or turn when the desired change is *along* the rail's local flow. The curve already had a real direction at each node, but the linked drawing pane did not reveal it or offer a precise gesture for following it.

## Interaction contract

- Select or drag a node in the linked TOP, SIDE, or FRONT drawing pane. A muted gold dashed line shows the node's local control-point tangent in that projection.
- Hold **Shift** while dragging to lock the edit to that tangent. This is particularly useful for extending a hill crest or easing a turn without accidentally pulling it sideways in the active drawing plane.
- The tangent is captured at pointer-down. The node follows one stable, visible direction throughout the gesture rather than swivelling beneath the pointer while the node moves.
- Releasing Shift returns to ordinary free dragging during the same gesture. The move is still one Undo item. Pointer cancellation restores the untouched original node as before.

## What stays deliberately unchanged

This is an input constraint over the existing Catmull–Rom control nodes, not a new spline handle format. It adds no coaster document fields, no save migration, no automatic smoothing, no hidden neighbour movement, and no physics or interpolation change. Existing preset nodes therefore keep their exact fingerprints until a player explicitly drags one. The single WebGL renderer remains authoritative; the linked Canvas2D pane only draws the guide and routes the same source-node edit.

For open tracks, endpoints use their sole real adjacent node; interior nodes use the direction between their two neighbouring nodes. Closed tracks wrap at the seam. A lone node has no invented tangent guide or constraint.

## Evidence

- `tests/linked-drafter-regression.mjs` proves projected tangent math, endpoint/wrapped behaviour, perpendicular-motion removal, source wiring, and the established axis, bounds and no-physics boundary checks.
- `tests/browser-smoke.mjs` performs a real desktop Chromium Shift-drag in the linked SIDE pane, verifies motion lies on the original tangent, confirms the neighbour is byte-for-byte unchanged, then verifies exact Undo. The same run retains the established real mobile Chromium WebGL/touch journey and all physics fingerprints.

## Limits

This is not a Bézier-handle editor, automatic fairing tool, or a new rail interpolation model. The ordinary drag remains the right tool when deliberately changing a curve's direction; tangent lock is a precise, opt-in shaping aid.
