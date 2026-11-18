# Browser smoke tests: real WebGL, DOM and mobile viewport

Updated November 18, 2026. The test is for maintainers. The player app is still a single HTML file, no build step or extra runtime libraries.

## What unit tests cannot demonstrate

The existing checks proved the sampled physics, library helper logic and collision-clearance mathematics. They did not boot the actual webpage with Three.js, demonstrate that a selected height slider really commits to autosave, check that a saved library blueprint appears on screen, or tap a blank plot as a simulated mobile device.

`tests/browser-smoke.mjs` adds that missing integration layer with a genuine headless Chromium browser.

## Approach

- The test starts a tiny Node HTTP server in the repository root, serving the unchanged `play/index.html`.
- The page still uses its production importmap pointing to pinned `three@0.160.0` on unpkg.
- A Playwright route fulfills those exact external Three.js module requests from the version that GitHub Actions already installed under `node_modules/three`. This avoids flaky CDN network availability during tests without changing the public game code.
- Headless Chromium runs with software WebGL (SwiftShader) flags in CI. This checks real browser module evaluation, scene setup, WebGL rendering and DOM interactions, not a canvas mock.
- The test captures uncaught page errors and console errors and fails on unexpected errors.

### Desktop flow

1. Open the game and wait for `window.__slBooted`.
2. Confirm support-frame diagnostics are created and the indexed centre-post candidates are fewer than a full scan.
3. Leave the title screen, verify a complete classic preset is loaded.
4. Change the station point's height with the actual `#rngH` DOM slider; send normal `input` and `change` events and verify the new height is in localStorage autosave while banking is unchanged.
5. Save to the actual library through `#btnSaveLib`. Assert node data is present and PNG previews are **not** persisted in localStorage.
6. Open the Library and wait for the code-generated PNG thumbnail to appear from the `IntersectionObserver` path. Validate it loads.

### Simulated high-DPI phone

1. Open in a Chromium mobile context: CSS viewport 390 x 844, touch enabled, deviceScaleFactor 3.
2. Verify the canvas backing size is 780 x 1688: the shipped 2x DPR cap is in effect.
3. Tap `+ new coaster` on the title screen and verify the saved document is an empty, open building plot.
4. Tap the middle of the canvas to place the first station point. Verify the node is actually persisted with `station: true`.

This is still Chromium **mobile emulation**, not physical iOS Safari. It does not establish hardware FPS or multi-finger behavior.

## Running manually

```sh
npm install --no-save --no-package-lock three@0.160.0 playwright@1.56.1
npx playwright install --with-deps chromium
node tests/browser-smoke.mjs
```

These are **test-time** dependencies. They do not alter `play/index.html` or create a visitor-facing build step. No `package.json` is required.

The browser test is part of the same CI workflow as the editor lifecycle, lazy library/DPR, collision-clearance equivalence and physics/share regressions. On pull requests and pushes to `main`, these guard against accidental boot, edit, save, and mobile blank-plot regressions.

## What this does not claim

- Real iPhone/iPad Safari, actual multi-touch or GPU memory usage are not measured.
- No guarantees of 60 FPS or frame-time stability on individual phones.
- Visual correctness of every coaster layout is not fully covered by this smoke flow. Loops, crossovers, supports and banking still have source tests plus a manual hardware checklist.
- No new generated imagery: any thumbnails in this smoke are rendered from the actual saved coaster geometry in a standard canvas.

## Next tests worth adding

- Accurate on-canvas drag of a node up/down and sideways using projected 3D coordinates, including cancellation with two fingers.
- Screenshot comparison only from actual deterministic game renders, if stable enough to avoid meaningless anti-aliasing noise.
- Opening an existing share URL and importing an old JSON/CSV file through real DOM buttons.
- Real iOS Safari interaction audit by a human or on-device browser automation.

The north star is unchanged: no tutorial or mode taxonomy, just place points, drag, ride. Test infrastructure should never become a build requirement for the player.
