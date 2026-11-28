# Round 17 lift fingerprint

Round 17 restored the sacred ride integrator and changed one physics constant: `LIFT_SPEED` from 5.2 m/s to 7.0 m/s. The change answered the "lift hill super slow" playtest finding.

The decision is explicitly provisional pending Richard's ratification. It is not authority for further tuning.

## Current regression baseline

Fixed-step production-CORE simulations with Three.js r160 must remain within 0.15 seconds of:

| Preset | Lap time | Top speed |
|---|---:|---:|
| Classic | 44.40 s | 86 km/h |
| Oval | 29.80 s | 76 km/h |
| Wild | 49.00 s | 90 km/h |
| Looper | 60.30 s | 73 km/h |

The test also protects the shared 47.5 m lift timing, flat-track behavior, lift ownership, and save/share round-trip. Changing an expected value requires an intentional physics decision with recorded before/after evidence; UI/editor work must not rebaseline it.
