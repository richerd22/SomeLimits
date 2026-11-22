# Round 37 — tangent guide matches the rail

## Player problem

The initial tangent guide followed a simple control-polygon chord. That is intuitive on evenly spaced straight sections, but a centripetal Catmull–Rom rail bends according to its nonuniform parameterization. On an uneven crest or turn, the chord can point somewhere subtly different from the actual rail leaving the node—the exact moment a tangent guide needs to be trustworthy.

## Shipped correction

- The linked guide and tangent-lock constraint now evaluate the same centripetal Catmull–Rom endpoint derivative used by the production rail.
- Open endpoints use the same reflected control-point treatment as the rail; closed tracks wrap through the seam.
- Degenerate projected derivatives intentionally show no tangent instead of inventing a direction.

## What did not change

This does not alter the track curve, source nodes, rail samples, support geometry, presets, imports, exports or physics. It only corrects the direction presented to the editor and used after a player deliberately enables tangent-constrained dragging. Tangent lock remains opt-in and still changes only the selected original node.

## Verification

- `tests/linked-drafter-regression.mjs` verifies uniform straight derivatives, an asymmetric curved derivative whose direction differs from the control chord, open endpoints, closed seam wrapping, projection, tangent constraint, layout, and the existing physics boundary.
- The exact 1/60-second physics regression retains all four fingerprint values, the custom lift, flat-drive, share round-trip and curve-preview/on-rail-refinement coverage.
- The real desktop/mobile Chromium smoke continues through linked Shift/toggle/T tangent input plus the established WebGL and touch journeys.

## Limits

This is an editor-guide correctness fix, not automatic curve smoothing or a new interpolation model. Free dragging is unchanged.
