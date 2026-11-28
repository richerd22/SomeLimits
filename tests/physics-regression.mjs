// Run from the repository root:
//   npm install --no-save --no-package-lock three@0.160.0
//   node tests/physics-regression.mjs
// Uses the CORE section from the shipped game verbatim. No game build step.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const html = readFileSync(new URL('../play/index.html', import.meta.url), 'utf8');
const coreSource = html.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)?.[1];
assert.ok(coreSource, 'game core markers missing');
const { PRESETS, computeTrack, sampleAt, createRide, stepRide, encodeCoaster, decodeCoaster } =
  new Function('THREE', coreSource + '\nreturn {PRESETS, computeTrack, sampleAt, createRide, stepRide, encodeCoaster, decodeCoaster};')(THREE);

// Exact point layout from the Nov 2026 playtest share link, including the 47.5m climb.
const userNodes = [
  {x:23.950903782280555,z:2.2588449686269327,h:3,bank:0,station:true},
  {x:26.982670343133708,z:-34.60064750483943,h:3,bank:0},
  {x:9.550903782280557,z:-72.01115503137306,h:50.5,bank:0},
  {x:-66.73430854960213,z:-70.75025722322589,h:3,bank:0},
  {x:-96.46205699713475,z:41.09828517849408,h:3,bank:0},
  {x:-45.9,z:84.2,h:3,bank:0},
  {x:14.9,z:74.7,h:3,bank:0},
  {x:18.105,z:41.835,h:3,bank:0}
];
const flatNodes = [
  {x:-25,z:25,h:3,bank:0,station:true},
  {x:-25,z:-25,h:3,bank:0},
  {x:25,z:-25,h:3,bank:0},
  {x:25,z:25,h:3,bank:0}
];

function lap(nodes) {
  const track = computeTrack(nodes);
  const ride = createRide(track);
  const top = Math.max(...nodes.map(n => n.h));
  let firstLift = null, crest = null;
  for (let i = 0; i < 36000 && !ride.finished; i++) {
    const here = sampleAt(track, ride.s);
    if (firstLift === null && here.lift) firstLift = ride.time;
    if (crest === null && here.pos.y >= top - 0.5) crest = ride.time;
    stepRide(track, ride, 1 / 60);
  }
  assert.ok(ride.finished, 'lap never finished');
  return {seconds:ride.time, maxKmh:Math.round(ride.maxV * 3.6), firstLift, crest, track};
}
function near(actual, expected, tolerance, what) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    what + ': expected ' + expected + ' +/- ' + tolerance + ', got ' + actual);
}

/* Round 17 restored the sacred ride integrator and deliberately changed
   only LIFT_SPEED from 5.2 to 7.0 m/s. These values lock that documented,
   provisional baseline: never rebaseline merely to make a physics change
   pass. They are fixed-step 1/60s CORE simulations using pinned Three.js
   r160, not promises for browser-frame-paced lap UI timings. */
const EXPECTED = Object.freeze({
  classic: {seconds: 44.40, maxKmh: 86},
  oval:    {seconds: 29.80, maxKmh: 76},
  wild:    {seconds: 49.00, maxKmh: 90},
  loop:    {seconds: 60.30, maxKmh: 73}
});
assert.deepEqual(Object.keys(EXPECTED).sort(),Object.keys(PRESETS).sort(),
  'every available preset must have a checked physics fingerprint');
const presetLaps = {};
for (const [name, expected] of Object.entries(EXPECTED)) {
  const result = lap(PRESETS[name]);
  near(result.seconds, expected.seconds, 0.15, name + ' lap seconds');
  assert.equal(result.maxKmh, expected.maxKmh, name + ' max km/h');
  assert.ok(result.track.totalLen > 0, name + ' computed track length');
  presetLaps[name] = result;
}
console.log('Physics fingerprint (game CORE @ 1/60s, Three.js r160):');
for (const [name, result] of Object.entries(presetLaps)) {
  console.log(' ', name, result.seconds.toFixed(2) + 's / ' + result.maxKmh + ' km/h');
}
const player = lap(userNodes);
near(player.seconds, 87.25, 0.15, 'playtest circuit seconds');
near(player.firstLift, 35.08, 0.15, 'time to playtest lift');
near(player.crest, 40.10, 0.15, 'time to playtest crest');
assert.ok(player.track.samples.some(s => s.lift));
assert.ok(player.track.samples.every(s => !s.lift || s.nodeSeg === 1),
  'auto chain belongs only to the 47.5m climb, not some other stretch');
const flat = lap(flatNodes);
assert.equal(flat.track.poweredFlat, undefined,
  'flat circuits retain the baseline minimum-speed crawl; no tire-drive mode is present');
near(flat.seconds, 181.49, 0.15, 'flat minimum-speed lap');
assert.equal(flat.maxKmh, 4);
const overrideFlat = flatNodes.map(n => ({...n}));
overrideFlat[1].lift = true;
assert.equal(computeTrack(overrideFlat).poweredFlat, undefined,
  'a lift flag on a flat segment must not introduce tire-drive physics');

// Save/share schema remains unchanged; banking stays on each node.
const encoded = encodeCoaster('playtest', userNodes);
assert.deepEqual(decodeCoaster(encoded).nodes, userNodes.map(n =>
  ({x:n.x,z:n.z,h:n.h,bank:n.bank,lift:!!n.lift,station:!!n.station})));
console.log('PASS: all four preset time+speed fingerprints, custom 47.5m hill, flat crawl, lift/crest, share round-trip');
console.log('Playtest lift:', player.firstLift.toFixed(2)+'s, crest:',player.crest.toFixed(2)+'s');
