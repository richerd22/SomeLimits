# Round 27 — precision node authoring and overlapping-point navigation

## Problem
A track can stack nodes in TOP view (vertical loops, spikes, crossovers), so choosing one by clicking a 2D projection is inherently ambiguous. A single finger is also not a reliable input device for setting a precise X/Z offset. This round adds explicit point navigation and numeric precision without changing the track data model.

## Player UI
- The NODE inspector has **previous**, **next**, **focus**, an always-live readout of **X, Z and height**, and editable **X / Z numeric positions** (metres, 0.1 m step). On an empty draft, inputs and navigation disable.
- Previous/next wrap through the actual saved node array, including overlapping nodes. Selection alone does not autosave, touch data, physics or Undo history. The selected point remains white, all other nodes lime. `[` and `]` select previous/next on desktop. G focuses it.
- Numeric X/Z updates clamp to ±150 m, round to 0.1 m, update exactly one coordinate, and produce one Undo entry on actual change. Invalid/empty/no-op updates don't mutate the document. Existing height and banking sliders remain the precise controls for the other two dimensions.
- Keyboard arrows nudge only in TOP/SIDE/FRONT: TOP left/right X and up/down -Z/+Z; SIDE left/right X and up/down +height/-height; FRONT left/right +Z/-Z and up/down height. Each step is **1m**, Shift+arrow **5m**, Alt/Option+arrow **0.1m**. Limits: plan [-150,150] and height [1,80]. 3D leaves arrows alone to avoid perspective-dependent guessing.
- Arrow/selection keys do not act inside text/numeric inputs or while a modal overlay is open. A successful nudge invokes existing `buildTrack();commit();` and is undoable. A blocked nudge at the plot/height boundary changes nothing.

## Undo selection repair
The actual browser acceptance revealed a subtle issue: Undo of a newly added DROP reduces node count and clamps selection to the preceding point; the subsequent Redo re-adds the DROP but **does not return selection to that control point**. Arrow nudges could therefore edit the wrong node even though everything looked restored. The in-memory Undo snapshot now also captures `selected`, and `applyState()` restores it on Undo/Redo. The persistent autosave/export/share format does **not** include this UI-only field.

## Architecture
No input mode or new coaster type. The function `nudgeAxes(view,key,step)` is side-effect free: it maps a 2D screen direction to **one** source axis and signed delta. `nudgeSelectedNode` clamps, rounds and commits. Other fields (station, lift, banking, neighbors) are never re-authored. DOM coordinate entry and node cycling are editor-only operations. No changes to the pure CORE, ride integrator, sampling, rail/support geometry, export or autosave format.

## Verification
`tests/precision-node-editor-regression.mjs` extracts `nudgeAxes` from the actual game module and checks all view mappings, step sizes, invalid inputs, bounds, and source wiring. `tests/browser-smoke.mjs` runs actual page keyboard arrow event in TOP on a real open coaster, verifies only the selected X moved, commits exact X=22.7 via numeric inspector, exercises Undo, and selects previous/next nodes with unchanged localStorage. All existing mobile direct gesture tests, SIDE/FRONT WebGL plane drags, 80-node performance, lift-crest continuation and precise ride fingerprints remain gates.

## Limits
This does **not** implement true Bezier control/tangent handles, a classic NoLimits coaster file importer, multiple simultaneous views or physical iOS Safari hardware certification. Precision buttons deliberately live in the expandable inspector, leaving the phone's central drawing canvas unobstructed.
