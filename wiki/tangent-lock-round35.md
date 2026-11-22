# Round 35 — keyboard-free tangent lock

## Player problem

Round 34 made local tangent shaping explicit, but its constraint depended on holding **Shift**. That excludes touch-first and keyboard-free sessions, even though the linked drawing pane itself is a useful secondary editor on those devices.

## Shipped interaction

- The linked drawing pane has a compact **TANGENT** toggle below the paper. It is off by default and its pressed state is exposed through `aria-pressed`.
- When on, every node drag in the linked TOP/SIDE/FRONT paper follows the visible gold tangent guide. Shift remains a one-gesture shortcut when the toggle is off.
- The toggle is an ephemeral editor control: it is never written to a coaster document, local layout preference, autosave, preset or share export.
- Each constrained drag still edits only the selected source node, keeps the existing one-gesture/one-Undo behavior, and restores the original node if pointer capture is cancelled.

## Geometry and physics boundary

This remains an input constraint over the existing Catmull–Rom control-node model. No Bézier handles, automatic fairing, node migration, neighbour rewriting, spline interpolation or ride physics were added or changed. The tangent is captured when a drag starts, so it stays stable instead of rotating under the pointer during that gesture.

## Verification

- `tests/linked-drafter-regression.mjs` guards the toggle wiring alongside projected tangent, open/closed endpoint, coordinate-isolation, layout and physics-boundary checks.
- `tests/browser-smoke.mjs` uses a real desktop Chromium pane to prove both Shift and the visible **TANGENT** control constrain a SIDE drag to the guide, leave the neighboring source node unchanged and Undo exactly. The perpendicular-error assertion is expressed in metres, avoiding a scale-dependent cross-product threshold.
- The full browser run continues to cover the existing simulated mobile Chromium WebGL/touch journey. The pane remains closed by default on narrow screens, but when a builder opens it the in-pane toggle provides the same tangent interaction without needing a hardware keyboard.

## Limits

This is not automatic curve smoothing or a general tangent-handle editor. Free drag is still available, and tangent lock is deliberately opt-in.
