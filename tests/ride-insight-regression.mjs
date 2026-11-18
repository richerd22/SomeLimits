// Verify the reported ride insight corresponds to observed ride physics,
// and the restart button starts with a clean G-force trace.
// Run: npm install --no-save --no-package-lock three@0.160.0
//      node tests/ride-insight-regression.mjs
// This reads the exact game code, never a copied physics implementation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';

const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
const core=html.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)?.[1];
assert.ok(script&&core,'game module and core present');
new Function(script.replace(/^import[^\n]*\n/gm,'')); // browser game syntax
const {PRESETS,computeTrack,createRide,stepRide,sampleAt,lapInsight}=new Function(
 'THREE',core+'\nreturn {PRESETS,computeTrack,createRide,stepRide,sampleAt,lapInsight};')(THREE);

const track=computeTrack(PRESETS.classic);
const fresh=createRide(track);
assert.equal(fresh.assistSeconds,0);
assert.equal(fresh.firstAssistM,null);
assert.equal(fresh.slowestCruiseV,Infinity);
assert.equal(fresh.slowestCruiseM,null);
assert.match(lapInsight(fresh),/completed without a minimum-speed rescue/);

// No speed floor on a flat tire-powered track should be falsely called
// unpowered. This instrumentation must report what the physics did.
const flatNodes=[
{x:-25,z:25,h:3,bank:0,station:true},{x:-25,z:-25,h:3,bank:0},
{x:25,z:-25,h:3,bank:0},{x:25,z:25,h:3,bank:0}
];
const flatTrack=computeTrack(flatNodes),flatRide=createRide(flatTrack);
for(let i=0;i<200&&!flatRide.finished;i++)stepRide(flatTrack,flatRide,1/60);
assert.equal(flatTrack.poweredFlat,true);
assert.equal(flatRide.assistSeconds,0,'powered flat coaster must not report an artificial minimum-speed intervention');

// A slowed train on a sampled UNPOWERED section gets the same 1.2m/s
// guard as before. The diagnostics must record the actual intervention.
/* Choose the usable section through sampleAt(), the SAME lookup used
   by stepRide(). Raw sample.s indices and fractional s lookups need
   not agree exactly after a height-clamped spline. */
const probe=track.samples.find(sm=>{
  if(sm.s<45||sm.s>track.totalLen-45)return false;
  for(let d=0;d<=3;d+=0.5){
    const here=sampleAt(track,sm.s+d);
    if(here.lift||here.brake)return false;
  }
  return true;
});
assert.ok(probe,'need unpowered test section outside brake and chain');
const slow=createRide(track);
slow.s=probe.s; slow.traveled=55;slow.v=0.1;
for(let i=0;i<25;i++){
  slow.v=0.1; // deliberately slow state to exercise longstanding guard
  stepRide(track,slow,1/60);
}
assert.ok(slow.assistSeconds>0,
  'record the actual short intervention at unpowered section; got '+slow.assistSeconds);
assert.equal(slow.firstAssistM,55,'record first assist location in travel metres');
assert.ok(Number.isFinite(slow.slowestCruiseV));
assert.ok(slow.slowestCruiseV<=1.2+1e-9,'slowest unpowered section recorded');
assert.match(lapInsight(slow),/brief minimum-speed assist occurred/,
  'a real short assist cannot be reported as no rescue');
const warned=lapInsight({...slow,assistSeconds:0.5});
assert.match(warned,/minimum-speed assist for/);
assert.match(warned,/55 m into the lap/);
assert.match(warned,/8 m\+ rise/);
assert.doesNotMatch(warned,/real-world safety/);

const almost={assistSeconds:0,firstAssistM:null,slowestCruiseV:2.5,slowestCruiseM:75};
assert.match(lapInsight(almost),/slow section: 9 km\/h about 75 m/);
assert.match(lapInsight({...almost,slowestCruiseV:3}),/completed without a minimum-speed rescue/);

// Run the classic lap from 1/60 time stepping. Telemetry must not
// change any integration result; new metrics are read-only observers.
const normal=createRide(track);
for(let i=0;i<36000&&!normal.finished;i++)stepRide(track,normal,1/60);
assert.ok(normal.finished);
assert.ok(Math.abs(normal.time-27.45)<0.1,'classic lap timing changed');
assert.equal(Math.round(normal.maxV*3.6),88,'classic max speed changed');
assert.ok(normal.assistSeconds>=0);
assert.equal(typeof lapInsight(normal),'string');

// Extract the REAL lap reset routine. All entry points, including HUD
// restart and results-screen ride again, must use it.
const resetStart=script.indexOf('function resetLapState() {');
const resetEnd=script.indexOf('function startRide()',resetStart);
assert.ok(resetStart>=0&&resetEnd>resetStart);
const gHist=[{v:1.3,l:0.6},{v:-0.2,l:2.1}];
const harness=new Function('createRide','track','gHist',
  'let ride={badOldState:true}; let lapShown=true;\n'+
  script.slice(resetStart,resetEnd)+
  '\nreturn {resetLapState, state:()=>({ride,lapShown})};'
)(createRide,track,gHist);
harness.resetLapState();
const newState=harness.state();
assert.equal(newState.lapShown,false);
assert.equal(newState.ride.badOldState,undefined);
assert.equal(newState.ride.assistSeconds,0);
assert.equal(gHist.length,0,'G-force trace from last lap must be cleared');
assert.ok(script.includes("$('btnRestart').addEventListener('click', resetLapState)"));
assert.ok(script.includes("$('btnLapAgain').addEventListener('click', () => { $('lapScreen').classList.remove('open'); resetLapState();"));
assert.ok(script.includes("$('lapInsight').textContent = lapInsight(ride)"));
console.log('PASS: observed assist duration/location, honest flat tires and slow sections, exact classic physics, fresh lap G-trace');
