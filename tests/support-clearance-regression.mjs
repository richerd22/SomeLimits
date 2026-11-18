// Exact support-clearance equivalence against brute-force logic.
// Run from repo root after temporary test-only Three.js install:
//   npm install --no-save --no-package-lock three@0.160.0
//   node tests/support-clearance-regression.mjs
// The playable single HTML file still has no build step or bundled libraries.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';

const html = readFileSync(new URL('../play/index.html', import.meta.url), 'utf8');
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'game module absent');
new Function(script.replace(/^import[^\n]*\n/gm, ''));
const coreSource = html.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)?.[1];
assert.ok(coreSource, 'core missing');
const {PRESETS,computeTrack} = new Function('THREE',
  coreSource + '\nreturn {PRESETS,computeTrack};')(THREE);

// Read the actual shipping index, not a test-specific reimplementation.
const indexStart = script.indexOf('function supportSpatialIndex(');
const indexEnd = script.indexOf('/* Pointer events can arrive',indexStart);
assert.ok(indexStart >= 0 && indexEnd > indexStart, 'support index marker missing');
const supportSpatialIndex = new Function(script.slice(indexStart,indexEnd)+'\nreturn supportSpatialIndex;')();
const beamStart = script.indexOf('  const beamClear = (far, beamC, sideU, halfLen) => {');
const beamEnd = script.indexOf('  const frameReport =',beamStart);
assert.ok(beamStart >= 0 && beamEnd > beamStart, 'beam clearance marker missing');
const beamClear = new Function(script.slice(beamStart,beamEnd)+'\nreturn beamClear;')();

const player = [
{x:23.950903782280555,z:2.2588449686269327,h:3,bank:0,station:true},
{x:26.982670343133708,z:-34.60064750483943,h:3,bank:0},
{x:9.550903782280557,z:-72.01115503137306,h:50.5,bank:0},
{x:-66.73430854960213,z:-70.75025722322589,h:3,bank:0},
{x:-96.46205699713475,z:41.09828517849408,h:3,bank:0},
{x:-45.9,z:84.2,h:3,bank:0},
{x:14.9,z:74.7,h:3,bank:0},
{x:18.105,z:41.835,h:3,bank:0}
];
// Two passes cross in X/Z with a height separation, plus negative cells.
const crossover = [
{x:-65,z:-55,h:4,bank:0,station:true},
{x:-2,z:0,h:36,bank:0},
{x:65,z:55,h:4,bank:0},
{x:70,z:0,h:4,bank:0},
{x:-65,z:55,h:4,bank:0},
{x:2,z:0,h:14,bank:0},
{x:65,z:-55,h:4,bank:0},
{x:-70,z:0,h:4,bank:0}
];
const flat = [
{x:-25,z:25,h:3,bank:0,station:true},
{x:-25,z:-25,h:3,bank:0},
{x:25,z:-25,h:3,bank:0},
{x:25,z:25,h:3,bank:0}
];
let probes=0, originalTests=0, indexedTests=0, beamTests=0;
const R = Math.sqrt(2.9);
function farEnough(q, sm, total) {
  let dArc = Math.abs(q.s - sm.s);
  dArc = Math.min(dArc, total - dArc);
  return dArc >= 8;
}
function wouldSpear(q,sm,total) {
  if (!farEnough(q,sm,total)) return false;
  const dx=q.pos.x-sm.pos.x,dz=q.pos.z-sm.pos.z;
  return dx*dx + dz*dz < 2.9 && q.pos.y < sm.pos.y - 1.2;
}
function oldBeam(far, beamC, sideU, halfLen) {
  let min=Infinity;
  for(let k=0;k<=8;k++){
    const t=(k/8*2-1)*halfLen;
    const px=beamC.x+sideU.x*t,py=beamC.y+sideU.y*t,pz=beamC.z+sideU.z*t;
    for(const q of far) min=Math.min(min,Math.hypot(q.pos.x-px,q.pos.y-py,q.pos.z-pz));
  }
  return min;
}
for(const [name,layout] of Object.entries({...PRESETS, playtest:player,crossover,flat})){
  const track=computeTrack(layout), smp=track.samples, index=supportSpatialIndex(smp);
  for(const sm of smp) {
    const expected=smp.some(q=>wouldSpear(q,sm,track.totalLen));
    const near=index.near(sm.pos.x,sm.pos.z,R);
    const result=near.some(q=>wouldSpear(q,sm,track.totalLen));
    assert.equal(result,expected,name+' at arc '+sm.s);
    originalTests+=smp.length;
    indexedTests+=near.length;
    probes++;
    // Every sample potentially colliding with the post must be indexed,
    // including the last/first seam and negative grid cells.
    for(const q of smp){
      const dx=q.pos.x-sm.pos.x,dz=q.pos.z-sm.pos.z;
      if(dx*dx+dz*dz<2.9)assert.ok(near.includes(q),name+' false-negative cell');
    }
  }
  for(let i=0;i<smp.length;i+=23){
    const sm=smp[i], far=smp.filter(q=>farEnough(q,sm,track.totalLen));
    const centre=sm.pos.clone().addScaledVector(sm.up,-0.45);
    const old=oldBeam(far,centre,sm.side,2.7);
    const revised=beamClear(far,centre,sm.side,2.7);
    assert.ok(Math.abs(old-revised)<1e-9,name+' beam minimum changed '+old+' / '+revised);
    assert.equal(old<1.15,revised<1.15,name+' beam accept/reject changed');
    beamTests++;
  }
}
assert.ok(indexedTests < originalTests * 0.25,'index is no better than brute force');
const reduction=(1-indexedTests/originalTests)*100;
console.log('PASS: '+probes+' exact post probes, '+beamTests+' beam clearances across presets, playtest, crossing, flat');
console.log('Post comparisons: '+originalTests+' brute-force -> '+indexedTests+' indexed ('
  +reduction.toFixed(1)+'% fewer candidate checks)');
console.log('Beam distances: same minima and pass/fail, one square root per complete query');
