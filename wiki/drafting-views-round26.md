# Round 26 — drafting views with real graph paper and direct-elevation touch acceptance

## What changed
Round 25 introduced true TOP, SIDE, FRONT, and 3D projections. This follow-on makes the editor feel like orthographic drawing rather than a special camera angle.

- **TOP / SIDE / FRONT = drafting mode**: hide the terrain and scenery only while orthographically editing. The original 3D world, trees, materials, and supports remain allocated and return untouched in 3D/ride mode. This is a visibility switch, not a separate scene or rewritten geometry.
- TOP keeps the existing 5m/25m graph-paper grid in **both open and completed circuits**, and recenters it around the track when framing a remote imported layout.
- SIDE and FRONT each show a true 5m-square vertical grid. A **single reused 260m Three.js GridHelper** rotates to fit the editing plane and stays positioned behind the coaster. The side camera looks along -Z; the front looks along -X. No added spline/physics samples.
- User-facing hints respond to the active view. TOP points to SIDE for hills and DROP for intentional descent; SIDE/FRONT explain that you drag points to change elevation and return to TOP to place points. The previous TOP toast told players to grab an *invisible orange cap*; that is corrected.
- Switching to ride/3D returns terrain and trees, retaining the originally settled ground and scenery; Undo/Redo/autosave and physical ride time/speed fingerprints remain unchanged.

## Regression
`tests/browser-smoke.mjs` now uses actual CDP mobile touch events to grab and move a lone elevated station in **both** SIDE and FRONT. It checks the node height increased, only the visible horizontal coordinate changed, hidden perpendicular coordinate and banking are bit-for-bit preserved, and Undo restores the exact original node. These are run before the 42.5m -> level -> left -> drop browser journey, which still remains a gate.

The source-backed blueprint contract test also requires a view-aware grid, no terrain in orthographic editor, and restoration on ride. Existing 3D point-drag, mobile orange cap and blue bank grips, giant 80-node import/editor, source exact physics, support collision, and terrain tests still run.

## Known limits
We do not claim physical iOS Safari acceptance, side-by-side simultaneous viewports, Bezier handles, or NL2 file/project format parity. These remain additional UX projects. The code and tests describe only the shipped behavior.

## Why this design
The visualization layer is independent of the source track data. Drafting should remove perspective clutter without creating a second document. Orthographic editing changes the same `{x,z,h,bank,lift,station}` control points that the simulation uses. An explicit view-independent persistence contract keeps the design simple enough to work offline once Three.js is cached.
