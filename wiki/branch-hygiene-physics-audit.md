# Branch hygiene + physics audit — 18 November 2026

This is the reconciled state of the **SomeLimits** GitHub repository after the independent Muse review. It is written from GitHub PR/commit/check data, not from branch names alone.

## Executive finding

Muse observed ~14 feature branches with GitHub comparing each branch as "ahead" and "behind" main, and inferred that the lift fix might be waiting to merge. **Those branch pointers are stale, but the features are not unmerged.** All PRs **#1 through #15** were **merged into main** via GitHub's **squash merge**, and the source of truth is `main` at `play/index.html`.

Squash merge creates a **new commit** with the PR's combined changes. GitHub then reports the original feature branch as having commits ahead of main, and main as having commits behind it, even when every intended file change landed. This is why comparing *commit ancestry* rather than the actual merged PR and code can produce a false "merge swamp" diagnosis. **Do not merge those old branches again just to make ahead/behind counts go to zero.**

The real hygiene issue is **undeleted branch refs**. They clutter branch menus and can confuse other agents who inspect all branches instead of checking PR status. This audit itself uses one dedicated short-lived branch; after merging it, the repo should return to one canonical `main` plus no old merged PR heads.

## Merged PR ledger

| PR | Feature | Result |
|---|---|---|
| [#1](https://github.com/richerd22/SomeLimits/pull/1) | Initial lift dispatch, flat circuit tires, true sampled segment ownership, direct height drag | **Merged**, not stranded |
| [#2](https://github.com/richerd22/SomeLimits/pull/2) | Editor rebuild / library stability | Merged |
| [#3](https://github.com/richerd22/SomeLimits/pull/3) | Support-clearance spatial broadphase | Merged |
| [#4](https://github.com/richerd22/SomeLimits/pull/4) | Mobile raster cap and lazy blueprints | Merged |
| [#5](https://github.com/richerd22/SomeLimits/pull/5) | Actual desktop and mobile Chromium WebGL integration | Merged |
| [#6](https://github.com/richerd22/SomeLimits/pull/6) | Exactly one dragged point moves; no hidden neighbor banking edits | Merged |
| [#7](https://github.com/richerd22/SomeLimits/pull/7) | Recover unfinished builds as draft JSON, honest autosave failures | Merged |
| [#8](https://github.com/richerd22/SomeLimits/pull/8) | Frame the single station in the camera | Merged |
| [#9](https://github.com/richerd22/SomeLimits/pull/9) | Post-lap real speed-assist feedback and reset G-force trace | Merged |
| [#10](https://github.com/richerd22/SomeLimits/pull/10) | Blank controls and exactly one station | Merged |
| [#11](https://github.com/richerd22/SomeLimits/pull/11) | Pointer cancellation / focus loss recovery; genuine touch tests | Merged |
| [#12](https://github.com/richerd22/SomeLimits/pull/12) | Real mobile sideways point drag tests | Merged |
| [#13](https://github.com/richerd22/SomeLimits/pull/13) | Orange height cap and blue bank grip on first station | Merged |
| [#14](https://github.com/richerd22/SomeLimits/pull/14) | Live floating first-station height/bank readouts | Merged |
| [#15](https://github.com/richerd22/SomeLimits/pull/15) | Blue roll grip scales for mobile zoom; five-point banked/nonstation browser tests | Merged |

The PR and commit history is the durable evidence. Feature branch names are temporary work pointers, not independent products or feature flags. The live player was verified from `main`, including `LIFT_SPEED=7.0`, `DISPATCH_SPEED=6.5`, `FLAT_DRIVE_SPEED=6.5`, point-local `bank`, `buildSelectedEditHandles`, `editGripRadius`, etc.

## Physics change: explicitly intentional and now fully fingerprinted

The lift repair **did change ride physics**, and the repo called this out at the time. See [November 18 playtest report](../playtest-2026-11-18.md). Previous and current fixed-step results:

| Layout | Old lap | New lap | Old top speed | New top speed |
|---|---:|---:|---:|---:|
| Classic | 47.84 s | **27.45 s** | 86 km/h | **88 km/h** |
| Oval | 33.42 s | **22.22 s** | 75 km/h | **77 km/h** |
| Wild | 52.88 s | **31.44 s** | 90 km/h | **92 km/h** |
| Looper | 62.85 s | **38.08 s** | 73 km/h | **75 km/h** |
| User's 47.5m hill | 89.91 s | **61.62 s** | 90 km/h | **91 km/h** |
| Flat 210m circuit | 181.49 s | **38.40 s** | 4 km/h | **23 km/h** |

The 47.5m hill's first lift began at **5.42s**, rather than 35.08s; crest at **14.42s**, rather than 41.85s. Station dispatch, auto chain, true node-to-track sample mapping and flat-course tire drive account for the change. This was not a cosmetic refactor and should not be silently rebaselined again.

**Audit fix:** before this round, `tests/physics-regression.mjs` guarded Classic's exact new time/speed, custom playtest lift/crest, and flat course; it merely required the other three presets to finish in under 50s. This was a gap. The new regression pins **both lap time and rounded maximum speed of all four presets**, asserts the fingerprint keys exactly match the code's available presets, prints every result in CI, and continues to verify the custom playtest and flat case.

- [Source-backed physics regression](../tests/physics-regression.mjs)
- [Ride and chain architecture](code.md)
- [Ride insight](ride-insight.md)

These values are from `stepRide()` driven at **1/60s** using the exact production CORE and pinned **Three.js 0.160.0**. Browser frame pacing can produce minor displayed time differences. Test timing tolerances are tight (0.15s); rounded speed fingerprints are exact. Recompute and explicitly justify **all** baseline changes when modifying the integrator, not just Classic.

## Safe branch cleanup

**Preferred, and what should happen next:** after verifying PR #1–#15 are indeed merged and there is no open PR referencing an old head, delete their **remote feature branches** using [GitHub Branches](https://github.com/richerd22/SomeLimits/branches) or each merged PR's "Delete branch" action. This removes stale refs **without deleting the squash-merged changes or merged PR history**. Preserve `main`. Never delete an actively used agent branch, a protected branch, or one with a still-open PR.

The linked GitHub connector in this environment supports branch creation, updates, and PR merge but **does not expose a delete-branch operation**. Therefore this audit does **not** claim those 15 old branches were deleted. They are safe to delete *after* checking any separate agents are not still using them. Do not force-update stale branch refs to main as a fake substitute for deletion—that rewrites historical pointers and makes conflict diagnosis harder.

**Recommended settings/workflow:** enable GitHub repository setting **Settings → General → Pull Requests → Automatically delete head branches**, if your repo permissions allow it; keep a single short-lived branch per PR, use a green regression check before merge, squash merge, and inspect `main` again before starting the next improvement. If external agents have their own active branches, coordinate before deleting them.

## Main-first verification checklist

- [ ] Confirm `play/index.html` on `main` is the served player at `/play/`; root redirect preserves share hash.
- [ ] Confirm all four explicit preset fingerprints, the 47.5m lift/crest timings and flat-circuit case pass the pinned `physics-regression.mjs`.
- [ ] Confirm editor, source mutation, pointer abort, draft rescue, post/beam collision, render lifecycle and actual desktop/mobile Chromium WebGL checks pass on the final merge commit.
- [ ] Confirm GitHub Pages deploy succeeds on the same new main SHA.
- [ ] Confirm **all PRs to be cleaned up have `merged_at` populated** and no open dependent PRs exist.
- [ ] Delete the obsolete merged feature branch refs, leaving `main` and any clearly active work branches.
- [ ] Continue physical iOS Safari touch/FPS testing; automated mobile Chromium is **not** an Apple hardware test.

## Product discipline

The north star remains a playful, forgiving NoLimits 1-style coaster editor: a few directly manipulable points, point-local banking and automatic lifts. No new nested mode taxonomy, no AI-generated imagery, no secret backend, no unreviewed physics change. Bigger ambitions need better baseline verification, not more stale feature branches.
