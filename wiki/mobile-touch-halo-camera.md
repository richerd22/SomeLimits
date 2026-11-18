# Camera-continuous mobile hit halos: node, orange cap and blue grip

November 18, 2026. A narrow follow-up to [camera-continuous blue banking gizmo](mobile-bank-grip-camera-zoom.md).

## The problem

SomeLimits uses three kinds of invisible spherical hit proxies on touch devices. They make direct-point editing friendly to a thumb without enlarging the visible colored controls:

- Lime node: minimum 2.6m radius, scaled at 0.028 times camera distance.
- Orange precision-height cap: minimum 2.4m, scaled at 0.026 times camera distance.
- Blue banking grip: minimum 2.3m, scaled at 0.025 times camera distance.

The radii were originally set once in `addHitProxy()` when the track or its editor handle group rebuilt. PR #20 repaired the *blue grip's* camera continuity, but zooming without rebuilding still left the **lime node and orange cap halos sized for an obsolete camera position**.

Because the invisible targets do not show themselves, a point could become unexpectedly hard to grab when the builder moved away or have an excessively generous invisible reach after zooming in. The orange cap's enlarged old halo might also compete with the blue grip and lime node for pointer ownership, despite the visible centers remaining far apart.

## Decision: keep the old touch math, resize existing meshes

1. Move the already-established distance multipliers and minimum sizes into one production function, `touchHaloRadius(kind, distance)`, used during both initial proxy creation and subsequent camera changes. The constants and their behavior are **not altered**.
2. `addHitProxy()` continues to create only one sphere per touch target. It records the sphere's existing mesh reference and kind in the current `handleGroup.userData.touchProxies` list (the group is disposed on a real editor rebuild).
3. When the existing `refreshTouchBankGizmo()` sees camera movement or viewport resize, it updates all listed touch proxy mesh scales using the new camera distance **before** checking whether the blue ring's radius needs to change. That ordering matters: if the blue ring is clamped at its 24m maximum, the other node and cap halos must still track the camera.
4. The blue grip's visible ball and its invisible proxy continue moving together and use the same shared `touchHaloRadius('grip', distance)` rule.
5. No new proxy meshes, rail meshes, terrain, supports, track samples, physics, save data, editing modes, assets or runtime dependencies. The existing user gesture keeps ownership until successful release or cancellation.

## Verification

The new `tests/touch-halo-camera-regression.mjs` executes the exact production halo creation, sizing and camera-update functions with pinned Three.js meshes and vectors:

- The original numerical touch radius constants and minimums are unchanged.
- At far camera zoom, every node/cap/grip proxy expands to the exact world radius required by its original touch policy.
- At close zoom, each contracts as intended; its center remains tied to the correct lime node, orange cap or visible blue banking grip.
- All three proxies remain the **same Mesh instances**, with no extra child objects or shared geometry/material disposal.
- A stationary camera does nothing, an active edit cannot retarget a held control, and desktop/ride mode are unchanged.
- Changing CSS viewport height refreshes the camera-tracked touch scale.
- The existing camera-grip regression was updated to include the new common halo radius function in its isolated source extraction; it still must pass.
- The original extreme-bank actual WebGL tests still verify that orange/blue/lime centers remain independently selectable at -90, -80 and +90 degrees; five-point nonstation direct manipulation, autosave rescue and physics snapshots are unchanged.

The full GitHub Actions workflow runs `tests/touch-grip-size-regression.mjs`, `tests/touch-grip-camera-regression.mjs`, `tests/touch-halo-camera-regression.mjs` and real Chromium desktop/mobile WebGL.

## Physical iOS acceptance

- [ ] Start a single station, zoom the camera toward and away from it, and regrab its lime dot and orange cap. Touch accuracy should not change unexpectedly with zoom.
- [ ] Select an elevated nonstation point in a five-node banked coaster, zoom far out, then grab the visible blue grip, orange cap and lime node separately.
- [ ] Watch for overlapping invisible halos around bank angles -90, -80 and +90. The aimed handle should continue to win.
- [ ] Begin a drag, add a second finger, then release. The unfinished edit should roll back and camera controls should recover.
- [ ] Test real iPhone/iPad Safari portrait/landscape and lower-powered devices. Chromium emulated touch is not physical iOS evidence.

## Limitations

The radius rules maintain a rough screen-space thumb target from perspective distance. Camera foreshortening and unusual viewing angles can still compress projected distances. The game already uses screen-space handle center arbitration, but physical-device testing and awkward free-orbit orientations remain important.

This change explicitly avoids any increase in the numeric radius multipliers: **consistent** targets are preferable to blindly **larger** ones if that would cause grip-selection conflicts.

Related: [Original adaptive grip](touch-grip-pixel-target.md), [camera-continuous blue visuals](mobile-bank-grip-camera-zoom.md), [extreme bank picking](extreme-bank-touch-arbitration.md), [pointer cancellation](interruptions-and-touch-regression.md), [developer tests](dev.md).
