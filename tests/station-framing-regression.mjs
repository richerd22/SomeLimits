// Framing the only point must not require a completed track.
// Run: node tests/station-framing-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
new Function(script.replace(/^import[^\n]*\n/gm,'')); // full game parses
const from=script.indexOf('function plotFrameTarget(list) {');
const to=script.indexOf('/* the hint line while building',from);
assert.ok(from>=0&&to>from,'plot camera functions missing');
const src=script.slice(from,to);
const station={x:-111,z:93,h:46,bank:90,station:true};
function setup(nodes){
 const calls={camera:[],target:[],up:[],updates:0};
 const camera={position:{set:(...a)=>calls.camera.push(a)},up:{set:(...a)=>calls.up.push(a)}};
 const controls={target:{set:(...a)=>calls.target.push(a)},update:()=>calls.updates++};
 const fns=new Function('nodes','camera','controls',src+'\nreturn {plotFrameTarget,framePlot};')(nodes,camera,controls);
 return {calls,...fns};
}
const empty=setup([]);
assert.deepEqual(empty.plotFrameTarget([]),{x:0,y:2,z:0});
empty.framePlot();
assert.deepEqual(empty.calls.camera,[[52,46,74]],'empty plot keeps familiar original camera');
assert.deepEqual(empty.calls.target,[[0,2,0]]);
assert.deepEqual(empty.calls.up,[[0,1,0]]);
assert.equal(empty.calls.updates,1);

const lone=setup([station]);
assert.deepEqual(lone.plotFrameTarget([station]),{x:-111,y:46,z:93});
lone.framePlot();
assert.deepEqual(lone.calls.target,[[-111,46,93]],'station must become orbit target');
assert.deepEqual(lone.calls.camera,[[-59,90,167]],'camera offset follows moved station');
assert.deepEqual(station,{x:-111,z:93,h:46,bank:90,station:true},
  'framing does not mutate the saved station');
assert.equal(lone.calls.updates,1);
const ground=setup([{x:120,z:-120,h:1,station:true}]);
ground.framePlot();
assert.deepEqual(ground.calls.target,[[120,2,-120]],'keep target safely above ground');
assert.deepEqual(ground.calls.camera,[[172,46,-46]]);
assert.deepEqual(setup([station,{x:4,z:3,h:5}]).plotFrameTarget([station,{x:4,z:3,h:5}]),
  {x:0,y:2,z:0},'multi-point strips rely on regular spline framing');

const fst=script.indexOf('function frameTrack() {');
const fend=script.indexOf('/* ---------------- building from blank ----------------',fst);
assert.ok(fst>=0&&fend>fst);
let fallback=0;
const frameTrack=new Function('track','framePlot',
  script.slice(fst,fend)+'\nreturn frameTrack;')(null,()=>fallback++);
frameTrack();
assert.equal(fallback,1,'Frame Track button must work with a null track');
console.log('PASS: empty plot unchanged, lone remote station framed, low station clamped, no mutation, Frame Track fallback');
