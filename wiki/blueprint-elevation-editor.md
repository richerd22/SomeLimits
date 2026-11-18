# Round 25 — blueprint/elevation editor, intuitive lift-crest extension

## Player problem
The previous single perspective camera made building a lift crest and then a turn/drop needlessly difficult. `+ node` in an open build always extended at **3 m**, and clicking the ground always added at 3 m. The construction tool conflated X/Z placement, height, and camera orbit.

## Interaction contract
- **TOP** is a genuine orthographic plan. Left-drag blank space pans; wheel/pinch zooms. Drag any lime node to change X/Z with its height untouched. Ground clicks on an open track inherit the previous node's **height**, so plotting a turn from a 42 m crest doesn't create an unintended drop.
- **SIDE** is an orthographic X/height elevation. Drag a lime point to change X and height, preserving its Z coordinate. Blank-space drag pans; perspective orbit is disabled. For building new nodes, return to TOP or use the continuation buttons.
- **FRONT** is an orthographic Z/height elevation. Drag points to change Z and height, preserving X.
- **3D** uses the original perspective orbit editor, direct up/side node gestures, cap, and banking grip. The 3D ground-click default stays 3 m for existing users.
- **+ LEVEL** moves forward 14 m at *exactly* the current end elevation and bank. **LEFT/RIGHT** turn the forward heading 45° and retain elevation/bank. **DROP** moves forward 20 m and descends 20 m, stopping at 3 m. All extend the **open track end**, not an arbitrary selected interior point. `+ node` at the end now uses the same level extension. `+ node` on an interior point remains an insertion.
- **FOCUS SELECTED NODE**, **FRAME TRACK**, view keys 1/2/3/4, and G (focus) enable rapid predictable navigation. Switching views frames the track; ride mode always restores the perspective camera.
- New blank coasters open in TOP. Existing presets/closed circuits still start in 3D. Switching views is not a document mutation.

## Architecture / limits
Two Three.js camera instances share a single OrbitControls instance. The active camera pointer is switched on view changes. Orthographic camera targets/frusta are sized from the actual built geometry; resize updates projection. Fixed camera axes avoid accidental orbit in elevation views. In 2D, orange/blue perspective gizmos are hidden and the user drags nodes directly; height and banking sliders remain in the inspector. Orthographic point visuals and thumb targets scale in world space against actual CSS pixel size as the user zooms, without rebuilding rail/support geometry. The existing code-rendered assets, one HTML file, import/export schema, spline/physics core, autosave, and library are unchanged.

## Regression acceptance
New `tests/blueprint-editor-regression.mjs` parses production browser JS and tests the real continuation helper: exact height preservation, relative heading, banking preservation, deliberate drop, floor and bounds. New browser acceptance exercises TOP by default, switching back to classic 3D touch gestures, building a 42.5 m crest, LEVEL, LEFT and DROP, Undo/Redo, and view switching. Existing source-backed exact physics fingerprints and real WebGL/touch suites remain required in CI.

## Outstanding follow-ups
Physical iOS Safari acceptance on touch/pinch/ortho pan; side/front direct dragging on hardware; splitting the view inspector into a collapsible rail on very small landscape phones; performance testing with large coasters in ortho. This phase deliberately does **not** add editable Bezier tangent handles or split-pane simultaneous views. Do not claim those are implemented.

## Design rationale
Plan geometry and elevation are independent dimensions. A perspective 3D ray picks a visible point well but is a poor sole interface for precise authoring; two true 2D projections remove ambiguous axes. Explicit continuation buttons make the common action (continue level at the top) easier than the exception (drop now). The physics engine still sees the same unmodified list of {x,z,h,bank,lift,station} control points.
