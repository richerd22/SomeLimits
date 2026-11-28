# Arc-parameter ownership boundary

The editor has two intentionally different ownership rules.

## Completed rides: preserve the Round 16 baseline

Closed coasters assign bank and lift metadata from the original evenly distributed source-node fraction. The height guard still uses Three.js's true arc mapping, but changing the ownership rule on a completed ride widened the Classic lift zone and silently changed its lap fingerprint.

The Round 17 restoration therefore keeps the closed-ride rule exactly as it was. It is protected by `tests/curve-parameter-cache-regression.mjs`, which checks every sampled source-node owner for each shipped preset and rejects the fingerprint-changing closed-ride cache.

## Open drafts: retain the exact curve cache

Incomplete tracks have no shipped ride fingerprint. Their height guard, bank, and lift metadata reuse one local `curveT` table built from Three.js's true arc mapping. This preserves what a builder sees while drawing an uneven, open spline without adding a second mapping pass.

## Discipline

Do not treat a performance-looking change to source-node ownership as cosmetic. It can change which samples receive lift propulsion or banking, and therefore change a preset ride. Any completed-ride ownership change needs a deliberate physics decision, measured preset matrix, and an updated fingerprint record before it can ship.

Run:

```sh
npm install --no-save --no-package-lock three@0.160.0
node tests/curve-parameter-cache-regression.mjs
node tests/physics-regression.mjs
```
