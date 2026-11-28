// Editor controls should reflect the CURRENT document, never stale nodes.
// Station ownership must always remain exactly one on complete coasters.
// Run: node tests/empty-panel-station-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'game module missing');
new Function(script.replace(/^import[^\n]*\n/gm,'')); // parses real app

const a=script.indexOf('function assignStation(list, idx, checked) {');
const b=script.indexOf("els.station.addEventListener('change'",a);
assert.ok(a>=0&&b>a,'source station helper missing');
const assignStation=new Function(script.slice(a,b)+'\nreturn assignStation;')();
const nodes=[
 {x:0,z:0,h:3,bank:20,station:true},
 {x:20,z:8,h:18,bank:-45,station:false},
 {x:35,z:18,h:3,bank:70,station:false}
];
const before=structuredClone(nodes);
assert.equal(assignStation(nodes,0,false),false,'unchecking must never remove the station');
assert.deepEqual(nodes,before);
assert.equal(assignStation(nodes,99,true),false,'invalid selection must not mutate');
assert.deepEqual(nodes,before);
assert.equal(assignStation(nodes,1,true),true);
assert.deepEqual(nodes.map(n=>!!n.station),[false,true,false]);
assert.deepEqual(nodes.map(n=>n.bank),[20,-45,70],'station move cannot alter banking');
assert.equal(assignStation(nodes,1,true),false,'same owner is a no-op');
nodes[0].station=true; // simulate an invalid imported multi-station state
assert.equal(assignStation(nodes,1,true),true);
assert.deepEqual(nodes.map(n=>!!n.station),[false,true,false],'reassign repairs duplicates');

// Bad/old completed imports can specify NO station or more than one.
// The same sanitizer is used by JSON and URL-share restores; it must
// turn all finished circuits into exactly one station consistently.
const core=html.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)?.[1];
assert.ok(core,'core source missing');
const THREE={MathUtils:{clamp:(v,lo,hi)=>Math.min(Math.max(v,lo),hi)}};
const {sanitizeNodes,encodeCoaster,decodeCoaster}=new Function('THREE',
  core+'\nreturn {sanitizeNodes,encodeCoaster,decodeCoaster};')(THREE);
const legacy=[
 {x:0,z:20,h:3,bank:0,station:false},
 {x:20,z:0,h:8,bank:30,station:true},
 {x:0,z:-20,h:3,bank:-20,station:true},
 {x:-20,z:0,h:3,bank:0,station:false}
];
const normalized=sanitizeNodes(legacy);
assert.deepEqual(normalized.map(n=>n.station),[false,true,false,false],
  'first designated station wins on malformed multi-station import');
assert.equal(normalized[1].bank,30,'normalization does not change banking');
const absent=sanitizeNodes(legacy.map(n=>({...n,station:false})));
assert.deepEqual(absent.map(n=>n.station),[true,false,false,false],
  'missing station falls back to node zero');
assert.deepEqual(decodeCoaster(encodeCoaster('legacy',legacy)).nodes.map(n=>n.station),
  [false,true,false,false],'share round trip must normalize duplicates');

// Extract the production panel function, evaluating only its null-track
// path (no fake graphics or reimplemented panel logic).
const panelStart=script.indexOf('function syncPanel() {');
const panelEnd=script.indexOf("els.h.addEventListener('input'",panelStart);
assert.ok(panelStart>=0&&panelEnd>panelStart,'panel source missing');
const panelSrc=script.slice(panelStart,panelEnd);
function el(){return {disabled:false,checked:true,value:44,textContent:'previous coaster'};}
function runPanel(panelNodes) {
 const els={name:el(),idx:el(),h:el(),b:el(),hVal:el(),bVal:el(),
            lift:el(),station:el(),seg:el()};
 const del=el();let continued=0;
 const select=0, building=true, trackName='new coaster';
 const $=id=>{
   if(id==='btnDel')return del;
   throw Error('unexpected element '+id);
 };
 const syncPanel=new Function('nodes','selected','els','trackName','building',
   'refreshContinue','$','track','THREE','arcOfPoint','trackData',
   'syncPrimaryTangentAvailability',panelSrc+'\nreturn syncPanel;')(
   panelNodes,select,els,trackName,building,()=>continued++,$,null,{},null,null,()=>{});
 syncPanel();
 return {els,del,continued};
}
const empty=runPanel([]);
assert.equal(empty.els.name.value,'new coaster','empty draft name must refresh');
assert.equal(empty.els.idx.textContent,'-');
assert.equal(empty.els.seg.textContent,'empty plot - click the ground to place your station.');
assert.equal(empty.els.hVal.textContent,'-');
assert.equal(empty.els.bVal.textContent,'-');
assert.equal(Number(empty.els.h.value),3);
assert.equal(Number(empty.els.b.value),0);
assert.equal(empty.els.lift.checked,false);
assert.equal(empty.els.station.checked,false);
for(const key of ['h','b','lift','station'])assert.equal(empty.els[key].disabled,true,key+' must be disabled with no node');
assert.equal(empty.del.disabled,true);
assert.equal(empty.continued,1);
const lone=runPanel([{x:-30,z:60,h:27.5,bank:-70,station:true,lift:false}]);
assert.equal(lone.els.hVal.textContent,'27.5 m');
assert.equal(lone.els.bVal.textContent,'-70 deg');
assert.equal(lone.els.idx.textContent,'#1 of 1');
assert.equal(lone.els.h.disabled,false);
assert.equal(lone.els.b.disabled,false);
assert.equal(lone.els.lift.disabled,false);
assert.equal(lone.els.station.disabled,true,'building station role remains locked');
assert.equal(lone.els.station.checked,true);
assert.equal(lone.del.disabled,false);
assert.ok(script.includes("if (!els.station.checked) {"),'do not allow user to uncheck sole station');
assert.ok(script.includes("els.station.checked = true;"),'UI should restore checkbox');
console.log('PASS: empty-draft controls cleared/disabled, lone station controls restored, exactly one station on reassignment');
