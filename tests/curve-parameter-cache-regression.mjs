// Verify arc-length to curve parameter lookup is cached once per
// sample, then reused unchanged for height guards and lift/bank rules.
// Compare the actual production code to the immediately prior method.
// Temporary pinned Three.js is test-only, not a game dependency.
// Run: node tests/curve-parameter-cache-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {performance} from 'node:perf_hooks';

const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const game=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(game,'production game module not found');
new Function(game.replace(/^import[^\n]*\n/gm,''));
const core=game.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)?.[1];
assert.ok(core,'production CORE markers missing');
const oStart=game.indexOf('function bankAtOpen(nodes, f) {');
const oEnd=game.indexOf('/* fewer than 2 points:',oStart);
assert.ok(oStart>=0&&oEnd>oStart,'open spline functions missing');
const open=game.slice(oStart,oEnd);
const cacheLines='  const curveT = new Float64Array(SAMPLES + 1);\n'+
  '  for (let i = 0; i <= SAMPLES; i++) curveT[i] = curve.getUtoTmapping(i / SAMPLES);\n';
assert.equal(core.split(cacheLines).length-1,1,'closed curve must cache one mapping table');
assert.equal(open.split(cacheLines).length-1,1,'open curve must cache one mapping table');
function previousVersion(src) {
  const out=src.split(cacheLines).join('')
    .replaceAll('const t = curveT[i];','const t = curve.getUtoTmapping(i / SAMPLES);')
    .replaceAll('const f = curveT[i] * N;', 'const f = curve.getUtoTmapping(i / SAMPLES) * N;')
    .replaceAll('const f = curveT[i] * (N - 1);',
      'const f = curve.getUtoTmapping(i / SAMPLES) * (N - 1);');
  assert.ok(!out.includes('curveT['),'legacy path should not reference mapping cache');
  return out;
}
const make=(c,o)=>new Function('THREE',
  c+'\n'+o+'\nreturn {computeTrack,computeOpenTrack,PRESETS,SAMPLES};')(THREE);
const optimized=make(core,open);
const previous=make(previousVersion(core),previousVersion(open));
assert.equal(optimized.SAMPLES,900);
function snapshot(track) {
  return {
    totalLen:track.totalLen,
    stationS:track.stationS,
    poweredFlat:track.poweredFlat,
    samples:track.samples.map(sm=>({
      pos:sm.pos.toArray(),tan:sm.tan.toArray(),
      up:sm.up.toArray(),side:sm.side.toArray(),
      s:sm.s,lift:sm.lift,bankDeg:sm.bankDeg,
      nodeSeg:sm.nodeSeg,brake:sm.brake
    }))
  };
}
const originalMap=THREE.Curve.prototype.getUtoTmapping;
let calls=0;
THREE.Curve.prototype.getUtoTmapping=function(...args){
  calls++;return originalMap.apply(this,args);
};
function run(which,nodes,openTrack) {
  calls=0;
  const track=openTrack?which.computeOpenTrack(nodes):which.computeTrack(nodes);
  return {data:snapshot(track),calls};
}
try {
  const shapes=[
    ...Object.entries(optimized.PRESETS).map(([name,nodes])=>({name,nodes})),
    {name:'80-node uneven',nodes:Array.from({length:80},(_,i)=>({
      x:Math.cos(i*Math.PI/40)*(70+7*Math.sin(i*.18)),
      z:Math.sin(i*Math.PI/40)*(60+5*Math.cos(i*.29)),
      h:3+20*(1+Math.sin(i*.23)),bank:Math.round(85*Math.sin(i*.17)),
      station:i===9,lift:i%17===0
    }))},
    {name:'90-node vertical/crossover',nodes:Array.from({length:90},(_,i)=>({
      x:i%10===0?0:Math.cos(i*.44)*32,
      z:i%10===0?0:Math.sin(i*.44)*32,
      h:3+(i%11)*3,bank:(i%9-4)*30,
      station:i===0
    }))}
  ];
  for(const item of shapes)for(const openTrack of [false,true]){
    const a=run(optimized,item.nodes,openTrack);
    const b=run(previous,item.nodes,openTrack);
    assert.deepEqual(a.data,b.data,
      item.name+' '+(openTrack?'open':'closed')+' track geometry, banking, lifts and station changed');
    assert.equal(b.calls-a.calls,optimized.SAMPLES+1,
      item.name+' expected precisely one fewer 901-entry mapping pass');
    assert.ok(a.calls>optimized.SAMPLES,
      'still call the genuine Three.js arc-length mapping, never fake node fractions');
    console.log('PASS mapping parity '+item.name+' '+(openTrack?'open':'closed')+
      ': '+b.calls+' -> '+a.calls+' exact Three.js arc lookups');
  }
  const nodes=shapes[shapes.length-2].nodes;
  let optMs=0,oldMs=0;
  for(let i=0;i<4;i++){
    let t=performance.now();optimized.computeTrack(nodes);optMs+=performance.now()-t;
    t=performance.now();previous.computeTrack(nodes);oldMs+=performance.now()-t;
  }
  console.log('80-node track math sample (4 runs): cached '+optMs.toFixed(1)+
    'ms vs prior '+oldMs.toFixed(1)+'ms; CI timing diagnostic only');
  console.log('PASS: exact closed/open spline and 901 fewer redundant mapping calls per rebuild');
} finally {
  THREE.Curve.prototype.getUtoTmapping=originalMap;
}
