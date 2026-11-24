# Round 40 — visible primary tangent guide

## Shipped interaction

When **tangent: on** is active in the primary TOP, SIDE or FRONT drawing paper, the selected node now shows a gold dashed line in its exact permitted rail-tangent direction. The guide uses the same production centripetal Catmull–Rom derivative and projection as the constraint itself.

## Boundary

The guide is disposable editor rendering only. It adds no node, handle, save field, rail sample, physics input or preset change. A lone node deliberately shows no guide because it has no real rail direction to communicate.

## Verification

The blueprint regression requires the dashed-line implementation and no-invented-tangent guard while continuing to reject tangent preferences in the physics core. Existing desktop/mobile Chromium WebGL, curve and exact preset-fingerprint checks remain the release gate.
