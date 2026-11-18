// Large-coaster terrain proximity equivalence + work reduction.
// Source-extracted from the real player; no changed coaster physics.
// Run after temporary, test-only Three.js install:
//   npm install --no-save --no-package-lock three@0.160.0
//   node tests/terrain-distance-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {performance} from 'node:perf_hooks';

const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const game=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(game,'production game module missing');
new Function(game.replace(/^import[^\n]*\n/gm,''));
const between=(a,b)=>{
  const i=game.indexOf(a),j=game.indexOf(b,i+a.length);
  assert.ok(i>=0&&j>i,'missing source region '+a);
  return game.slice(i,j);
};
const noiseSource=between('function terrainNoise(x, z) {','/* The dirt apron asks for the distance');
const distanceSource=between('let plotDistanceTree = null;','function terrainHeightAt(');
const terrainSource=between('function terrainHeightAt(x, z, dist = plotDist(x, z)) {','const terrainGeo = ');
assert.ok(distanceSource.includes('function rebuildPlotDistanceIndex()'));
assert.ok(game.includes('function buildTrack() {\n  cancelTrackPreview();\n  rebuildPlotDistanceIndex();'));
assert.ok(game.includes('function buildLoneStation() {\n  cancelTrackPreview();\n  rebuildPlotDistanceIndex();'));
assert.ok(game.includes('const d = plotDist(x, z);\n    const h = terrainHeightAt(x, z, d);'));
assert.ok(!game.includes('const h = terrainHeightAt(x, z);\n    const t ='),
  'terrain vertex loop must share its computed plot distance');
assert.ok(distanceSource.includes('plotBoundsDistSq(q, x, z) > best + 1e-9'),
  'bbox precision guard missing');
const oldDistance=(nodes,x,z)=>{
  let best=1e18;
  for(let i=0;i<nodes.length;i++){
    const a=nodes[i],b=nodes[(i+1)%nodes.length];
    const abx=b.x-a.x,abz=b.z-a.z;
    const len2=abx*abx+abz*abz||1;
    const t=Math.max(0,Math.min(1,((x-a.x)*abx+(z-a.z)*abz)/len2));
    const dx=x-(a.x+abx*t),dz=z-(a.z+abz*t);
    const d=dx*dx+dz*dz;
    if(d<best)best=d;
  }
  return Math.sqrt(best);
};
const countedDistanceSource=distanceSource.replace(
  'function plotSegmentDistSq(a, b, x, z) {',
  'function plotSegmentDistSq(a, b, x, z) { distanceEvaluations++;');
assert.notEqual(countedDistanceSource,distanceSource,'segment evaluation instrumentation missing');
const make=(nodes,building=false)=>{
  const output=new Function('THREE','nodes','building',
    noiseSource+'\nlet distanceEvaluations=0;\n'+countedDistanceSource+
    terrainSource+'\nreturn {rebuildPlotDistanceIndex,plotDist,terrainHeightAt,'+
    'counts:()=>distanceEvaluations,reset:()=>{distanceEvaluations=0;}};');
  return output(THREE,nodes,building);
};
function heightOld(nodes,building,x,z){
  const d=oldDistance(nodes,x,z);
  let f=THREE.MathUtils.smoothstep(d,26,58);
  if(building) f=Math.min(f,THREE.MathUtils.smoothstep(Math.max(Math.abs(x),Math.abs(z)),80,115));
  const noise=5.2*Math.sin(x*.021+1.7)*Math.cos(z*.017-.6)
    +2.8*Math.sin(x*.047-2.1)*Math.sin(z*.041+1.2)
    +1.2*Math.sin((x+z)*.093+.4);
  return noise*f-.02;
}
const shapes=[
  [],
  [{x:0,z:0,h:3,station:true}],
  [{x:0,z:0,h:3},{x:0,z:0,h:35},{x:0,z:0,h:4}],
  [{x:-20,z:0},{x:20,z:0},{x:20,z:35},{x:-20,z:35}],
  Array.from({length:16},(_,i)=>({x:Math.cos(i*.4)*35,z:Math.sin(i*.4)*40})),
  Array.from({length:17},(_,i)=>({x:Math.cos(i*.4)*35,z:Math.sin(i*.4)*40})),
  Array.from({length:80},(_,i)=>({x:Math.cos(i*Math.PI/40)*(70+8*Math.sin(i*.6)),
     z:Math.sin(i*Math.PI/40)*(60+11*Math.cos(i*.7)),h:i%9?3:40})),
  Array.from({length:120},(_,i)=>({x:(i%2?1:-1)*(60+Math.sin(i)*28),
     z:-110+i*1.8,h:3+(i%12)*4})),
  Array.from({length:90},(_,i)=>({x:i%4===0?0:Math.sin(i*.7)*55,
     z:i%9===0?0:Math.cos(i*.33)*50,h:i%7===0?45:3}))
];
let queries=0;
for(const [index,nodes] of shapes.entries()){
  for(const building of [false,true]){
    const api=make(nodes,building);
    api.rebuildPlotDistanceIndex();
    // exact same sampled terrain grid, plus edge and off-plot probes
    for(let xi=-300;xi<=300;xi+=30){
      for(let zi=-300;zi<=300;zi+=30){
        const x=xi+((index*7)%13)*.13,z=zi+((index*3)%9)*.17;
        const old=oldDistance(nodes,x,z),now=api.plotDist(x,z);
        assert.ok(Math.abs(now-old)<1e-8,
          'exact distance diverged: shape '+index+' building='+building+' x='+x+' z='+z+' old='+old+' new='+now);
        const oldHeight=heightOld(nodes,building,x,z);
        assert.ok(Math.abs(api.terrainHeightAt(x,z)-oldHeight)<1e-8,
          'terrain height changed on shape '+index+' x='+x+' z='+z);
        assert.ok(Math.abs(api.terrainHeightAt(x,z,now)-oldHeight)<1e-8,
          'terrain cached distance changed vertex height');
        queries++;
      }
    }
    if(nodes.length>16){
      const first=api.plotDist(14,24);
      nodes[2].x+=8;nodes[3].z-=4;
      api.rebuildPlotDistanceIndex();
      assert.ok(Math.abs(api.plotDist(14,24)-oldDistance(nodes,14,24))<1e-8,
        'index was stale after edited nodes');
      nodes[2].x-=8;nodes[3].z+=4;
      api.rebuildPlotDistanceIndex();
      assert.ok(Math.abs(api.plotDist(14,24)-first)<1e-8,'undo restores exact proximity');
    }
  }
}
const nodes=shapes[6],api=make(nodes);
api.rebuildPlotDistanceIndex();
const grid=[];
for(let i=0;i<=108;i++)for(let j=0;j<=108;j++)grid.push([-300+i*600/108,-300+j*600/108]);
api.reset();
const t0=performance.now();
let sumNew=0;
for(const [x,z] of grid)sumNew+=api.plotDist(x,z);
const tIndexed=performance.now()-t0,indexedSegments=api.counts();
const t1=performance.now();
let sumOld=0;
for(const [x,z] of grid)sumOld+=oldDistance(nodes,x,z);
const tBrute=performance.now()-t1;
assert.ok(Math.abs(sumNew-sumOld)<1e-6,'terrain-wide proximity aggregate changed');
const bruteSegments=nodes.length*grid.length;
assert.ok(indexedSegments<bruteSegments*.35,
  'index should avoid at least 65% of exact projections on a typical 80-point coaster; got '+indexedSegments+'/'+bruteSegments);
console.log('Terrain scan benchmark: '+grid.length+' grid points, '+nodes.length+
  ' control nodes, '+indexedSegments+' actual segment projections vs '+bruteSegments+
  ' original ('+(100*indexedSegments/bruteSegments).toFixed(1)+'%), '+
  'BVH '+tIndexed.toFixed(1)+'ms vs linear '+tBrute.toFixed(1)+'ms (timings diagnostic only)');
console.log('PASS: '+queries+' exact proximity+height probes, duplicate and vertical segments, open/closed, edits/undo, terrain distance computed once per vertex');
