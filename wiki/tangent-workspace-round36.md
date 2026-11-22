# Round 36 — remembered tangent workspace control

## Player problem

The Round 35 TANGENT control made constrained shaping available without a hardware keyboard, but a builder who prefers that workflow had to re-enable it after every reload. The rest of the linked drafting workspace already remembers its window placement and visibility, so the editing preference should be equally predictable.

## Shipped interaction

- The linked Canvas2D paper accepts **T** when focused to toggle tangent lock; the visible **TANGENT** button remains the touch-first control.
- The selected state is remembered under the editor-only preference `somelimits-linked-tangent-lock-v1` and restores on reload.
- The UI remains explicit: its lime pressed state and tooltip say whether the next node drag follows the gold guide.
- The shortcut intentionally ignores Alt, Control and Command combinations, preserving browser and platform shortcuts. Arrow-key node nudging remains unchanged.

## Data and simulation boundary

The preference is not part of a coaster document, autosave, preset, share URL, layout rectangle or exported JSON. It cannot move nodes by itself. A locked drag still changes only the selected original source node and uses the existing Catmull–Rom input model, Undo history and cancellation path. No spline, rail sampling, support geometry or ride physics changed.

## Verification

- `tests/linked-drafter-regression.mjs` guards the persistence key, T shortcut and established tangent/physics boundary wiring.
- `tests/browser-smoke.mjs` verifies the toggle can be released and records only `0` in the editor preference, presses **T** on the focused paper, confirms visible locked state and `1`, confirms saved nodes are exactly unchanged, then reloads after workspace edits and confirms the tangent state restores independently of coaster nodes.
- The full regression still exercises real desktop and mobile Chromium WebGL, all established touch paths, and exact preset physics fingerprints.

## Limits

This is workspace memory, not an automatic curve-shaping mode. Tangent lock stays visible and user-controlled; free dragging is always available.
