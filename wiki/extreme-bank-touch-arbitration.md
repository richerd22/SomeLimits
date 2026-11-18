# Extreme banking: keep the cap, blue grip and lime point individually tappable

November 18, 2026. Verification only: no changes to coaster physics, handle geometry or input arbitration.

## Risk being tested

On a coaster with a strong bank around -90 degrees, the blue grip rolls upward toward the orange precision-height cap. Their invisible touch halos are much larger than their visible meshes, particularly at mobile camera distance. A tap could accidentally choose the wrong control: height when the builder meant bank, banking when they meant height, or either control when they meant to drag the lime point. A control merely looking visible is insufficient acceptance.

Previous work made the bank gizmo adaptive to zoom on coarse-pointer devices and used screen-projected centers to arbitrate the orange cap and blue grip. But real-browser tests did not yet pin extreme bank orientations or prove the **lime node between those controls** retains its own gesture.

## Actual mobile Chromium test

`tests/browser-smoke.mjs` opens the production game in a 390x844 mobile context with actual Three.js and software WebGL. Using the normal game UI, it creates a single station; controls appear even without a sampled track.

It sets banking via the **existing bank slider's input/change events** at -90°, -80° and +90°, commits normally, then uses the exact one-station camera pose and production grip-radius code to project the three real gizmos into CSS pixels. It sends low-level CDP `Input.dispatchTouchEvent` touches at each visible center.

It asserts that:
- An orange-cap touch immediately advertises `ns-resize` (height), not bank.
- A blue-grip touch immediately advertises `grabbing` (roll), not height.
- A lime node touch does **not** advertise either specialized cursor; its eventual directional cursor is selected after the move dead zone.
- The three neutral touches do not change saved node coordinates, height, bank, lift or station flags.
- The cap and grip remain visually separated by at least 8 CSS pixels at this tested camera pose.
- The earlier first-station real height/bank drags, five-point non-station cap/grip edits, direct horizontal/vertical lime drags, autosave cancellation and physics fingerprints continue passing.

### Observed pixels on the 390x844 phone test

| Bank | Orange cap | Blue grip | Lime node | Cap-to-grip gap |
|---|---|---|---|---:|
| -90° | (195,407) | (195,381) | (195,422) | 26px |
| -80° | (195,407) | (199,379) | (195,422) | 28.3px |
| +90° | (195,407) | (195,461) | (195,422) | 54px |

The actual browser emitted the correct cap, grip and node ownership at every angle and logged **PASS extreme bank screen-space picking**. The adaptive blue ring radius at this camera view was around **6.30m**. Measurements are grounded in this camera/viewport, **not a universal touch guarantee**.

## Why we did not change the game

The risk was real, but the tested code already behaved correctly. Changing working arbitration or increasing hit-proxy spheres would introduce a new chance to steal clicks without any demonstrated benefit. Shipping the test gives the next change to camera geometry, projection, bank ring sizing or picking rules a precise failure signal.

In particular, the player intentionally leaves a direct lime-node drag's cursor neutral on initial pointerdown until it sees whether the user's move is predominantly horizontal or vertical. That is not an undefined gesture: the browser test separately verifies the node has not been stolen by either specialized cap or grip.

## Scope and remaining gaps

- Chromium mobile emulation is **not physical iOS Safari**. Test real iPhone finger accuracy at portrait/landscape orientations and iPad at various zoom levels.
- The same cap and grip can project closer together at a substantially different camera angle, or when a tall banked control point is near the eye. This test covers the named fit-camera cases, not all possible view directions.
- Future edge cases include bank angles near -180/180 wraparound and a user manually orbiting until the bank ring is edge-on.
- A physics fingerprint change would require a separately documented old/new diff. This regression does not alter ride geometry, banking interpolation, save files, share URLs or run times.

Related: [Touch grip pixel sizing](touch-grip-pixel-target.md), [First station precision handles](first-station-precision-handles.md), [Direct lime point editing](completed-lime-node-touch.md), [Browser smoke](browser-smoke.md), [Developer checklist](admin.md).
