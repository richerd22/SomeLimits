# Admin

Hosting, updates, ownership, and policy. The boring page, written plainly.

## Hosting

The playable file is `play/index.html`. It is a static file with one CDN dependency (Three.js). Any static host works. There is no server code, no database, and no environment to configure.

Two free options:

### GitHub Pages

- Repo Settings, then Pages, then Build and deployment: deploy from a branch.
- Branch: `main`, folder: `/ (root)`. The repo root has an `index.html` that sends visitors straight to `play/`, and a `.nojekyll` file so Pages serves the files as-is.
- New commits on `main` deploy automatically once Pages is on. The repository also has a separate GitHub Actions regression job for editor and physics tests; it does not bundle, transform, or otherwise build the game.

### Cloudflare Pages

- Connect the repo in Cloudflare Pages.
- Build command: none. There is no build step.
- Output directory: the repo root, or `/play` if you want the game at the site root.

Either host picks up new commits on the served branch automatically. Nothing else to wire up: no functions, no redirects required by the game itself, no secrets in the page.

## How updates flow

1. Edit `play/index.html`.
2. Test locally - see [Dev](dev.md): serve it, ride a preset, round-trip a save.
3. Push to the repo with a normal git push.
4. The static host deploys the new commit on its own. Check the live page after it settles - a pushed commit is not a verified deploy until the page you open is the page you edited.

Saves compatibility on every update: import must keep accepting the previous save shapes. See the versioning notes in [Dev](dev.md).

## Ownership and moderation

- SomeLimits is an open-source project, MIT licensed - see [../LICENSE](../LICENSE) and [Dev](dev.md).
- There is nothing to moderate server-side, by design:
  - No accounts, no uploads, no comments, no user content stored anywhere.
  - Saves live in each visitor's own browser localStorage. Nobody else can see them.
  - Share links encode the track data in the URL hash itself. Whoever holds a link holds that coaster. There is no listing, feed, or directory of links to moderate, and no link can be revoked centrally.
- Support, such as it is, is: if your saves vanished, your browser cleared its storage. Export JSON next time. The player guide says the same thing in friendlier words, barely.

## Trademark posture

- SomeLimits is an original name. The logo is hand-drawn SVG, made for this project.
- The posture is homage in spirit only: a similar relaxed building feel, none of the original's assets, code, or branding.
- No NoLimits assets, code, or formats are used, beyond the documented CSV spline bridge - position plus up vectors, a plain-text exchange layout - described in [Code](code.md). No binary NoLimits formats are read or written.
- The not-affiliated line lives in the project README and in this wiki's [index](README.md): SomeLimits is not affiliated with NoLimits or Gravimetric.
- If that posture ever needs to change, it changes in the README first, then here. One source, then the copies.

## The no-AI-imagery rule, as policy

Policy: no AI-generated imagery anywhere in SomeLimits. Not the logo, not textures, not splash art, not wiki illustrations, not promotional graphics.

What is allowed, and is the whole list:

- hand-drawn vector (SVG), like the logo
- code-rendered geometry, like everything in the 3D view and the canvas blueprint thumbnails
- clean type

Reason, stated once: it is the project's standing aesthetic rule. AI-generated imagery reads as slop against the project's hand-made register, and a coaster builder whose pictures are generated while its tracks are hand-built would be off-brand in a way visitors can feel. The rule has been in force since day one and applies to contributors and forks that want to be associated with the project, not just to the main repo.

Screenshots of the actual running app are fine - they are the code-rendered game, captured, not generated.

## Checklist for a release

- [ ] Presets all ride start to finish and produce a lap summary.
- [ ] Old JSON, old CSV, and an old share link all still load.
- [ ] Live hosted page verified after deploy, not just the local file.
- [ ] Any new visual is SVG by hand, code-rendered, or type. No exceptions, no placeholders that quietly stay.
- [ ] Docs updated in the same push if behaviour changed.
- [ ] Editor regression passes (GPU disposal, pointer preview coalescing, library persistence and quota feedback).
- [ ] Mobile/library regression passes (DPR cap, lazy thumbnails, LRU eviction, older-browser fallback).
- [ ] Browser smoke passes (headless WebGL boot, desktop edit + save + thumbnail, emulated mobile blank plot + station tap). Keep physical iOS Safari manual testing separate.
- [ ] Direct point regression passes (no post-release neighbour shifts, no accidental bank edits, exact point position).
- [ ] Draft rescue regression passes (unfinished JSON round-trip, unchanged finished exports, quota warning and recovery). Browser smoke exercises actual export/import controls.
- [ ] If drag or rendering changed, validate pointercancel and iOS Safari on hardware; headless tests do not prove WebGL responsiveness.
