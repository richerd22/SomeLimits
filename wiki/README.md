# SomeLimits wiki

SomeLimits is a browser-based roller coaster builder. You place points on a ground plane, drag them around, set height and banking, and get a full closed-circuit coaster you can ride. It is a loving, low-key revival of the NoLimits 1 building feel - relaxed building, real coaster grammar underneath - not a remake, not a clone, and not affiliated with NoLimits. Original code, original assets. The name is a dry joke: a coaster sim with some limits. there always were.

North star, in one line: a returning NL1 builder lays a full closed-circuit coaster within minutes, zero tutorial.

## Start here

- [Player guide](player-guide.md) - building your first coaster, controls, riding, library, sharing, FAQ.
- [Code](code.md) - how the single HTML file works: track math, physics, save formats.
- [Dev](dev.md) - running it locally, repo layout, conventions, testing, forking.
- [Admin](admin.md) - hosting, updates, ownership, trademark posture, and the imagery rule.

There is also an in-app Field Manual. Press H in the app for the short version of the player guide.

## The app in one paragraph

The whole game is one self-contained HTML file at `play/index.html`. It uses Three.js from a CDN. No build step, no backend, no accounts. Your coasters live in your browser. See the player guide for what that actually means for your saves.

## House rules

- No AI-generated imagery anywhere in the project. Logo, textures, splash art, none of it. Visuals are hand-drawn SVG or code-rendered 3D only. See [Admin](admin.md) for the policy version.
- Loving knockoff posture. Homage in spirit only. No NoLimits assets, code, or branding. The only bridge is the documented CSV spline format in [Code](code.md).
- Defaults always yield a rideable circuit. If a first build can stall, confuse, or dead-end, that is a bug in the design, not a skill issue for the player.
- Honest copy. If a feature is not in v1, the docs say planned, not present.

## Status

v1, shipped. Anything beyond the shipped list in these pages is marked planned.
