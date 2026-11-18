# Open draft backup and honest autosave failure

Updated November 18, 2026.

## Problem

SomeLimits has no server, account or cloud sync. The current coaster is recovered from `localStorage['somelimits-autosave-v1']`; the library uses a separate localStorage key.

Before this change, `autosave()` did this:

```js
try { localStorage.setItem(key, JSON.stringify(document)); } catch {}
```

When storage was full or browser privacy policy blocked writes, **every edit looked normal and the game silently failed to preserve it**. A reload could lose the latest coaster. The existing library path already handled quota errors honestly, but there was no warning for the everyday autosave.

Worse, the JSON export button refused to export unfinished tracks. So the people most likely to lose work—someone halfway through a first coaster with only a station or two—had no built-in recovery file.

## Changes

### Autosave reports the truth

- `autosave()` still persists the same `{name, nodes, building}` object under the same localStorage key. No migration or key rename.
- On quota/permission failure, the method returns false, displays a toast and persists a warning under the panel's Save controls: **"autosave failed - export JSON before closing this tab."**
- Repeated failing commits are debounced as a single toast, not a message for every drag.
- If a later save succeeds, failure state is reset, a one-time recovery toast appears, and the persistent autosave warning clears to **"autosave working again."**
- The current coaster remains editable in memory while storage is unavailable; undo history is not erased.

### JSON backs up unfinished coasters

- The existing **JSON** export button now works in the open-building state, including empty plots, one station, two or three points and unfinished tracks with four or more points. No new button or mode.
- Open builds download as `<coaster>.somelimits-draft.json`, with an explicit `app:'somelimits'`, `version:1`, `building:true`, `name` and source `nodes` fields.
- Importing this branded draft restores the **open** building state. Even a draft with 4+ points remains open until the builder closes it. It does not become a fake complete circuit.
- A draft can contain zero points. For 1+ points, the first is the station. Banking, lift flags, heights and point order are preserved with the existing numeric limits.
- Completed coaster JSON exports retain the previous schema and filename, and completed JSON imports still require four or more points. CSV and URL share formats are unchanged.

### One source of draft sanitization

`sanitizeDraftNodes()` is shared by branded draft imports/exports and boot-time recovery of an unfinished coaster from autosave. It admits fewer than four points but keeps the same coordinate, height, bank, lift and station rules that were previously duplicated in boot logic. The strict `sanitizeNodes()` still validates finished circuits.

The UI import handler now reads `parsed.building`. Open drafts with zero/one node frame the plot; longer open drafts frame their existing track. It does not allow RIDE IT until the user closes the loop.

## Verification

`tests/draft-rescue-regression.mjs` reads the **real game CORE** and actual autosave helper from `play/index.html` to test:

- 0, 1, 2, 3 and 5-point branded draft round-trips.
- Drafts with four or more points remain open.
- Finished-coaster schema and its minimum four-point validation remain unchanged.
- Bank and lift values stay on points; first draft point is the station.
- Malformed drafts are rejected; node numbers remain bounded.
- Quota failure returns false, warns once, persists the warning, then reports recovery exactly once and can warn again on a later failure.
- The real source JSON export button uses `serializeDraft` in building state and import preserves `building`.

In addition, the maintainer-only headless Chromium smoke exercises the actual UI: creates a new plot, places one station, clicks JSON export, captures the downloaded file, reimports that file, and checks the restored document still has **one point and `building:true`**. This is a browser test—not a new production dependency.

All existing physics, exact-support clearance, editor lifecycle, mobile-thumbnail and point-drag checks still run in CI. **Classic fingerprint remains 27.45s / 88 km/h.**

## Manual acceptance

- [ ] Block localStorage writes or simulate a full quota; make several edits. The warning should appear once in a toast and persist under the save controls.
- [ ] Export JSON while still placing the first station. Verify the draft file downloads and contains `building:true`.
- [ ] Open the downloaded draft on a separate browser/device. Continue adding points and close it normally.
- [ ] Export and import a draft with 5+ points; it must still be open after import.
- [ ] Re-enable localStorage; the autosave warning should clear after the next commit and a one-time recovery toast should appear.
- [ ] Completed coaster JSON, NL2 CSV and share-link round trips still work.
- [ ] Confirm a blocked library write never falsely reports a successful library save.

## Limits

- LocalStorage is **not cloud backup** and can be cleared by the browser, private mode, quotas or the device owner.
- The app cannot guarantee an export download succeeds if a browser blocks downloads; it initiates a local download using the standard browser API. Keep a file outside the browser for anything important.
- Draft JSON is intended for SomeLimits only; NoLimits 2-style CSV supports completed sampled tracks, not in-progress point editing.
- No AI-generated imagery, no new app mode, no new account, no build step, no new external service.

See [Player guide](player-guide.md), [Architecture](code.md), [Developer workflow](dev.md) and [Browser smoke](browser-smoke.md).
