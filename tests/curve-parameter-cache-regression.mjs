// Closed rides deliberately retain the restored round-16 node-fraction
// ownership. Open drafting keeps its true-curve cache because it has no
// shipped ride fingerprint. Run: node tests/curve-parameter-cache-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';

const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const game=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(game,'production game module not found');
new Function(game.replace(/^import[^\n]*\n/gm,''));
const core=game.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)?.[1];
assert.ok(core,'production CORE markers missing');
const openStart=game.indexOf('function computeOpenTrack(nodes) {');
const openEnd=game.indexOf('/* fewer than 2 points:',openStart);
assert.ok(openStart>=0&&openEnd>openStart,'open spline source missing');
const open=game.slice(openStart,openEnd);

assert.equal(core.split('const curveT = new Float64Array(SAMPLES + 1);').length-1,0,
  'closed ride ownership must not restore the fingerprint-changing cache');
assert.ok(core.includes('const f = (i / SAMPLES) * N;'),
  'closed rides must use the restored round-16 source-node fraction');
assert.equal(open.split('const curveT = new Float64Array(SAMPLES + 1);').length-1,1,
  'open drafting keeps one true-curve mapping cache');
assert.ok(open.includes('const f = curveT[i] * (N - 1);'),
  'open drafting must reuse the mapped parameter for lift and bank ownership');

const {computeTrack,PRESETS,SAMPLES}=new Function('THREE',core+'\nreturn {computeTrack,PRESETS,SAMPLES};')(THREE);
const originalMap=THREE.Curve.prototype.getUtoTmapping;
let calls=0;
THREE.Curve.prototype.getUtoTmapping=function(...args){
  calls++; return originalMap.apply(this,args);
};
try {
  for(const [name,nodes] of Object.entries(PRESETS)){
    calls=0;
    const track=computeTrack(nodes);
    assert.equal(track.samples.length,SAMPLES+1,name+' sample count');
    assert.equal(calls,2*(SAMPLES+1),
      name+' must use only standard spacing plus the height-guard mapping pass');
    for(let i=0;i<=SAMPLES;i++){
      const expected=Math.floor(i/SAMPLES*nodes.length)%nodes.length;
      assert.equal(track.samples[i].nodeSeg,expected,name+' source owner at sample '+i);
    }
  }
  console.log('PASS: closed rides retain restored node-fraction ownership; open drafting keeps its isolated curve cache');
} finally {
  THREE.Curve.prototype.getUtoTmapping=originalMap;
}
